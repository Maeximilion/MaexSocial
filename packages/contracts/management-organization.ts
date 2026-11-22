import type { Client } from 'pg';
import { deny, lockManagementSessionAuthority, managementSessionEvidence, requireFreshManagementProof,
  type ManagementSessionContext } from './management.js';

export interface ManagementOrganizationContext extends ManagementSessionContext {
  action: 'organization_create';
}

export async function createOrganization(connect: () => Promise<Client>, proof: ManagementOrganizationContext,
  name: string, reason: string, clock: () => Date): Promise<{ tenantId: string; status: 'created' }> {
  proof = { ...proof };
  const organizationName = typeof name === 'string' ? name.trim() : '';
  if (proof.action !== 'organization_create' || !organizationName || [...organizationName].length > 200 ||
      /[\p{Cc}\p{Cs}]/u.test(organizationName)) deny();
  const { auditReason, assertedAt } = managementSessionEvidence(proof, reason);
  const { identityId, deviceId } = proof;

  const db = await connect();
  try {
    await db.query('BEGIN');
    const identity = await db.query('SELECT id FROM pilot.identities WHERE id=$1 AND verified FOR SHARE', [identityId]);
    if (identity.rowCount !== 1) deny();
    const session = await lockManagementSessionAuthority(db, proof);
    const now = clock();
    requireFreshManagementProof(session, assertedAt, now);

    const { id: tenantId } = (await db.query<{ id: string }>(
      'INSERT INTO pilot.tenants(name) VALUES($1) RETURNING id', [organizationName])).rows[0] ?? deny();
    const audit = await db.query(`INSERT INTO pilot.audit(tenant_id,actor_id,device_id,action,reason,outcome,created_at)
      VALUES($1,$2,$3,'organization_create',$4,'created',$5)`, [tenantId, identityId, deviceId, auditReason, now]);
    if (audit.rowCount !== 1) deny();
    await db.query('COMMIT');
    return { tenantId, status: 'created' };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    await db.end();
  }
}
