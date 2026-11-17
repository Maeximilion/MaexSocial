import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';
import { requireCsrf, requireCustomer, requireManagerMfa } from '../../apps/web/src/server/session.js';
import type { CustomerContext, IdentityStatus } from '../../packages/contracts/pilot.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const now = new Date('2030-01-01T12:00:00Z');

test('origin/CSRF and exactly five minute MFA boundaries', () => {
  const proof = randomBytes(32).toString('hex');
  requireCsrf('https://customer:8443', proof, 'https://customer:8443', proof);
  for (const origin of [undefined, 'null', 'http://customer:8443', 'https://customer:8443.evil.invalid', 'https://customer:8443/']) {
    assert.throws(() => requireCsrf(origin, proof, 'https://customer:8443', proof), /Denied/);
  }
  for (const value of [undefined, '', 'x', randomBytes(32).toString('hex')]) assert.throws(() => requireCsrf('https://customer:8443', value, 'https://customer:8443', proof));
  const manager = { role: 'Manager', mfaEnrolled: true, mfaAt: new Date(now.getTime() - 300_000) } as CustomerContext;
  requireManagerMfa(manager, now);
  for (const patch of [{ role: 'Employee' }, { mfaEnrolled: false }, { mfaAt: null }, { mfaAt: new Date(now.getTime() + 1) }, { mfaAt: new Date(now.getTime() - 300_001) }]) {
    assert.throws(() => requireManagerMfa({ ...manager, ...patch } as CustomerContext, now), /Denied/);
  }
});

test('transactional current authority, current IdP factor and exact session expiry', async () => {
  if (process.env.PILOT_CONTAINER !== '1') {
    console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/session.test.js'])); return;
  }
  const db = await connectFixture();
  const token = randomBytes(32).toString('hex'), generation = randomUUID();
  const status: IdentityStatus = { subject: randomUUID(), email: `${randomUUID()}@example.invalid`, verified: true, enabled: true,
    generation, firstName: 'Invented', lastName: 'Customer', requiredActions: [], credentials: [{ id: 'current-factor', type: 'otp' }] };
  try {
    const identity = (await db.query("INSERT INTO pilot.identities(subject,email,verified,generation,lifecycle) VALUES($1,$2,true,$3,'active') RETURNING id", [status.subject, status.email, generation])).rows[0].id;
    const tenant = (await db.query("INSERT INTO pilot.tenants(name) VALUES('Synthetic A') RETURNING id")).rows[0].id;
    const membership = (await db.query("INSERT INTO pilot.memberships(tenant_id,identity_id,role) VALUES($1,$2,'Manager') RETURNING id", [tenant, identity])).rows[0].id;
    const session = (await db.query(`INSERT INTO pilot.sessions(token_hash,identity_id,identity_version,tenant_id,membership_id,membership_version,
      audience,created_at,last_seen_at,expires_at,mfa_at,mfa_credential_id,csrf_hash)
      VALUES($1,$2,1,$3,$4,1,'customer',$5,$5,$6,$5,'current-factor',$1) RETURNING id`,
    [hash(token), identity, tenant, membership, now, new Date(now.getTime() + 28_800_000)])).rows[0].id;
    const resolve = async (at = now, current = status) => {
      await db.query('BEGIN');
      try { return await requireCustomer(db, token, at, async () => current); }
      finally { await db.query('ROLLBACK'); }
    };
    const context = await resolve(); assert.equal(context.tenantId, tenant); assert.equal(context.role, 'Manager'); requireManagerMfa(context, now);
    const noFactor = await resolve(now, { ...status, credentials: [] }); assert.equal(noFactor.mfaEnrolled, false); assert.throws(() => requireManagerMfa(noFactor, now));
    for (const patch of [{ enabled: false }, { verified: false }, { generation: randomUUID() }, { subject: randomUUID() }, { email: 'other@example.invalid' }]) {
      await assert.rejects(resolve(now, { ...status, ...patch }), /Denied/);
    }
    await assert.rejects(resolve(new Date(now.getTime() + 1_800_000)), /Denied/);
    await resolve(new Date(now.getTime() + 1_799_999));
    await db.query('UPDATE pilot.sessions SET last_seen_at=$1 WHERE id=$2', [new Date(now.getTime() + 28_799_999), session]);
    await resolve(new Date(now.getTime() + 28_799_999));
    await assert.rejects(resolve(new Date(now.getTime() + 28_800_000)), /Denied/);
    await db.query('UPDATE pilot.sessions SET last_seen_at=$1 WHERE id=$2', [now, session]);
    await db.query("UPDATE pilot.memberships SET role='Employee',version=version+1 WHERE id=$1", [membership]);
    await assert.rejects(resolve(), /Denied/);
    await db.query("UPDATE pilot.memberships SET role='Manager',version=version+1 WHERE id=$1", [membership]);
    await assert.rejects(resolve(), /Denied/);
    await db.query('UPDATE pilot.sessions SET membership_version=3 WHERE id=$1', [session]);
    await resolve();
    await db.query("UPDATE pilot.identities SET lifecycle='recovering',version=version+1 WHERE id=$1", [identity]);
    await assert.rejects(resolve(), /Denied/);
  } finally { await db.end(); }
});
