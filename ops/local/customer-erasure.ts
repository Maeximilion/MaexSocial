import { createHash } from 'node:crypto';
import type { Client } from 'pg';

export const pilotIssuer = 'https://keycloak:8443/realms/pilot';
export type CustomerErasure = {
  kind: 'delete-customer'; issuer: typeof pilotIssuer; id: string; binding: string; version: number;
};

export function subjectBinding(source: string, id: string, subject: string) {
  return createHash('sha256').update(JSON.stringify([source, pilotIssuer, id, subject])).digest('hex');
}

// Caller holds the owner-only source instruction or the offline recovery lock and verified journal.
export async function eraseCustomer(db: Client, source: string, event: CustomerErasure, offline: boolean) {
  const { rows: [identity] } = await db.query<{ subject: string; version: number }>(
    'SELECT subject,version FROM pilot.identities WHERE id=$1 FOR UPDATE', [event.id]);
  if (!identity || event.issuer !== pilotIssuer || subjectBinding(source, event.id, identity.subject) !== event.binding
      || (offline ? identity.version > event.version : identity.version !== event.version)) {
    throw new Error('Customer erasure binding mismatch');
  }
  const id = [event.id];
  if ((await db.query('SELECT 1 FROM pilot.platform_grants WHERE identity_id=$1', id)).rowCount) {
    throw new Error('Customer-only identity required');
  }
  await db.query('SELECT id FROM pilot.memberships WHERE identity_id=$1 ORDER BY tenant_id,id FOR UPDATE', id);
  const sessions = await db.query("DELETE FROM pilot.sessions WHERE identity_id=$1 AND audience='customer'", id);
  const pending = await db.query('DELETE FROM pilot.pending_access WHERE identity_id=$1', id);
  // The recipient has an independent invitation record. Withdraw only the departing issuer's authority.
  const revoked = await db.query(`UPDATE pilot.invitations i SET revoked_at=clock_timestamp() FROM pilot.memberships m
    WHERE m.identity_id=$1 AND (i.tenant_id,i.issuer_membership_id)=(m.tenant_id,m.id)
      AND i.revoked_at IS NULL AND i.consumed_at IS NULL`, id);
  const removed = await db.query(`DELETE FROM pilot.memberships m WHERE m.identity_id=$1
    AND NOT EXISTS (SELECT FROM pilot.approvals a WHERE (a.tenant_id,a.membership_id)=(m.tenant_id,m.id))
    AND NOT EXISTS (SELECT FROM pilot.business_fact_revisions b WHERE (b.tenant_id,b.membership_id)=(m.tenant_id,m.id))
    AND NOT EXISTS (SELECT FROM pilot.audit a WHERE (a.tenant_id,a.membership_id)=(m.tenant_id,m.id))
    AND NOT EXISTS (SELECT FROM pilot.invitations i WHERE (i.tenant_id,i.issuer_membership_id)=(m.tenant_id,m.id))`, id);
  const retained = await db.query(`UPDATE pilot.memberships SET active=false,version=version+1
    WHERE identity_id=$1 AND active`, id);
  const deleted = await db.query(`DELETE FROM pilot.identities WHERE id=$1
    AND NOT EXISTS (SELECT FROM pilot.memberships WHERE identity_id=$1)
    AND NOT EXISTS (SELECT FROM pilot.audit WHERE actor_id=$1)`, id);
  if (!deleted.rowCount) {
    // These historical foreign keys remain linkable. Discard the issuer subject and verification state.
    await db.query(`UPDATE pilot.identities SET subject='erased/' || gen_random_uuid()::text,
      verified=false,version=version+1 WHERE id=$1`, id);
  }
  return { sessions: sessions.rowCount, pending: pending.rowCount, invitationsRevoked: revoked.rowCount,
    membershipsDeleted: removed.rowCount, membershipsDeactivated: retained.rowCount, identitiesDeleted: deleted.rowCount };
}
