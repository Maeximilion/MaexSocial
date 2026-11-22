import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { approveOccurrence, readApprovalProposal } from '../../apps/web/src/routes/content.js';
import { claimExport } from '../../apps/web/src/server/occurrence-export.js';
import { requireCustomerRequest } from '../../apps/web/src/server/request.js';
import { tokenHash } from '../../apps/web/src/server/session.js';
import { claimDispatch } from '../../apps/worker/src/dispatch.js';
import { reconcileOccurrence } from '../../apps/worker/src/reconcile.js';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';
import type { InspectIdentity } from '../../packages/contracts/pilot.js';
import { FakeGbp } from './fake-gbp.js';
import { occurrence, seedTenant } from './fixtures.js';

const clock = () => new Date('2020-01-01T10:00:00Z');
const inspect: InspectIdentity = async subject => ({
  subject, verified: true, enabled: true, requiredActions: [], credentials: [{ id: 'synthetic-otp', type: 'otp' }]
});
const text = 'Invented ÃŸpring update ðŸŒ±\nSecond line with  spaces.';

function pauseCommit() {
  let markEntered!: (pid: number) => void;
  let resume!: () => void;
  const entered = new Promise<number>(resolve => { markEntered = resolve; });
  const release = new Promise<void>(resolve => { resume = resolve; });
  return {
    entered,
    resume,
    async connect() {
      const db = await connectFixture();
      const { pid } = (await db.query('SELECT pg_backend_pid() AS pid')).rows[0];
      db.query = new Proxy(db.query, {
        async apply(query, receiver, args) {
          if (args[0] === 'COMMIT') {
            markEntered(pid);
            await release;
          }
          return Reflect.apply(query, receiver, args);
        }
      });
      return db;
    }
  };
}

