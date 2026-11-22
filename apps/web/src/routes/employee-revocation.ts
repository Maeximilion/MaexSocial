import type { Client } from 'pg';
import type { InspectIdentity } from '../../../../packages/contracts/pilot.js';
import { normalizeAccountEmail } from '../server/account-email.js';
import { requireCustomerRequest, type CustomerRequest } from '../server/request.js';
import { lockIdentities, requireManagerMfa, tokenHash } from '../server/session.js';

// The caller owns the transaction. Only the isolated fixture supplies the recipient binding until #221.
export async function revokeEmployeeMembership(db: Client, request: CustomerRequest, membershipId: string,
  clock: () => Date, inspect: InspectIdentity, recipientBySubject: ReadonlyMap<string, string>): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(request.token) || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(membershipId)) {
    throw new Error('Denied');
  }
  const hash = tokenHash(request.token);
  const binding = (await db.query<{
    id: string; identity_id: string; tenant_id: string; membership_id: string; target_identity: string;
  }>(`SELECT s.id,s.identity_id,s.tenant_id,s.membership_id,m.identity_id AS target_identity
    FROM pilot.sessions s JOIN pilot.memberships m ON m.tenant_id=s.tenant_id AND m.id=$2
    WHERE s.token_hash=$1 AND s.audience='customer'`, [hash, membershipId])).rows[0];
  if (!binding) throw new Error('Denied');
  const { id, identity_id: actorId, tenant_id: tenantId, membership_id: actorMembership, target_identity: targetId } = binding;

  await lockIdentities(db, [actorId, targetId]);
  // Invitation creation takes a tenant authority lock even when the recipient has no membership.
  await db.query('SELECT id FROM pilot.tenants WHERE id=$1 FOR UPDATE', [tenantId]);
  const members = (await db.query<{ id: string; identity_id: string; subject: string; role: string; active: boolean }>(`
    SELECT m.id,m.identity_id,m.role,m.active,i.subject FROM pilot.memberships m
    JOIN pilot.identities i ON i.id=m.identity_id
    WHERE m.tenant_id=$1 AND m.id=ANY($2::uuid[]) ORDER BY m.id FOR UPDATE OF m`,
  [tenantId, [actorMembership, membershipId]])).rows;
  const target = members.find(member => member.id === membershipId);
  if (target?.identity_id !== targetId || !members.some(member => member.id === actorMembership && member.identity_id === actorId)) {
    throw new Error('Denied');
  }
  const session = await db.query(`SELECT id FROM pilot.sessions WHERE id=$1 AND token_hash=$2 AND identity_id=$3
    AND tenant_id=$4 AND membership_id=$5 AND audience='customer' FOR UPDATE`, [id, hash, actorId, tenantId, actorMembership]);
  if (session.rowCount !== 1) throw new Error('Denied');

  const actor = await requireCustomerRequest(db, request, clock, inspect, 'read-only');
  const now = clock();
  requireManagerMfa(actor, () => now);
  if (target.role !== 'Employee') throw new Error('Denied');
  if (!target.active) return false;
  const email = recipientBySubject.get(target.subject);
  if (email === undefined || normalizeAccountEmail(email) !== email) throw new Error('Denied');

  const revoked = await db.query(`UPDATE pilot.memberships SET active=false,version=version+1
    WHERE tenant_id=$1 AND id=$2`, [tenantId, membershipId]);
  if (revoked.rowCount !== 1) throw new Error('Denied');
  await db.query(`UPDATE pilot.invitations SET revoked_at=$3 WHERE tenant_id=$1 AND email=$2
    AND role='Employee' AND purpose='membership' AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at>$3`,
  [tenantId, email, now]);
  const audit = await db.query(`INSERT INTO pilot.audit(tenant_id,actor_id,action,reason,outcome,created_at)
    VALUES($1,$2,'employee_membership_revoked',$3,'revoked',$4)`, [tenantId, actorId, `Employee membership ${membershipId}`, now]);
  if (audit.rowCount !== 1) throw new Error('Denied');
  return true;
}
