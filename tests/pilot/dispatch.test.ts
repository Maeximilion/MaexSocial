import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { approveOccurrence, readApprovalProposal } from '../../apps/web/src/routes/content.js';
import { revokeManagementMembership, type ManagementMembershipRevocationContext }
  from '../../apps/web/src/server/management-membership-revocation.js';
import { claimExport } from '../../apps/web/src/server/occurrence-export.js';
import { requireCustomerRequest, type CustomerRequest } from '../../apps/web/src/server/request.js';
import { tokenHash } from '../../apps/web/src/server/session.js';
import { claimDispatch } from '../../apps/worker/src/dispatch.js';
import { reconcileOccurrence } from '../../apps/worker/src/reconcile.js';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';
import { holdOccurrence } from '../../packages/contracts/occurrence.js';
import type { InspectIdentity } from '../../packages/contracts/pilot.js';
import { FakeGbp } from '../../apps/worker/src/fake-gbp.js';
import { occurrence, seedManagementContext, seedTenant } from './fixtures.js';

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
  const session = async (role: 'Manager' | 'Employee', target = tenant) => {
    const binding = { token: randomBytes(32).toString('hex'), csrf: randomBytes(32).toString('hex') };
    await owner.query(`UPDATE pilot.identities i SET verified=true,version=i.version+1 FROM pilot.memberships m
      WHERE m.tenant_id=$1 AND m.role=$2 AND m.identity_id=i.id`, [target.tenant, role]);
    const inserted = await owner.query(`INSERT INTO pilot.sessions(token_hash,csrf_hash,identity_id,identity_version,tenant_id,
      tenant_version,membership_id,membership_version,audience,created_at,last_seen_at,expires_at,mfa_at,mfa_credential_id)
      SELECT $1,$2,i.id,i.version,m.tenant_id,1,m.id,m.version,'customer','2020-01-01T09:55Z','2020-01-01T09:56Z',
        '2020-01-01T11:00Z','2020-01-01T09:59Z','synthetic-otp'
      FROM pilot.memberships m JOIN pilot.identities i ON i.id=m.identity_id WHERE m.tenant_id=$3 AND m.role=$4`,
    [tokenHash(binding.token), tokenHash(binding.csrf), target.tenant, role]);
    assert.equal(inserted.rowCount, 1);
    return binding;
  };
  const binding = await session('Manager');
  const setGrant = (active: boolean, db = owner, target = tenant) => db.query(`UPDATE pilot.locations SET grant_active=$3,version=version+1
    WHERE tenant_id=$1 AND id=$2`, [target.tenant, target.location, active]);
  await setGrant(true);
  const approved = async (due = '2020-01-01T12:00:00.123456Z', target = tenant, customer = binding) => {
    const id = await occurrence(owner, target);
    await owner.query('UPDATE pilot.occurrences SET due_at=$2 WHERE id=$1', [id, due]);
    const reader = await connectFixture();
    const proposal = await (async () => {
      try {
        await reader.query('BEGIN');
        const context = await requireCustomerRequest(reader, customer, clock, inspect, 'read-only');
        return await readApprovalProposal(reader, context, id);
      } finally { await reader.end(); }
    })();
    return { id, approvalId: await approveOccurrence(connectFixture, customer, proposal, clock, inspect) };
  };
  const dispatch = (id: string, connect = connectFixture) => claimDispatch(connect, id, fake);
  const exportText = (id: string, connect = connectFixture) => claimExport(connect, binding, id, clock, inspect);
  const deny = (work: Promise<unknown>) => assert.rejects(work, { message: 'Denied' });
  const count = (id: string, target = tenant) => fake.createCount(target.tenant, id);
  const state = async (id: string) => (await read('SELECT state FROM pilot.occurrences WHERE id=$1', [id]))[0]!.state;
  const attempts = (id: string) => read('SELECT id,approval_id,outcome FROM pilot.attempts WHERE occurrence_id=$1', [id]);
  const audit = (id: string) => read('SELECT action,outcome FROM pilot.audit WHERE occurrence_id=$1', [id]);
  const stepUp = new Date(clock().getTime() - 300_000);
  const operator = await seedManagementContext(owner, tenant.tenant, clock(), stepUp);
  const hold = (id: string, connect = connectFixture, reason = 'Review requested', now = clock) =>
    holdOccurrence(connect, { ...operator, occurrenceId: id }, tenant.tenant, id, reason, now);

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

  async function competeAtCommit<First, Second>(id: string, startFirst: (connect: typeof connectFixture) => Promise<First>,
    startSecond: (connect: typeof connectFixture) => Promise<Second>, target = tenant) {
    const gate = pauseCommit();
    const first = startFirst(gate.connect);
    let second: Promise<Second> | undefined;
    try {
      const pid = await Promise.race([gate.entered, first.then(() => assert.fail('Expected commit barrier'))]);
      let markConnected!: (pid: number) => void;
      const connected = new Promise<number>(resolve => { markConnected = resolve; });
      second = startSecond(async () => {
        const db = await connectFixture();
        try {
          markConnected((await db.query('SELECT pg_backend_pid() AS pid')).rows[0]!.pid);
          return db;
        } catch (error) {
          await db.end();
          throw error;
        }
      });
      const waiting = connected.then(waitingPid => waitForBlocked(pid, waitingPid));
      await Promise.race([waiting, second.then(() => assert.fail('Competing transaction finished before commit'))]);
      assert.equal(await state(id), 'approved');
      assert.deepEqual(await attempts(id), []);
      assert.deepEqual(await audit(id), []);
      assert.equal(count(id, target), 0);
    } finally {
      gate.resume();
      await Promise.allSettled([first, second]);
    }
    return Promise.all([first, second!]);
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
        const { FakeGbp } = require('./dist/pilot/apps/worker/src/fake-gbp.js');
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

  await t.test('operator hold commits first, blocking dispatch and both customer exports while A2 can dispatch', async () => {
    const { id } = await approved();
    const otherLocation = randomUUID();
    await owner.query(`INSERT INTO pilot.locations(tenant_id,id,provider_location,grant_active)
      VALUES($1,$2,'fake-location-a2',true)`, [tenant.tenant, otherLocation]);
    const a2 = await approved(undefined, { ...tenant, location: otherLocation });
    const employee = await session('Employee');

    const [held] = await competeAtCommit(id, connect => hold(id, connect), connect => deny(dispatch(id, connect)));
    assert.equal(held, 'held');
    await setGrant(false);
    try {
      for (const [customer, role] of [[employee, 'Employee'], [binding, 'Manager']] as const) {
        const reader = await connectFixture();
        try {
          await reader.query('BEGIN');
          const current = await requireCustomerRequest(reader, customer, clock, inspect, 'read-only');
          assert.equal(current.role, role);
          assert.equal(current.tenantId, tenant.tenant);
        } finally { await reader.end(); }
        await deny(claimExport(connectFixture, customer, id, clock, inspect));
      }
      assert.equal(await state(id), 'held');
      assert.deepEqual(await attempts(id), []);
      assert.equal(count(id), 0);
      assert.deepEqual(await audit(id), [{ action: 'occurrence_hold', outcome: 'held' }]);

      assert.equal(await state(a2.id), 'approved');
      const { attemptId } = await dispatch(a2.id);
      await deny(dispatch(a2.id));
      assert.equal(await state(a2.id), 'in_flight');
      assert.deepEqual(await attempts(a2.id), [{ id: attemptId, approval_id: a2.approvalId, outcome: 'unknown' }]);
      assert.deepEqual(await audit(a2.id), [{ action: 'dispatch_claim', outcome: 'in_flight' }]);
      assert.equal(count(a2.id), 1);
    } finally { await setGrant(true); }
  });

  await t.test('dispatch commits first, preserving the original attempt through hold and read-only reconciliation', async () => {
    const { id, approvalId } = await approved();
    const [{ state: claimedState, attemptId }, held] = await competeAtCommit(id,
      connect => dispatch(id, connect), connect => hold(id, connect));
    assert.equal(held, 'in_flight');
    assert.equal(claimedState, 'in_flight');
    assert.equal(await state(id), 'in_flight');
    const claimed = { id: attemptId, approval_id: approvalId, outcome: 'unknown' };
    assert.deepEqual(await attempts(id), [claimed]);

    const reopened = new FakeGbp(directory);
    try {
      assert.equal(reopened.createCount(tenant.tenant, id), 1);
      await deny(dispatch(id));
      assert.equal(await reconcileOccurrence(connectFixture, id, reopened), 'confirmed');
      assert.equal(await hold(id), 'confirmed');
      assert.deepEqual(await attempts(id), [{ ...claimed, outcome: 'confirmed' }]);
      assert.equal(await state(id), 'confirmed');
      assert.equal(reopened.createCount(tenant.tenant, id), 1);
      assert.deepEqual(await audit(id), [{ action: 'dispatch_claim', outcome: 'in_flight' }]);
    } finally { reopened.close(); }
  });

  await t.test('stale proof, missing reason and failed hold audit leave a due approval dispatchable', async () => {
    const { id, approvalId } = await approved();
    const unchanged = async () => {
      assert.equal(await state(id), 'approved');
      assert.deepEqual(await audit(id), []);
      assert.deepEqual(await attempts(id), []);
      assert.equal(count(id), 0);
    };
    await deny(hold(id, connectFixture, 'Review requested', () => new Date(clock().getTime() + 1)));
    await unchanged();
    await deny(hold(id, connectFixture, '   '));
    await unchanged();
    await owner.query(`ALTER TABLE pilot.audit ADD CONSTRAINT test_dispatch_hold_audit_failure
      CHECK (reason <> 'Synthetic dispatch hold audit failure')`);
    try {
      await assert.rejects(hold(id, connectFixture, 'Synthetic dispatch hold audit failure'),
        { code: '23514', constraint: 'test_dispatch_hold_audit_failure' });
      await unchanged();
    } finally { await owner.query('ALTER TABLE pilot.audit DROP CONSTRAINT test_dispatch_hold_audit_failure'); }

    const { attemptId } = await dispatch(id);
    assert.deepEqual(await attempts(id), [{ id: attemptId, approval_id: approvalId, outcome: 'unknown' }]);
    assert.deepEqual(await audit(id), [{ action: 'dispatch_claim', outcome: 'in_flight' }]);
    assert.equal(count(id), 1);
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

  await t.test('Manager revocation and dispatch serialize without affecting another tenant', async t => {
    const controlManager = await session('Manager', other);
    await setGrant(true, owner, other);
    const independent = await approved(undefined, other, controlManager);
    const occurrenceBinding = (id: string) => read('SELECT state,approval_id FROM pilot.occurrences WHERE id=$1', [id]);
    const membership = (tenantId: string, id: string) => read(
      'SELECT role,active,version FROM pilot.memberships WHERE tenant_id=$1 AND id=$2', [tenantId, id]);
    const revokedAt = (customer: CustomerRequest) =>
      read('SELECT revoked_at FROM pilot.sessions WHERE token_hash=$1', [tokenHash(customer.token)]);
    const currentCustomer = async (customer: CustomerRequest) => {
      const db = await connectFixture();
      try {
        await db.query('BEGIN');
        return await requireCustomerRequest(db, customer, clock, inspect, 'read-only');
      } finally { await db.end(); }
    };

    for (const first of ['revocation', 'dispatch'] as const) {
      await t.test(`${first} commits first`, async () => {
        const target = await seedTenant(owner);
        const manager = await session('Manager', target);
        const employee = await session('Employee', target);
        await setGrant(true, owner, target);
        const { id, approvalId } = await approved(undefined, target, manager);
        const admin = await seedManagementContext(owner, target.tenant, clock(), stepUp);
        const proof: ManagementMembershipRevocationContext = {
          ...admin, action: 'membership_revoke', membershipId: target.membership, membershipVersion: 1
        };
        const reason = 'Synthetic Manager revocation';
        const revoke = (connect: typeof connectFixture, membershipId = target.membership) =>
          revokeManagementMembership(connect, { ...proof, membershipId }, target.tenant, membershipId, reason, clock, new Map());

        let claim: Awaited<ReturnType<typeof claimDispatch>> | undefined;
        if (first === 'revocation') {
          const [revoked] = await competeAtCommit(id, revoke, connect => deny(dispatch(id, connect)), target);
          assert.equal(revoked, true);
        } else {
          const [claimed, revoked] = await competeAtCommit(id, connect => dispatch(id, connect), revoke, target);
          assert.equal(claimed.state, 'in_flight');
          assert.equal(revoked, true);
          claim = claimed;
        }

        assert.deepEqual(await membership(target.tenant, target.membership), [{ role: 'Manager', active: false, version: 2 }]);
        assert.deepEqual(await revokedAt(manager), [{ revoked_at: clock() }]);
        assert.deepEqual(await revokedAt(employee), [{ revoked_at: null }]);
        await deny(currentCustomer(manager));
        const currentEmployee = await currentCustomer(employee);
        assert.equal(currentEmployee.tenantId, target.tenant);
        assert.equal(currentEmployee.role, 'Employee');
        assert.equal(await revoke(connectFixture), false);
        assert.deepEqual(await read(`SELECT actor_id,device_id,membership_id,membership_version,action,reason,outcome,created_at
          FROM pilot.audit WHERE tenant_id=$1 AND action='membership_revoked'`, [target.tenant]), [{
          actor_id: admin.identityId, device_id: admin.deviceId, membership_id: target.membership, membership_version: 2,
          action: 'membership_revoked', reason, outcome: 'revoked', created_at: clock()
        }]);

        await deny(dispatch(id));
        // With access gone, a current Employee would otherwise be eligible to export.
        await setGrant(false, owner, target);
        await deny(claimExport(connectFixture, employee, id, clock, inspect));
        let readbacks = 0;
        const readback = {
          async readback(attempt: Parameters<FakeGbp['readback']>[0]) {
            readbacks++;
            assert.deepEqual(attempt, { tenantId: target.tenant, occurrenceId: id, attemptId: claim?.attemptId,
              location: 'fake-location' });
            return fake.readback(attempt);
          }
        };
        if (claim) {
          const original = { id: claim.attemptId, approval_id: approvalId, outcome: 'unknown' };
          assert.deepEqual(await occurrenceBinding(id), [{ state: 'in_flight', approval_id: approvalId }]);
          assert.deepEqual(await attempts(id), [original]);
          assert.equal(count(id, target), 1);
          assert.equal(await reconcileOccurrence(connectFixture, id, readback), 'confirmed');
          assert.equal(await reconcileOccurrence(connectFixture, id, readback), 'confirmed');
          assert.equal(readbacks, 1);
          assert.deepEqual(await occurrenceBinding(id), [{ state: 'confirmed', approval_id: approvalId }]);
          assert.deepEqual(await attempts(id), [{ ...original, outcome: 'confirmed' }]);
          assert.deepEqual(await audit(id), [{ action: 'dispatch_claim', outcome: 'in_flight' }]);
          assert.equal(count(id, target), 1);
        } else {
          assert.equal(await reconcileOccurrence(connectFixture, id, readback), null);
          assert.equal(readbacks, 0);
          assert.deepEqual(await occurrenceBinding(id), [{ state: 'draft', approval_id: null }]);
          assert.deepEqual(await attempts(id), []);
          assert.deepEqual(await audit(id), []);
          assert.equal(count(id, target), 0);
        }

        await deny(revoke(connectFixture, other.membership));
        assert.deepEqual(await membership(other.tenant, other.membership), [{ role: 'Manager', active: true, version: 1 }]);
        assert.deepEqual(await revokedAt(controlManager), [{ revoked_at: null }]);
        const currentControl = await currentCustomer(controlManager);
        assert.equal(currentControl.tenantId, other.tenant);
        assert.equal(currentControl.role, 'Manager');
        assert.deepEqual(await occurrenceBinding(independent.id), [{ state: 'approved', approval_id: independent.approvalId }]);
        assert.deepEqual(await attempts(independent.id), []);
        assert.deepEqual(await audit(independent.id), []);
        assert.deepEqual(await read("SELECT id FROM pilot.audit WHERE tenant_id=$1 AND action='membership_revoked'", [other.tenant]), []);
        assert.equal(count(independent.id, other), 0);
      });
    }
  });

  assert.equal(await state(control), 'draft');
  assert.equal(fake.createCount(other.tenant, control), 0);
  assert.deepEqual(await read('SELECT synthetic_units FROM pilot.budgets WHERE tenant_id=$1', [tenant.tenant]), [{ synthetic_units: '5' }]);
  assert.deepEqual(await read('SELECT id FROM pilot.budget_reservations WHERE tenant_id=$1', [tenant.tenant]), []);
});