test('private dispatch claims the immutable approved text once on the isolated fake', async t => {
  if (process.env.PILOT_CONTAINER !== '1') {
    console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/dispatch.test.js']));
    return;
  }
  const directory = await mkdtemp(join('/dev/shm', 'maex-253-'));
  const fake = new FakeGbp(directory, { frames: [{ afterMs: 0, candidates: ['LIVE'] }] });
  const owner = await connectFixture(true);
  const setStop = (stopped: boolean) => owner.query('UPDATE pilot.dispatch_control SET stopped=$1 WHERE singleton', [stopped]);
  const read = async (sql: string, params: unknown[] = []) => (await owner.query(sql, params)).rows;
  const originalStop = (await read('SELECT stopped FROM pilot.dispatch_control'))[0]!.stopped as boolean;
  t.after(async () => {
    try { await setStop(originalStop); }
    finally {
      await owner.end();
      fake.close();
      await rm(directory, { recursive: true, force: true });
    }
  });

  const tenant = await seedTenant(owner);
  const other = await seedTenant(owner);
  const control = await occurrence(owner, other);
  const snapshot = randomUUID();
  await owner.query('INSERT INTO pilot.draft_revisions(tenant_id,draft_id,id,revision,text) VALUES($1,$2,$3,2,$4)',
    [tenant.tenant, tenant.draft, snapshot, text]);
  await owner.query('INSERT INTO pilot.budgets(tenant_id,synthetic_units) VALUES($1,5)', [tenant.tenant]);
  const binding = { token: randomBytes(32).toString('hex'), csrf: randomBytes(32).toString('hex') };
  await owner.query('UPDATE pilot.identities SET verified=true,version=version+1 WHERE id=$1', [tenant.user]);
  await owner.query(`INSERT INTO pilot.sessions(token_hash,csrf_hash,identity_id,identity_version,tenant_id,tenant_version,
    membership_id,membership_version,audience,created_at,last_seen_at,expires_at,mfa_at,mfa_credential_id)
    VALUES($1,$2,$3,2,$4,1,$5,1,'customer','2020-01-01T09:55Z','2020-01-01T09:56Z',
      '2020-01-01T11:00Z','2020-01-01T09:59Z','synthetic-otp')`,
  [tokenHash(binding.token), tokenHash(binding.csrf), tenant.user, tenant.tenant, tenant.membership]);
  const setGrant = (active: boolean, db = owner) => db.query(`UPDATE pilot.locations SET grant_active=$3,version=version+1
    WHERE tenant_id=$1 AND id=$2`, [tenant.tenant, tenant.location, active]);
  await setGrant(true);
  const approved = async (due = '2020-01-01T12:00:00.123456Z') => {
    const id = await occurrence(owner, tenant);
    await owner.query('UPDATE pilot.occurrences SET due_at=$2 WHERE id=$1', [id, due]);
    const reader = await connectFixture();
    const proposal = await (async () => {
      try {
        await reader.query('BEGIN');
        const context = await requireCustomerRequest(reader, binding, clock, inspect, 'read-only');
        return await readApprovalProposal(reader, context, id);
      } finally { await reader.end(); }
    })();
    return { id, approvalId: await approveOccurrence(connectFixture, binding, proposal, clock, inspect) };
  };
  const dispatch = (id: string, connect = connectFixture) => claimDispatch(connect, id, fake);
  const exportText = (id: string, connect = connectFixture) => claimExport(connect, binding, id, clock, inspect);
  const deny = (work: Promise<unknown>) => assert.rejects(work, { message: 'Denied' });
  const count = (id: string) => fake.createCount(tenant.tenant, id);
  const state = async (id: string) => (await read('SELECT state FROM pilot.occurrences WHERE id=$1', [id]))[0]!.state;
  const attempts = (id: string) => read('SELECT id,approval_id,outcome FROM pilot.attempts WHERE occurrence_id=$1', [id]);
  const audit = (id: string) => read('SELECT action,outcome FROM pilot.audit WHERE occurrence_id=$1', [id]);

  async function waitForBlocked(blockerPid: number, waitingPid?: number) {
    const deadline = performance.now() + 3000;
    while (performance.now() < deadline) {
      const waiting = await read(`SELECT pid FROM pg_stat_activity
        WHERE $1=ANY(pg_blocking_pids(pid)) AND ($2::int IS NULL OR pid=$2)`, [blockerPid, waitingPid ?? null]);
      if (waiting.length) return;
    }
    assert.fail('Competing transaction did not wait for the winning transaction');
  }

  async function changeGrantDuringClaim(active: boolean, blockerPid: number, release: () => void) {
    const changer = await connectFixture();
    try {
      const { pid } = (await changer.query('SELECT pg_backend_pid() AS pid')).rows[0];
      const changing = setGrant(active, changer);
      try { await waitForBlocked(blockerPid, pid); }
      finally {
        release();
        await changing;
      }
    } finally { await changer.end(); }
  }

  await t.test('competing claims send exactly one stored revision after the attempt is durable', async () => {
    await setStop(false);
    const { id, approvalId } = await approved();
    const gate = pauseCommit();
    const winner = dispatch(id, gate.connect);
    const pid = await Promise.race([gate.entered, winner.then(() => assert.fail('Expected commit barrier'))]);
    const loser = deny(dispatch(id));
    try {
      await waitForBlocked(pid);
      assert.equal(count(id), 0);
      assert.deepEqual(await attempts(id), []);
    } finally { gate.resume(); }
    const { attemptId, ...result } = await winner;
    await loser;
    assert.deepEqual(result, { state: 'in_flight' });
    assert.deepEqual(await attempts(id), [{ id: attemptId, approval_id: approvalId, outcome: 'unknown' }]);
    assert.deepEqual(await audit(id), [{ action: 'dispatch_claim', outcome: 'in_flight' }]);
    assert.equal(count(id), 1);
    const sqlite = new DatabaseSync(join(directory, 'fake-gbp.sqlite'), { readOnly: true });
    try {
      const stored = sqlite.prepare('SELECT intent FROM call_intents JOIN calls ON id=call_id WHERE occurrence=?').get(id)!;
      assert.deepEqual(JSON.parse(String(stored.intent)), { tenantId: tenant.tenant, occurrenceId: id, attemptId,
        approvalId, approverId: tenant.user, revisionId: snapshot, text, location: 'fake-location',
        locationId: tenant.location, membershipId: tenant.membership, membershipVersion: 1, grantVersion: 2,
        dueAt: '2020-01-01T12:00:00.123456Z', timezone: 'Europe/Berlin' });
    } finally { sqlite.close(); }
    assert.equal(await reconcileOccurrence(connectFixture, id, fake), 'confirmed');
    assert.equal(await state(id), 'confirmed');
  });

  await t.test('stop, not due, hold and unknown policy have no dispatch side effects', async () => {
    const due = await approved();
    const future = await approved('2099-01-01T12:00:00Z');
    await setStop(true);
    await deny(dispatch(due.id));
    await setStop(false);
    await deny(dispatch(future.id));
    const noCreate = { policy: 'unknown', create: () => assert.fail('Unexpected provider call') };
    // The invalid runtime policy simulates an unsupported or paid worker configuration.
    await deny(claimDispatch(connectFixture, due.id, noCreate as unknown as typeof fake));
    await owner.query("UPDATE pilot.occurrences SET state='held' WHERE id=$1", [due.id]);
    await deny(dispatch(due.id));
    for (const id of [due.id, future.id, control]) {
      assert.deepEqual(await attempts(id), []);
      assert.deepEqual(await audit(id), []);
      assert.equal(count(id), 0);
    }
  });

  await t.test('stop and a failed claim commit prevent create', async () => {
    const { id } = await approved();
    const stopper = await connectFixture();
    try {
      await stopper.query('BEGIN');
      await stopper.query('UPDATE pilot.dispatch_control SET stopped=true WHERE singleton');
      const { pid } = (await stopper.query('SELECT pg_backend_pid() AS pid')).rows[0];
      const rejected = deny(dispatch(id));
      try {
        await waitForBlocked(pid);
        assert.equal(count(id), 0);
        await stopper.query('COMMIT');
      } finally {
        await stopper.query('ROLLBACK');
        await rejected;
      }
    } finally { await stopper.end(); }
    await setStop(false);

    await owner.query(`CREATE CONSTRAINT TRIGGER fixture_dispatch_commit_failure AFTER INSERT ON pilot.audit
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pilot.reject_mutation()`);
    try { await assert.rejects(dispatch(id), { code: '23514' }); }
    finally { await owner.query('DROP TRIGGER fixture_dispatch_commit_failure ON pilot.audit'); }
    assert.equal(count(id), 0);
    assert.equal(await state(id), 'approved');
    assert.deepEqual(await attempts(id), []);
    assert.deepEqual(await audit(id), []);
  });

  await t.test('crash before send and loss after fake acceptance stay read-only across restart', async () => {
    for (const interruption of ['before-create', 'lost-reply']) {
      const { id } = await approved();
      const child = spawnSync(process.execPath, ['-e', `
        const { claimDispatch } = require('./dist/pilot/apps/worker/src/dispatch.js');
        const { connectFixture } = require('./dist/pilot/ops/local/fixture.js');
        const { FakeGbp } = require('./dist/pilot/tests/pilot/fake-gbp.js');
        const [dir, occurrenceId, mode] = process.argv.slice(1);
        const fake = new FakeGbp(dir, { loseReply: true, frames: [{ afterMs: 0, candidates: ['LIVE'] }] });
        const create = mode === 'before-create' ? () => process.exit(41) : fake.create.bind(fake);
        claimDispatch(connectFixture, occurrenceId, { policy: fake.policy, create }).then(
          () => process.exit(1), error => process.exit(error.message === 'Synthetic dispatch outcome unknown' ? 42 : 2));
      `, directory, id, interruption], { timeout: 10000, encoding: 'utf8' });
      const sent = interruption === 'lost-reply';
      assert.equal(child.status, sent ? 42 : 41);
      assert.equal(child.stdout, '');
      assert.equal(await state(id), 'in_flight');
      assert.equal((await attempts(id)).length, 1);
      const restarted = new FakeGbp(directory);
      try {
        await deny(claimDispatch(connectFixture, id, restarted));
        assert.equal(await reconcileOccurrence(connectFixture, id, restarted), sent ? 'confirmed' : 'unknown');
        assert.equal(restarted.createCount(tenant.tenant, id), Number(sent));
      } finally { restarted.close(); }
    }
  });

  await t.test('dispatch first blocks a concurrent real export across grant loss', async () => {
    const { id } = await approved();
    const gate = pauseCommit();
    const winner = dispatch(id, gate.connect);
    const pid = await Promise.race([gate.entered, winner.then(() => assert.fail('Expected dispatch commit barrier'))]);
    const rejected = deny(exportText(id));
    try {
      await waitForBlocked(pid);
      await changeGrantDuringClaim(false, pid, gate.resume);
    } finally {
      gate.resume();
      await Promise.all([winner, rejected]);
    }
    await deny(exportText(id));
    assert.equal(count(id), 1);
    assert.equal((await attempts(id)).length, 1);
    assert.deepEqual(await audit(id), [{ action: 'dispatch_claim', outcome: 'in_flight' }]);
  });

  await t.test('export first blocks a concurrent real dispatch through reconnect', async () => {
    await setGrant(true);
    const { id } = await approved();
    await setGrant(false);
    const gate = pauseCommit();
    const winner = exportText(id, gate.connect);
    const pid = await Promise.race([gate.entered, winner.then(() => assert.fail('Expected export commit barrier'))]);
    const rejected = deny(dispatch(id));
    try {
      await waitForBlocked(pid);
      await changeGrantDuringClaim(true, pid, gate.resume);
    } finally {
      gate.resume();
      await Promise.all([winner, rejected]);
    }
    assert.deepEqual(await winner, { state: 'exported', text });
    await deny(dispatch(id));
    await deny(exportText(id));
    assert.equal(await state(id), 'exported');
    assert.equal(count(id), 0);
    assert.deepEqual(await attempts(id), []);
    assert.deepEqual(await audit(id), [{ action: 'occurrence_export', outcome: 'exported' }]);
  });

  await t.test('a provider version change, tenant suspension and Manager version change independently deny', async () => {
    const stale = await approved();
    await setGrant(true);
    await deny(dispatch(stale.id));
    const suspended = await approved();
    await owner.query('UPDATE pilot.tenants SET active=false,version=version+1 WHERE id=$1', [tenant.tenant]);
    await deny(dispatch(suspended.id));
    await owner.query('UPDATE pilot.tenants SET active=true,version=version+1 WHERE id=$1', [tenant.tenant]);
    await owner.query('UPDATE pilot.memberships SET version=version+1 WHERE tenant_id=$1 AND id=$2',
      [tenant.tenant, tenant.membership]);
    await deny(dispatch(suspended.id));
    for (const id of [stale.id, suspended.id]) {
      assert.equal(count(id), 0);
      assert.equal(await state(id), 'approved');
      assert.deepEqual(await attempts(id), []);
    }
  });

  assert.equal(await state(control), 'draft');
  assert.equal(fake.createCount(other.tenant, control), 0);
  assert.deepEqual(await read('SELECT synthetic_units FROM pilot.budgets WHERE tenant_id=$1', [tenant.tenant]), [{ synthetic_units: '5' }]);
  assert.deepEqual(await read('SELECT id FROM pilot.budget_reservations WHERE tenant_id=$1', [tenant.tenant]), []);
});
