import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { setTimeout } from 'node:timers/promises';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';
import { requireCustomer, tokenHash } from '../../apps/web/src/server/session.js';

test('independent tenant readers proceed while suspension waits for both transactions', async () => {
  if (process.env.PILOT_CONTAINER !== '1') {
    console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/session-concurrency.test.js'])); return;
  }
  const first = await connectFixture(), second = await connectFixture(), writer = await connectFixture(), observer = await connectFixture(true);
  const now = new Date();
  let releaseInspection!: () => void, enteredInspection!: () => void;
  const inspection = new Promise<void>(resolve => { releaseInspection = resolve; });
  const entered = new Promise<void>(resolve => { enteredInspection = resolve; });
  let checking: ReturnType<typeof requireCustomer> | undefined, suspending: Promise<unknown> | undefined;
  try {
    const tenant = (await first.query("INSERT INTO pilot.tenants(name) VALUES('Concurrent readers') RETURNING id")).rows[0].id;
    const actors: { token: string; subject: string }[] = [];
    for (let i = 0; i < 2; i++) {
      const subject = randomUUID(), token = randomBytes(32).toString('hex');
      const identity = (await first.query('INSERT INTO pilot.identities(subject,verified) VALUES($1,true) RETURNING id', [subject])).rows[0].id;
      const membership = (await first.query("INSERT INTO pilot.memberships(tenant_id,identity_id,role) VALUES($1,$2,'Employee') RETURNING id", [tenant, identity])).rows[0].id;
      await first.query(`INSERT INTO pilot.sessions(token_hash,csrf_hash,identity_id,identity_version,tenant_id,tenant_version,membership_id,membership_version,audience,created_at,last_seen_at,expires_at)
        VALUES($1,$1,$2,1,$3,1,$4,1,'customer',$5,$5,$6)`, [tokenHash(token), identity, tenant, membership, now, new Date(now.getTime() + 28_800_000)]);
      actors.push({ token, subject });
    }
    const status = (subject: string) => ({ subject, enabled: true, verified: true, credentials: [], requiredActions: [] });
    const firstPid = (await first.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    const secondPid = (await second.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    const writerPid = (await writer.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    const blockedBy = async (waiter: number, pids: number[]): Promise<number> => {
      for (let i = 0; i < 100; i++) {
        const blockers: number[] = (await observer.query('SELECT pg_blocking_pids($1) AS ids', [waiter])).rows[0].ids;
        const blocker = pids.find(pid => blockers.includes(pid));
        if (blocker !== undefined) return blocker;
        await setTimeout(10);
      }
      assert.fail('The competing transaction must visibly wait for an expected holder');
    };
    await first.query('BEGIN');
    checking = requireCustomer(first, actors[0]!.token, now, async subject => {
      enteredInspection(); await inspection; return status(subject);
    });
    await entered;
    await second.query('BEGIN'); await second.query("SET LOCAL lock_timeout='200ms'");
    assert.equal((await requireCustomer(second, actors[1]!.token, now, async subject => status(subject))).tenantId, tenant);
    await writer.query('BEGIN');
    suspending = writer.query('UPDATE pilot.tenants SET active=false,version=version+1 WHERE id=$1', [tenant]);
    const finishFirst = async () => { releaseInspection(); assert.equal((await checking!).tenantId, tenant); await first.query('COMMIT'); };
    // PostgreSQL can wait on one MultiXact member at a time; release its observed holder first.
    if (await blockedBy(writerPid, [firstPid, secondPid]) === firstPid) {
      await finishFirst(); await blockedBy(writerPid, [secondPid]); await second.query('COMMIT');
    } else {
      await second.query('COMMIT'); await blockedBy(writerPid, [firstPid]); await finishFirst();
    }
    await suspending; await writer.query('COMMIT');
    for (const actor of actors) {
      await first.query('BEGIN');
      await assert.rejects(requireCustomer(first, actor.token, now, async subject => status(subject)), /Denied/);
      await first.query('ROLLBACK');
    }
    await writer.query('UPDATE pilot.tenants SET active=true,version=version+1 WHERE id=$1', [tenant]);
    await first.query('BEGIN');
    await assert.rejects(requireCustomer(first, actors[0]!.token, now, async subject => status(subject)), /Denied/);
    await first.query('ROLLBACK');
    await writer.query('UPDATE pilot.sessions SET tenant_version=3 WHERE tenant_id=$1', [tenant]);
    await first.query('BEGIN');
    assert.equal((await requireCustomer(first, actors[0]!.token, now, async subject => status(subject))).tenantId, tenant);
    await first.query('COMMIT');
    await writer.query('BEGIN');
    await writer.query('UPDATE pilot.tenants SET active=false,version=version+1 WHERE id=$1', [tenant]);
    await first.query('BEGIN');
    let inspections = 0;
    const deniedAfterSuspension = assert.rejects(requireCustomer(first, actors[0]!.token, now, async subject => { inspections++; return status(subject); }), /Denied/);
    await blockedBy(firstPid, [writerPid]); await writer.query('COMMIT'); await deniedAfterSuspension; await first.query('ROLLBACK');
    assert.equal(inspections, 0);
    assert.deepEqual((await writer.query('SELECT active,version FROM pilot.tenants WHERE id=$1', [tenant])).rows[0], { active: false, version: 4 });
  } finally {
    releaseInspection(); await checking?.catch(() => undefined);
    await Promise.all([first.query('ROLLBACK'), second.query('ROLLBACK'), writer.query('ROLLBACK')]);
    await suspending?.catch(() => undefined);
    await first.end(); await second.end(); await writer.end(); await observer.end();
  }
});
