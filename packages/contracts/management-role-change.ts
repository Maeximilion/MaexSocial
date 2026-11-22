import type { Client } from 'pg';
import type { CustomerRole } from './pilot.js';
import { deny, lockManagementSession, managementEvidence, requireFreshManagementProof, uuid, version,
  type ManagementContext } from './management.js';

export interface ManagementRoleChangeContext extends ManagementContext {
  membershipId: string;
  membershipVersion: number;
  role: CustomerRole;
}

export async function changeMembershipRole(connect: () => Promise<Client>, proof: ManagementRoleChangeContext,
  tenantId: string, membershipId: string, role: CustomerRole, reason: string, clock: () => Date): Promise<boolean> {
  proof = { ...proof };
  if (proof.membershipId !== membershipId || !uuid(membershipId) || !version(proof.membershipVersion) ||
      proof.role !== role || (role !== 'Manager' && role !== 'Employee')) deny();
  const { auditReason, assertedAt } = managementEvidence(proof, tenantId, reason);

  const db = await connect();
  try {
    await db.query('BEGIN');
    const target = (await db.query<{ identity_id: string }>(
      'SELECT identity_id FROM pilot.memberships WHERE tenant_id=$1 AND id=$2', [tenantId, membershipId])).rows[0] ?? deny();
    // Match customer and invitation lock order: sorted identities, tenant, then memberships.
    const identities = [...new Set([proof.identityId, target.identity_id])].sort();
    const locked = await db.query(
      'SELECT id FROM pilot.identities WHERE id=ANY($1::uuid[]) AND verified ORDER BY id FOR UPDATE', [identities]);
    if (locked.rowCount !== identities.length) deny();
    await db.query('SELECT id FROM pilot.tenants WHERE id=$1 FOR UPDATE', [tenantId]);
    const session = await lockManagementSession(db, proof);
    const membership = (await db.query<{ role: CustomerRole; version: number }>(`SELECT role,version FROM pilot.memberships
      WHERE tenant_id=$1 AND id=$2 AND identity_id=$3 AND active FOR UPDATE`, [tenantId, membershipId, target.identity_id])).rows[0] ?? deny();

    if (membership.version !== proof.membershipVersion || membership.role === role) {
      requireFreshManagementProof(session, assertedAt, clock());
      await db.query('COMMIT');
      return false;
    }

    // Lock occurrences before checking attempts. Quarantine retains the restored approval binding.
    const occurrences = (await db.query<{ id: string }>(`SELECT o.id FROM pilot.occurrences o
      JOIN pilot.approvals p ON p.tenant_id=o.tenant_id AND p.occurrence_id=o.id AND p.id=o.approval_id
      WHERE o.tenant_id=$1 AND p.membership_id=$2 AND p.membership_version<=$3
        AND o.state IN ('draft','approved','held')
      ORDER BY o.id FOR UPDATE OF o`, [tenantId, membershipId, membership.version])).rows;

    const now = clock();
    requireFreshManagementProof(session, assertedAt, now);
    const updated = await db.query(`UPDATE pilot.memberships SET role=$3,version=version+1
      WHERE tenant_id=$1 AND id=$2 RETURNING version`, [tenantId, membershipId, role]);
    if (updated.rowCount !== 1) deny();
    await db.query(`UPDATE pilot.sessions SET revoked_at=$4 WHERE tenant_id=$1 AND membership_id=$2
      AND membership_version<=$3 AND audience='customer' AND revoked_at IS NULL`, [tenantId, membershipId, membership.version, now]);
    await db.query(`UPDATE pilot.invitations SET revoked_at=$4 WHERE tenant_id=$1 AND issuer_membership_id=$2
      AND issuer_version<=$3 AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at>$4`, [tenantId, membershipId, membership.version, now]);
    await db.query(`UPDATE pilot.occurrences o SET approval_id=NULL,state=CASE WHEN state='approved' THEN 'draft' ELSE state END
      WHERE tenant_id=$1 AND id=ANY($2::uuid[])
      AND NOT EXISTS (SELECT 1 FROM pilot.attempts a WHERE a.tenant_id=o.tenant_id AND a.occurrence_id=o.id)`,
    [tenantId, occurrences.map(o => o.id)]);
    const audit = await db.query(`INSERT INTO pilot.audit(tenant_id,actor_id,device_id,membership_id,membership_version,
      action,reason,outcome,created_at) VALUES($1,$2,$3,$4,$5,'membership_role_changed',$6,$7,$8)`,
    [tenantId, proof.identityId, proof.deviceId, membershipId, updated.rows[0].version, auditReason, role, now]);
    if (audit.rowCount !== 1) deny();
    await db.query('COMMIT');
    return true;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    await db.end();
  }
}
