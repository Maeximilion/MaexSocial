import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Client } from 'pg';
import type { CustomerContext, InspectIdentity } from '../../../../packages/contracts/pilot.js';

export const tokenHash = (token: string): string => createHash('sha256').update(token).digest('hex');
const denied = (): never => { throw new Error('Denied'); };

// The caller owns BEGIN/COMMIT. Cross-user callers lock the complete identity set first.
export async function lockIdentities(db: Client, ids: string[]): Promise<void> {
  const unique = [...new Set(ids)].sort();
  const locked = await db.query('SELECT id FROM pilot.identities WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE', [unique]);
  if (locked.rowCount !== unique.length) denied();
}

export async function requireCustomer(db: Client, token: string, clock: () => Date, inspect: InspectIdentity,
  activity: 'refresh' | 'read-only' = 'refresh'): Promise<CustomerContext> {
  if (!/^[a-f0-9]{64}$/.test(token)) denied();
  const located = (await db.query('SELECT id,identity_id,tenant_id,membership_id FROM pilot.sessions WHERE token_hash=$1 AND audience=$2', [tokenHash(token), 'customer'])).rows[0];
  if (!located) denied();
  await lockIdentities(db, [located.identity_id]);
  // Share tenant reads; tenant writers must acquire FOR UPDATE in lock order before this call.
  await db.query('SELECT id FROM pilot.tenants WHERE id=$1 FOR SHARE', [located.tenant_id]);
  await db.query('SELECT id FROM pilot.memberships WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [located.tenant_id, located.membership_id]);
  const session = (await db.query('SELECT * FROM pilot.sessions WHERE id=$1 FOR UPDATE', [located.id])).rows[0];
  if (!session || session.identity_id !== located.identity_id || session.tenant_id !== located.tenant_id
    || session.membership_id !== located.membership_id || session.token_hash !== tokenHash(token) || session.audience !== 'customer'
    || session.revoked_at) denied();
  const authority = (await db.query(`SELECT i.subject,i.version AS identity_version,i.verified,
    t.active AS tenant_active,t.version AS tenant_version,m.active AS membership_active,m.version AS membership_version,m.role
    FROM pilot.identities i JOIN pilot.memberships m ON m.identity_id=i.id JOIN pilot.tenants t ON t.id=m.tenant_id
    WHERE i.id=$1 AND t.id=$2 AND m.id=$3`, [located.identity_id, located.tenant_id, located.membership_id])).rows[0];
  if (!authority || !authority.verified || !authority.tenant_active || !authority.membership_active
    || authority.identity_version !== session.identity_version || authority.membership_version !== session.membership_version
    || authority.tenant_version !== session.tenant_version) denied();
  const current = await inspect(authority.subject);
  if (current.subject !== authority.subject
    || !current.verified || !current.enabled || current.requiredActions.length) denied();
  const mfaEnrolled = current.credentials.some(c => c.id === session.mfa_credential_id && ['otp', 'webauthn', 'webauthn-passwordless'].includes(c.type));
  const now = clock();
  if (!Number.isFinite(now.getTime()) || now < session.created_at || now < session.last_seen_at || now >= session.expires_at
    || now.getTime() - session.created_at.getTime() >= 28_800_000 || now.getTime() - session.last_seen_at.getTime() >= 1_800_000) denied();
  if (activity === 'refresh') await db.query('UPDATE pilot.sessions SET last_seen_at=$1 WHERE id=$2', [now, session.id]);
  return { sessionId: session.id, identityId: located.identity_id, subject: authority.subject, tenantId: located.tenant_id,
    tenantVersion: authority.tenant_version, membershipId: located.membership_id,
    membershipVersion: authority.membership_version, role: authority.role,
    mfaAt: session.mfa_at, mfaEnrolled };
}
export function requireManagerMfa(context: CustomerContext, clock: () => Date): void {
  const now = clock();
  const age = context.mfaAt ? now.getTime() - context.mfaAt.getTime() : NaN;
  if (context.role !== 'Manager' || !context.mfaEnrolled || !Number.isFinite(age) || age < 0 || age > 300_000) denied();
}
export function requireCsrf(origin: string | undefined, proof: string | undefined, expectedOrigin: string, expectedProof: string): void {
  if (origin !== expectedOrigin || !proof || !/^[a-f0-9]{64}$/.test(proof) || !/^[a-f0-9]{64}$/.test(expectedProof)
    || !timingSafeEqual(Buffer.from(proof, 'hex'), Buffer.from(expectedProof, 'hex'))) denied();
}

export async function rotateCustomerSession(db: Client, token: string, tenantId: string, clock: () => Date, inspect: InspectIdentity): Promise<{ token: string; csrf: string }> {
  if (!/^[a-f0-9]{64}$/.test(token) || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(tenantId)) denied();
  const located = (await db.query("SELECT identity_id,tenant_id,membership_id FROM pilot.sessions WHERE token_hash=$1 AND audience='customer'", [tokenHash(token)])).rows[0];
  if (!located) denied();
  await lockIdentities(db, [located.identity_id]);
  const tenants = (await db.query('SELECT id,active,version FROM pilot.tenants WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE', [[...new Set([located.tenant_id, tenantId])].sort()])).rows;
  if (!tenants.some(t => t.id === tenantId && t.active)) denied();
  const memberships = (await db.query('SELECT * FROM pilot.memberships WHERE identity_id=$1 AND tenant_id=ANY($2::uuid[]) ORDER BY tenant_id,id FOR UPDATE', [located.identity_id, tenants.map(t => t.id)])).rows;
  const target = memberships.find(m => m.tenant_id === tenantId && m.active);
  if (!target) denied();
  const old = (await db.query('SELECT * FROM pilot.sessions WHERE token_hash=$1 FOR UPDATE', [tokenHash(token)])).rows[0];
  if (!old || old.identity_id !== located.identity_id || old.tenant_id !== located.tenant_id || old.membership_id !== located.membership_id) denied();
  let now!: Date;
  await requireCustomer(db, token, () => { now = clock(); return now; }, inspect);
  const nextToken = randomBytes(32).toString('hex'), csrf = randomBytes(32).toString('hex');
  await db.query(`INSERT INTO pilot.sessions(token_hash,csrf_hash,identity_id,identity_version,tenant_id,membership_id,membership_version,audience,
    created_at,last_seen_at,expires_at,mfa_at,mfa_credential_id,tenant_version) VALUES($1,$2,$3,$4,$5,$6,$7,'customer',$8,$9,$10,$11,$12,$13)`,
  [tokenHash(nextToken), tokenHash(csrf), old.identity_id, old.identity_version, target.tenant_id, target.id, target.version,
    old.created_at, now, old.expires_at, old.mfa_at, old.mfa_credential_id, tenants.find(t => t.id === tenantId)!.version]);
  await db.query('UPDATE pilot.sessions SET revoked_at=$1 WHERE id=$2', [now, old.id]);
  return { token: nextToken, csrf };
}

