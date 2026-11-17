import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { setTimeout } from 'node:timers/promises';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';
import { lockIdentities, requireCsrf, requireCustomer, requireManagerMfa } from '../../apps/web/src/server/session.js';
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

test('transactional current authority, synthetic current factor and exact session expiry', async () => {
  if (process.env.PILOT_CONTAINER !== '1') {
    console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/session.test.js'])); return;
  }
  const db = await connectFixture();
  const token = randomBytes(32).toString('hex');
  const status: IdentityStatus = { subject: randomUUID(), verified: true, enabled: true,
    requiredActions: [], credentials: [{ id: 'current-factor', type: 'otp' }] };
  try {
    const identity = (await db.query("INSERT INTO pilot.identities(subject,verified) VALUES($1,true) RETURNING id", [status.subject])).rows[0].id;
    const tenant = (await db.query("INSERT INTO pilot.tenants(name) VALUES('Synthetic A') RETURNING id")).rows[0].id;
    const membership = (await db.query("INSERT INTO pilot.memberships(tenant_id,identity_id,role) VALUES($1,$2,'Manager') RETURNING id", [tenant, identity])).rows[0].id;
    const session = (await db.query(`INSERT INTO pilot.sessions(token_hash,identity_id,identity_version,tenant_id,membership_id,membership_version,
      audience,tenant_version,created_at,last_seen_at,expires_at,mfa_at,mfa_credential_id,csrf_hash)
      VALUES($1,$2,1,$3,$4,1,'customer',1,$5,$5,$6,$5,'current-factor',$1) RETURNING id`,
    [hash(token), identity, tenant, membership, now, new Date(now.getTime() + 28_800_000)])).rows[0].id;
    const resolve = async (at = now, current = status) => {
      await db.query('BEGIN');
      try { return await requireCustomer(db, token, at, async () => current); }
      finally { await db.query('ROLLBACK'); }
    };
    const context = await resolve(); assert.equal(context.tenantId, tenant); assert.equal(context.role, 'Manager'); requireManagerMfa(context, now);
    const noFactor = await resolve(now, { ...status, credentials: [] }); assert.equal(noFactor.mfaEnrolled, false); assert.throws(() => requireManagerMfa(noFactor, now));
    for (const patch of [{ enabled: false }, { verified: false }, { subject: randomUUID() }, { requiredActions: ['UPDATE_PASSWORD'] }]) {
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
    const resetting = await connectFixture(), observer = await connectFixture(true);
    const blocked = async (pid: number) => {
      for (let i = 0; i < 100; i++) {
        if ((await observer.query('SELECT cardinality(pg_blocking_pids($1)) > 0 AS blocked', [pid])).rows[0].blocked) return;
        await setTimeout(10);
      }
      assert.fail('Competing transaction must visibly wait on the authority lock');
    };
    try {
      const resetPid = (await resetting.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      const protectedPid = (await db.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      await db.query('BEGIN'); await requireCustomer(db, token, now, async () => status);
      await resetting.query('BEGIN'); const resetLock = lockIdentities(resetting, [identity]);
      await blocked(resetPid);
      await db.query("UPDATE pilot.tenants SET name='Allowed before identity invalidation',version=version+1 WHERE id=$1", [tenant]);
      await db.query('COMMIT'); await resetLock;
      await resetting.query("UPDATE pilot.identities SET verified=false,version=version+1 WHERE id=$1", [identity]);
      await resetting.query('COMMIT'); await assert.rejects(resolve(), /Denied/);
      assert.equal((await db.query('SELECT name FROM pilot.tenants WHERE id=$1', [tenant])).rows[0].name, 'Allowed before identity invalidation');
      await db.query("UPDATE pilot.identities SET verified=true,version=version+1 WHERE id=$1", [identity]);
      await db.query('UPDATE pilot.sessions SET identity_version=3,tenant_version=2 WHERE id=$1', [session]);
      await resolve();
      await resetting.query('BEGIN'); await lockIdentities(resetting, [identity]);
      await resetting.query("UPDATE pilot.identities SET verified=false,version=version+1 WHERE id=$1", [identity]);
      await db.query('BEGIN'); const deniedAfterReset = assert.rejects(requireCustomer(db, token, now, async () => status), /Denied/);
      await blocked(protectedPid); await resetting.query('COMMIT'); await deniedAfterReset; await db.query('ROLLBACK');
      assert.equal((await db.query('SELECT name FROM pilot.tenants WHERE id=$1', [tenant])).rows[0].name, 'Allowed before identity invalidation');
      const secondIdentity = (await db.query('INSERT INTO pilot.identities(subject) VALUES($1) RETURNING id', [randomUUID()])).rows[0].id;
      await db.query('BEGIN'); await lockIdentities(db, [secondIdentity, identity]);
      await resetting.query('BEGIN'); const reverseOrder = lockIdentities(resetting, [identity, secondIdentity]);
      await blocked(resetPid); await db.query('COMMIT'); await reverseOrder; await resetting.query('COMMIT');
    } finally { await db.query('ROLLBACK'); await resetting.query('ROLLBACK'); await resetting.end(); await observer.end(); }
    await assert.rejects(resolve(), /Denied/);
  } finally { await db.end(); }
});
