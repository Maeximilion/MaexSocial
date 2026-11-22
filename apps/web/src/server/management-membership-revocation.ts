import type { Client } from 'pg';
import { deny, managementEvidence, requireFreshManagementProof, uuid, version,
  type ManagementContext } from '../../../../packages/contracts/management.js';
import { invalidateMembershipAuthority, lockManagementMembership, lockMembershipApprovals }
  from '../../../../packages/contracts/management-role-change.js';
import { normalizeAccountEmail } from './account-email.js';

export interface ManagementMembershipRevocationContext extends ManagementContext {
  action: 'membership_revoke';
  membershipId: string;
  membershipVersion: number;
}

// The private caller supplies a trusted identity-to-recipient binding, as in the local invitation fixture.
export async function revokeManagementMembership(connect: () => Promise<Client>,
  proof: ManagementMembershipRevocationContext, tenantId: string, membershipId: string, reason: string,
  clock: () => Date, recipientBySubject: ReadonlyMap<string, string>): Promise<boolean> {
  proof = { ...proof };
  if (proof.action !== 'membership_revoke' || proof.membershipId !== membershipId ||
      !uuid(membershipId) || !version(proof.membershipVersion)) return deny();
  const { auditReason, assertedAt } = managementEvidence(proof, tenantId, reason);

  const db = await connect();
  try {
    await db.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    const { session, membership, targetIdentity } = await lockManagementMembership(db, proof, membershipId);
    if (!membership.active || membership.version !== proof.membershipVersion) {
      requireFreshManagementProof(session, assertedAt, clock());
      await db.query('COMMIT');
      return false;
    }

    const occurrences = await lockMembershipApprovals(db, tenantId, membershipId, membership.version);
    const now = clock();
    requireFreshManagementProof(session, assertedAt, now);

    const revoked = (await db.query<{ version: number }>(`UPDATE pilot.memberships SET active=false,version=version+1
      WHERE tenant_id=$1 AND id=$2 RETURNING version`, [tenantId, membershipId])).rows[0] ?? deny();
    await invalidateMembershipAuthority(db, tenantId, membershipId, membership.version, occurrences, now);
    // The tenant lock also serializes both membership- and platform-grant invitation issuers.
    const email = recipientBySubject.get(targetIdentity.subject);
    if (email !== undefined && normalizeAccountEmail(email) === email) {
      await db.query(`UPDATE pilot.invitations SET revoked_at=$3 WHERE tenant_id=$1 AND email=$2
        AND purpose='membership' AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at>$3`, [tenantId, email, now]);
    }
    const audit = await db.query(`INSERT INTO pilot.audit(tenant_id,actor_id,device_id,membership_id,membership_version,
      action,reason,outcome,created_at) VALUES($1,$2,$3,$4,$5,'membership_revoked',$6,'revoked',$7)`,
    [tenantId, proof.identityId, proof.deviceId, membershipId, revoked.version, auditReason, now]);
    if (audit.rowCount !== 1) return deny();
    await db.query('COMMIT');
    return true;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    await db.end();
  }
}
