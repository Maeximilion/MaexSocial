import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { test } from 'node:test';
import { approveOccurrence, readApprovalProposal, withdrawApproval } from '../../apps/web/src/routes/content.js';
import { claimExport } from '../../apps/web/src/server/occurrence-export.js';
import { claimDispatch } from '../../apps/worker/src/dispatch.js';
import { reconcileOccurrence } from '../../apps/worker/src/reconcile.js';
import { requireCustomerRequest } from '../../apps/web/src/server/request.js';
import { tokenHash } from '../../apps/web/src/server/session.js';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';
import { holdOccurrence } from '../../packages/contracts/occurrence.js';
import type { InspectIdentity } from '../../packages/contracts/pilot.js';
import { FakeGbp } from './fake-gbp.js';
import { occurrence, seedManagementContext, seedTenant } from './fixtures.js';

const clock = () => new Date('2030-01-01T10:00:00Z');
const inspect: InspectIdentity = async subject => ({
  subject, verified: true, enabled: true, requiredActions: [], credentials: [{ id: 'synthetic-otp', type: 'otp' }]
});
const exported = { state: 'exported', text: 'Invented plain text' };

test('private terminal export commits approved text only under current authority', async t => {
  if (process.env.PILOT_CONTAINER !== '1') {
    console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/occurrence-export.test.js']));
    return;
  }

  const providerDirectory = await mkdtemp(join('/dev/shm', 'maex-252-provider-'));
  let fake: FakeGbp | undefined;
  t.after(async () => {
    fake?.close();
    await rm(providerDirectory, { recursive: true, force: true });
  });
  fake = new FakeGbp(providerDirectory);
  const owner = await connectFixture(true);
  try {
    const a = await seedTenant(owner), b = await seedTenant(owner);
    const session = async (tenantId: string, role: 'Manager' | 'Employee', identityId?: string) => {
      const binding = { token: randomBytes(32).toString('hex'), csrf: randomBytes(32).toString('hex') };
      await owner.query(`UPDATE pilot.identities i SET verified=true,version=i.version+1 FROM pilot.memberships m
        WHERE m.tenant_id=$1 AND m.role=$2 AND m.identity_id=i.id AND NOT i.verified
          AND ($3::uuid IS NULL OR i.id=$3)`, [tenantId, role, identityId]);
      await owner.query(`INSERT INTO pilot.sessions(token_hash,csrf_hash,identity_id,identity_version,tenant_id,tenant_version,
        membership_id,membership_version,audience,created_at,last_seen_at,expires_at,mfa_at,mfa_credential_id)
        SELECT $1,$2,i.id,i.version,t.id,t.version,m.id,m.version,'customer',
          '2030-01-01T09:55Z','2030-01-01T09:56Z','2030-01-01T11:00Z','2030-01-01T09:59Z','synthetic-otp'
        FROM pilot.memberships m JOIN pilot.identities i ON i.id=m.identity_id JOIN pilot.tenants t ON t.id=m.tenant_id
        WHERE t.id=$3 AND m.role=$4 AND ($5::uuid IS NULL OR i.id=$5)`,
      [tokenHash(binding.token), tokenHash(binding.csrf), tenantId, role, identityId]);
      return binding;
    };
    const manager = await session(a.tenant, 'Manager'), employee = await session(a.tenant, 'Employee');
    const outside = await session(b.tenant, 'Manager');
    const preview = async (id: string, binding = manager) => {
      const db = await connectFixture();
      try {
        await db.query('BEGIN');
        return await readApprovalProposal(db, await requireCustomerRequest(db, binding, clock, inspect, 'read-only'), id);
      } finally {
        await db.query('ROLLBACK');
        await db.end();
      }
    };
    const approve = (proposal: Awaited<ReturnType<typeof preview>>, binding = manager) =>
      approveOccurrence(connectFixture, binding, proposal, clock, inspect);
    const approved = async (tenant = a, binding = manager, due = false) => {
      const id = await occurrence(owner, tenant);
      if (due) await owner.query("UPDATE pilot.occurrences SET due_at='2020-01-01T12:00Z' WHERE id=$1", [id]);
      const proposal = await preview(id, binding);
      return { id, proposal, approvalId: await approve(proposal, binding) };
    };
    const claim = (id: string, binding = employee) => claimExport(connectFixture, binding, id, clock, inspect);
    const rows = async (sql: string, values: unknown[]) => (await owner.query(sql, values)).rows;
    const state = (id: string) => rows('SELECT state,approval_id FROM pilot.occurrences WHERE id=$1', [id]);
    const audit = (id: string) => rows(`SELECT actor_id,action,outcome FROM pilot.audit WHERE occurrence_id=$1 ORDER BY id`, [id]);
    const denied = async (id: string, binding = employee) => {
      const before = [await state(id), await audit(id)];
      await assert.rejects(claim(id, binding), { message: 'Denied' });
      assert.deepEqual([await state(id), await audit(id)], before);
    };
    const control = await approved(b, outside);
    const controlState = await state(control.id);
    const first = await approved();
    const concurrent = await approved();
    const rollback = await approved();
    const attempted = await approved();
    const stale = await approved();
    const initialSessions = await rows(`SELECT token_hash,last_seen_at FROM pilot.sessions
      WHERE tenant_id=ANY($1::uuid[]) ORDER BY token_hash`, [[a.tenant, b.tenant]]);

    await t.test('only the original Manager with current enrolled MFA can withdraw and reapprove', async () => {
      const tenant = await seedTenant(owner);
      const original = await session(tenant.tenant, 'Manager');
      const peerId = randomUUID();
      await owner.query('INSERT INTO pilot.identities(id,subject) VALUES($1,$1::uuid::text)', [peerId]);
      await owner.query("INSERT INTO pilot.memberships(tenant_id,identity_id,role) VALUES($1,$2,'Manager')",
        [tenant.tenant, peerId]);
      const peer = await session(tenant.tenant, 'Manager', peerId);
      const worker = await session(tenant.tenant, 'Employee');
      const target = await approved(tenant, original);
      const other = await approved(tenant, original);
      const withdraw = (binding = original, now = clock, identity = inspect, id = target.approvalId) =>
        withdrawApproval(connectFixture, binding, target.id, id, now, identity);
      const reject = (operation: Promise<unknown>) => assert.rejects(operation, { message: 'Denied' });
      const history = () => rows(`SELECT actor_id,action,approval_id,outcome FROM pilot.audit
        WHERE occurrence_id=$1`, [target.id]);

      await reject(withdraw(peer));
      await reject(withdraw(worker));
      await reject(withdraw(outside));
      await reject(withdraw({ ...original, csrf: peer.csrf }));
      const management = await seedManagementContext(owner, tenant.tenant, clock(), clock());
      const operator = { token: randomBytes(32).toString('hex'), csrf: original.csrf };
      await owner.query('UPDATE pilot.sessions SET token_hash=$2 WHERE id=$1', [management.sessionId, tokenHash(operator.token)]);
      await reject(withdraw(operator));
      await reject(withdraw(original, () => new Date('2030-01-01T10:04:00.001Z')));
      await reject(withdraw(original, clock, async subject => ({ ...await inspect(subject), credentials: [] })));
      await reject(withdraw(original, clock, inspect, other.approvalId));
      assert.deepEqual(await history(), []);
      assert.deepEqual(await state(target.id), [{ state: 'approved', approval_id: target.approvalId }]);

      assert.deepEqual((await Promise.all([withdraw(), withdraw()])).sort(), [false, true]);
      assert.deepEqual(await state(target.id), [{ state: 'draft', approval_id: null }]);
      await reject(claim(target.id, worker));
      await reject(claim(target.id, original));
      await reject(approve(target.proposal, original));
      const current = await preview(target.id, original);
      const next = await approve(current, original);
      assert.notEqual(next, target.approvalId);
      assert.equal(await approve(current, original), next);
      assert.equal(await withdraw(), false);
      await reject(approve(target.proposal, original));
      assert.deepEqual(await state(target.id), [{ state: 'approved', approval_id: next }]);
      assert.deepEqual(await history(), [{ actor_id: tenant.user, action: 'approval_withdrawal',
        approval_id: target.approvalId, outcome: 'withdrawn' }]);
      assert.equal((await rows('SELECT id FROM pilot.approvals WHERE occurrence_id=$1', [target.id])).length, 2);
      assert.deepEqual(await state(control.id), controlState);
      assert.deepEqual(await state(other.id), [{ state: 'approved', approval_id: other.approvalId }]);

      await owner.query('UPDATE pilot.memberships SET version=version+1 WHERE tenant_id=$1 AND id=$2', [tenant.tenant, tenant.membership]);
      await reject(withdraw(original, clock, inspect, next));
      const newMembership = await session(tenant.tenant, 'Manager', tenant.user);
      await reject(withdraw(newMembership, clock, inspect, next));
      const lifecycle = await approved(tenant, newMembership);
      await owner.query('UPDATE pilot.tenants SET active=false,version=version+1 WHERE id=$1', [tenant.tenant]);
      await reject(withdrawApproval(connectFixture, newMembership, lifecycle.id, lifecycle.approvalId, clock, inspect));
      await owner.query('UPDATE pilot.tenants SET active=true,version=version+1 WHERE id=$1', [tenant.tenant]);
      const newTenant = await session(tenant.tenant, 'Manager', tenant.user);
      await reject(withdrawApproval(connectFixture, newTenant, lifecycle.id, lifecycle.approvalId, clock, inspect));
      assert.deepEqual(await state(lifecycle.id), [{ state: 'approved', approval_id: lifecycle.approvalId }]);
    });

    await t.test('withdrawal and claim/export serialize without changing held, quarantined or committed effects', async () => {
      const tenant = await seedTenant(owner);
      const original = await session(tenant.tenant, 'Manager'), worker = await session(tenant.tenant, 'Employee');
      const [{ id: connected }] = await rows(`INSERT INTO pilot.locations(tenant_id,provider_location,grant_active)
        VALUES($1,'withdrawal-connected-location',true) RETURNING id`, [tenant.tenant]);
      const dispatchable = { ...tenant, location: connected };
      const withdrawalWinsDispatch = await approved(dispatchable, original, true);
      const dispatchWinsWithdrawal = await approved(dispatchable, original, true);
      const withdrawalWinsExport = await approved(tenant, original);
      const exportWinsWithdrawal = await approved(tenant, original);
      const held = await approved(tenant, original), quarantined = await approved(tenant, original);
      const withdraw = (target: typeof held, identity = inspect) =>
        withdrawApproval(connectFixture, original, target.id, target.approvalId, clock, identity);
      const reject = (operation: Promise<unknown>) => assert.rejects(operation, { message: 'Denied' });
      const race = async <T>(first: (i: InspectIdentity) => Promise<T>, second: () => Promise<unknown>, expected: T) => {
        let lockedReady!: () => void, continueWinner!: () => void;
        const ready = new Promise<void>(resolve => { lockedReady = resolve; });
        const resume = new Promise<void>(resolve => { continueWinner = resolve; });
        let inspections = 0;
        const locked: InspectIdentity = async subject => {
          if (++inspections === 2) {
            lockedReady();
            await resume;
          }
          return inspect(subject);
        };
        const winning = first(locked);
        await Promise.race([ready, winning]);
        const losing = reject(second());
        try {
          let blocked = false;
          for (let n = 0; n < 80 && !blocked; n++) {
            blocked = (await owner.query("SELECT 1 FROM pg_stat_activity WHERE usename='pilot_app' AND cardinality(pg_blocking_pids(pid))>0")).rowCount! > 0;
            if (!blocked) await setTimeout(25);
          }
          assert.equal(blocked, true);
        } finally {
          continueWinner();
          assert.deepEqual(await winning, expected);
          await losing;
        }
      };
      const [{ stopped }] = await rows('SELECT stopped FROM pilot.dispatch_control', []);
      await owner.query('UPDATE pilot.dispatch_control SET stopped=false');
      try {
        const dispatch = (id: string) => claimDispatch(connectFixture, id, fake!);
        await race(i => withdraw(withdrawalWinsDispatch, i), () => dispatch(withdrawalWinsDispatch.id), true);
        assert.equal(fake!.createCount(tenant.tenant, withdrawalWinsDispatch.id), 0);
        assert.deepEqual(await rows('SELECT id FROM pilot.attempts WHERE occurrence_id=$1', [withdrawalWinsDispatch.id]), []);
        const committed = await dispatch(dispatchWinsWithdrawal.id);
        await reject(withdraw(dispatchWinsWithdrawal));
        assert.deepEqual(await rows('SELECT id,approval_id FROM pilot.attempts WHERE occurrence_id=$1', [dispatchWinsWithdrawal.id]),
          [{ id: committed.attemptId, approval_id: dispatchWinsWithdrawal.approvalId }]);
        assert.equal(await reconcileOccurrence(connectFixture, dispatchWinsWithdrawal.id, fake!), 'pending');
        assert.equal(fake!.createCount(tenant.tenant, dispatchWinsWithdrawal.id), 1);

        await race(i => withdraw(withdrawalWinsExport, i), () => claim(withdrawalWinsExport.id, worker), true);
        await reject(claim(withdrawalWinsExport.id, original));
        await race(i => claimExport(connectFixture, worker, exportWinsWithdrawal.id, clock, i),
          () => withdraw(exportWinsWithdrawal), exported);
        assert.deepEqual(await claim(exportWinsWithdrawal.id, original), exported);
        assert.deepEqual(await state(exportWinsWithdrawal.id), [{ state: 'exported', approval_id: exportWinsWithdrawal.approvalId }]);
        for (const target of [withdrawalWinsExport, exportWinsWithdrawal]) assert.equal(fake!.createCount(tenant.tenant, target.id), 0);

        const operator = await seedManagementContext(owner, tenant.tenant, clock(), clock());
        assert.equal(await holdOccurrence(connectFixture, { ...operator, occurrenceId: held.id },
          tenant.tenant, held.id, 'Synthetic hold', clock), 'held');
        await owner.query("UPDATE pilot.occurrences SET state='quarantined' WHERE id=$1", [quarantined.id]);
        await reject(withdraw(held));
        await reject(withdraw(quarantined));
        assert.deepEqual(await state(held.id), [{ state: 'held', approval_id: held.approvalId }]);
        assert.deepEqual(await state(quarantined.id), [{ state: 'quarantined', approval_id: quarantined.approvalId }]);
      } finally {
        await owner.query('UPDATE pilot.dispatch_control SET stopped=$1', [stopped]);
      }
    });

    await t.test('Employee exports the exact snapshot and Manager repeats without another transition', async () => {
      assert.deepEqual(await claim(first.id), exported);
      const committed = [{ state: 'exported', approval_id: first.approvalId }];
      assert.deepEqual(await state(first.id), committed);
      assert.deepEqual(await claim(first.id, manager), exported);
      assert.deepEqual(await state(first.id), committed);
      const [event, ...duplicates] = await audit(first.id);
      const [actor] = await rows("SELECT identity_id FROM pilot.memberships WHERE tenant_id=$1 AND role='Employee'", [a.tenant]);
      assert.deepEqual(event, { actor_id: actor.identity_id, action: 'occurrence_export', outcome: 'exported' });
      assert.deepEqual(duplicates, []);
      await denied(first.id, outside);
    });

    await t.test('concurrent authorized callers converge on one committed transition', async () => {
      assert.deepEqual(await Promise.all([claim(concurrent.id), claim(concurrent.id, manager)]), [exported, exported]);
      assert.deepEqual(await state(concurrent.id), [{ state: 'exported', approval_id: concurrent.approvalId }]);
      assert.equal((await audit(concurrent.id)).length, 1);
    });

    await t.test('a deferred audit failure at commit releases no result and rolls both records back', async () => {
      await owner.query(`CREATE CONSTRAINT TRIGGER fixture_export_commit_failure AFTER INSERT ON pilot.audit
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pilot.reject_mutation()`);
      try {
        await assert.rejects(claim(rollback.id), { code: '23514' });
        assert.deepEqual(await state(rollback.id), [{ state: 'approved', approval_id: rollback.approvalId }]);
        assert.deepEqual(await audit(rollback.id), []);
      } finally {
        await owner.query('DROP TRIGGER fixture_export_commit_failure ON pilot.audit');
      }
      assert.deepEqual(await claim(rollback.id), exported);
    });

    await t.test('an attempt that commits while export waits wins', async () => {
      const blocker = await connectFixture();
      try {
        await blocker.query('BEGIN');
        await blocker.query('SELECT id FROM pilot.occurrences WHERE id=$1 FOR UPDATE', [attempted.id]);
        await blocker.query('INSERT INTO pilot.attempts(tenant_id,occurrence_id,approval_id) VALUES($1,$2,$3)',
          [a.tenant, attempted.id, attempted.approvalId]);
        const pid = (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        const losingExport = assert.rejects(claim(attempted.id), { message: 'Denied' });
        try {
          let waiting = false;
          for (let n = 0; n < 80 && !waiting; n++) {
            waiting = (await owner.query('SELECT 1 FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))', [pid])).rowCount === 1;
            if (!waiting) await setTimeout(25);
          }
          assert.equal(waiting, true);
          await blocker.query('COMMIT');
        } finally {
          await blocker.query('ROLLBACK');
          await losingExport;
        }
        assert.deepEqual(await state(attempted.id), [{ state: 'approved', approval_id: attempted.approvalId }]);
        assert.deepEqual(await audit(attempted.id), []);
      } finally { await blocker.end(); }
    });

    await t.test('state, hold history, audience, approval binding and active Google grant independently deny', async () => {
      const held = await approved(), quarantined = await approved(), previouslyHeld = await approved();
      await owner.query("UPDATE pilot.occurrences SET state='held' WHERE id=$1", [held.id]);
      await owner.query("UPDATE pilot.occurrences SET state='quarantined' WHERE id=$1", [quarantined.id]);
      await owner.query(`INSERT INTO pilot.audit(tenant_id,actor_id,occurrence_id,action,reason,outcome)
        VALUES($1,$2,$3,'occurrence_hold','Synthetic earlier hold','held')`, [a.tenant, a.user, previouslyHeld.id]);
      for (const id of [held.id, quarantined.id, previouslyHeld.id, control.id]) await denied(id);

      const operator = await seedManagementContext(owner, a.tenant, clock(), clock());
      const management = { token: randomBytes(32).toString('hex'), csrf: employee.csrf };
      await owner.query('UPDATE pilot.sessions SET token_hash=$2 WHERE id=$1', [operator.sessionId, tokenHash(management.token)]);
      await denied(stale.id, management);
      await denied(stale.id, { ...employee, csrf: outside.csrf });

      await owner.query("UPDATE pilot.occurrences SET due_at=due_at+interval '1 microsecond' WHERE id=$1", [stale.id]);
      await denied(stale.id);
      await owner.query("UPDATE pilot.occurrences SET due_at=due_at-interval '1 microsecond' WHERE id=$1", [stale.id]);
      await owner.query('UPDATE pilot.locations SET version=version+1 WHERE tenant_id=$1 AND id=$2', [a.tenant, a.location]);
      await denied(stale.id);
      await owner.query('UPDATE pilot.locations SET grant_active=true,version=version+1 WHERE tenant_id=$1 AND id=$2',
        [a.tenant, a.location]);
      const connected = await approved();
      await denied(connected.id);
      await owner.query(`UPDATE pilot.locations SET grant_active=false,version=version+1,provider_location='Different destination'
        WHERE tenant_id=$1 AND id=$2`, [a.tenant, a.location]);
      await denied(connected.id);
    });

    await t.test('both roles export revision two after a recorded grant loss and reconnect blocks further downloads', async () => {
      const c = await seedTenant(owner);
      const approving = await session(c.tenant, 'Manager'), exporting = await session(c.tenant, 'Employee');
      await owner.query("INSERT INTO pilot.draft_revisions(tenant_id,draft_id,revision,text) VALUES($1,$2,2,'Second approved revision')",
        [c.tenant, c.draft]);
      const setAccess = (active: boolean) => owner.query(`UPDATE pilot.locations SET grant_active=$3,version=version+1
        WHERE tenant_id=$1 AND id=$2`, [c.tenant, c.location, active]);
      await setAccess(true);
      const employeeExport = await approved(c, approving), managerExport = await approved(c, approving);
      const legacy = await approved(c, approving);
      await owner.query(`WITH historical AS (
        INSERT INTO pilot.approvals(tenant_id,occurrence_id,draft_id,revision_id,location_id,provider_location,
          membership_id,membership_version,grant_version,due_at,timezone,mfa_at,tenant_version)
        SELECT tenant_id,occurrence_id,draft_id,revision_id,location_id,provider_location,membership_id,membership_version,
          grant_version,due_at,timezone,mfa_at,tenant_version FROM pilot.approvals WHERE tenant_id=$1 AND id=$2 RETURNING id
      ) UPDATE pilot.occurrences SET approval_id=historical.id FROM historical WHERE pilot.occurrences.id=$3`,
      [c.tenant, legacy.approvalId, legacy.id]);
      await denied(employeeExport.id, exporting);
      await setAccess(false);
      const expected = { state: 'exported', text: 'Second approved revision' };
      assert.deepEqual(await claim(employeeExport.id, exporting), expected);
      assert.deepEqual(await claim(managerExport.id, approving), expected);
      assert.deepEqual(await claim(employeeExport.id, approving), expected);
      await denied(legacy.id, exporting);
      await setAccess(true);
      for (const target of [employeeExport, managerExport]) {
        await denied(target.id, exporting);
        assert.deepEqual(await state(target.id), [{ state: 'exported', approval_id: target.approvalId }]);
        assert.equal(fake!.createCount(c.tenant, target.id), 0);
      }
    });

    await t.test('new revision, stale approving Manager and revoked caller require current authority', async () => {
      const oldRevision = await approved();
      await owner.query("INSERT INTO pilot.draft_revisions(tenant_id,draft_id,revision,text) VALUES($1,$2,2,'Synthetic newer text')",
        [a.tenant, a.draft]);
      await denied(oldRevision.id);
      const reapproved = await approved();
      await owner.query('UPDATE pilot.memberships SET version=version+1 WHERE tenant_id=$1 AND id=$2', [a.tenant, a.membership]);
      await denied(reapproved.id);
      const currentManager = await session(a.tenant, 'Manager');
      const newExport = await approved(a, currentManager);
      assert.deepEqual(await claim(newExport.id), { state: 'exported', text: 'Synthetic newer text' });
      await owner.query('UPDATE pilot.sessions SET revoked_at=$2 WHERE token_hash=$1', [tokenHash(employee.token), clock()]);
      await denied(newExport.id);
      assert.deepEqual(await claim(newExport.id, currentManager), { state: 'exported', text: 'Synthetic newer text' });
    });

    await t.test('tenant reactivation requires a fresh private approval and preserves existing history', async () => {
      const tenant = await seedTenant(owner), independent = await seedTenant(owner);
      const originalManager = await session(tenant.tenant, 'Manager'), originalEmployee = await session(tenant.tenant, 'Employee');
      const otherManager = await session(independent.tenant, 'Manager');
      const exportable = await approved(tenant, originalManager), terminal = await approved(tenant, originalManager);
      const held = await approved(tenant, originalManager), quarantined = await approved(tenant, originalManager);
      const pendingPreview = await preview(await occurrence(owner, tenant), originalManager);
      assert.deepEqual(await claim(terminal.id, originalEmployee), exported);
      const operator = await seedManagementContext(owner, tenant.tenant, clock(), clock());
      assert.equal(await holdOccurrence(connectFixture, { ...operator, occurrenceId: held.id },
        tenant.tenant, held.id, 'Synthetic hold', clock), 'held');
      await owner.query("UPDATE pilot.occurrences SET state='quarantined' WHERE id=$1", [quarantined.id]);

      // Give dispatch its own destination so the export cases keep an unavailable grant.
      const [{ id: connected }] = await rows(`INSERT INTO pilot.locations(tenant_id,provider_location,grant_active)
        VALUES($1,'synthetic-connected-location',true) RETURNING id`, [tenant.tenant]);
      const send = await approved({ ...tenant, location: connected }, originalManager, true);
      const inFlight = await approved({ ...tenant, location: connected }, originalManager, true);
      const stopBefore = (await rows('SELECT stopped FROM pilot.dispatch_control', []))[0].stopped;
      await owner.query('UPDATE pilot.dispatch_control SET stopped=false');
      try {
        const dispatch = (id: string) => claimDispatch(connectFixture, id, fake!);
        const reject = (operation: Promise<unknown>) => assert.rejects(operation, { message: 'Denied' });
        const attempt = await dispatch(inFlight.id);
        const protectedTargets = [held, terminal, quarantined, inFlight];
        const protectedState = () => rows(`SELECT o.id,o.state,o.approval_id,
          (SELECT jsonb_agg(h ORDER BY h.id) FROM pilot.audit h WHERE h.occurrence_id=o.id) AS history
          FROM pilot.occurrences o WHERE o.id=ANY($1::uuid[]) ORDER BY o.id`, [protectedTargets.map(target => target.id)]);
        const before = await protectedState();
        const sendState = await state(send.id);
        const setStatus = (active: boolean) => owner.query('UPDATE pilot.tenants SET active=$2,version=version+1 WHERE id=$1',
          [tenant.tenant, active]);
        await setStatus(false);
        await reject(preview(pendingPreview.occurrenceId, originalManager));
        await reject(dispatch(send.id));
        const other = await approved(independent, otherManager);
        assert.deepEqual(await claim(other.id, otherManager), exported);

        await setStatus(true);
        const currentManager = await session(tenant.tenant, 'Manager'), currentEmployee = await session(tenant.tenant, 'Employee');
        await reject(preview(pendingPreview.occurrenceId, originalManager));
        await reject(approve(pendingPreview, currentManager));
        await reject(approve(send.proposal, currentManager));
        await reject(dispatch(send.id));
        await denied(exportable.id, currentEmployee);
        await denied(terminal.id, currentEmployee);
        assert.deepEqual(await state(send.id), sendState);
        assert.deepEqual(await audit(send.id), []);
        assert.equal(fake!.createCount(tenant.tenant, send.id), 0);
        for (const target of protectedTargets) await reject(preview(target.id, currentManager));
        assert.deepEqual(await protectedState(), before);

        const currentPreview = await preview(send.id, currentManager);
        assert.deepEqual([send.proposal.tenantVersion, currentPreview.tenantVersion], [1, 3]);
        const freshApproval = await approve(currentPreview, currentManager);
        assert.notEqual(freshApproval, send.approvalId);
        assert.equal(await approve(currentPreview, currentManager), freshApproval);
        await reject(preview(send.id, currentManager));
        assert.deepEqual(await rows('SELECT id,tenant_version FROM pilot.approvals WHERE occurrence_id=$1 ORDER BY tenant_version',
          [send.id]), [{ id: send.approvalId, tenant_version: 1 }, { id: freshApproval, tenant_version: 3 }]);
        const freshAttempt = await dispatch(send.id);
        assert.deepEqual(await rows('SELECT id,approval_id FROM pilot.attempts WHERE occurrence_id=$1', [send.id]),
          [{ id: freshAttempt.attemptId, approval_id: freshApproval }]);
        await reject(dispatch(send.id));
        assert.equal(fake!.createCount(tenant.tenant, send.id), 1);

        const legacy = await approved(tenant, currentManager);
        const [{ id: legacyApproval }] = await rows(`WITH historical AS (
          INSERT INTO pilot.approvals(tenant_id,occurrence_id,draft_id,revision_id,location_id,provider_location,
            membership_id,membership_version,grant_version,due_at,timezone,mfa_at,grant_active_at_approval)
          SELECT tenant_id,occurrence_id,draft_id,revision_id,location_id,provider_location,membership_id,membership_version,
            grant_version,due_at,timezone,mfa_at,grant_active_at_approval FROM pilot.approvals
          WHERE tenant_id=$1 AND id=$2 RETURNING id
        ) UPDATE pilot.occurrences SET approval_id=historical.id FROM historical
          WHERE pilot.occurrences.id=$3 RETURNING historical.id`, [tenant.tenant, legacy.approvalId, legacy.id]);
        await denied(legacy.id, currentEmployee);
        assert.notEqual(await approve(await preview(legacy.id, currentManager), currentManager), legacyApproval);
        assert.deepEqual(await claim(legacy.id, currentEmployee), exported);

        const freshExport = await approve(await preview(exportable.id, currentManager), currentManager);
        assert.notEqual(freshExport, exportable.approvalId);
        assert.deepEqual(await claim(exportable.id, currentEmployee), exported);
        assert.deepEqual(await claim(exportable.id, currentEmployee), exported);
        assert.deepEqual(await state(exportable.id), [{ state: 'exported', approval_id: freshExport }]);
        assert.equal((await audit(exportable.id)).length, 1);
        assert.deepEqual(await claim(other.id, otherManager), exported);
        assert.equal((await audit(other.id)).length, 1);

        assert.equal(await reconcileOccurrence(connectFixture, inFlight.id, fake!), 'pending');
        assert.deepEqual(await rows('SELECT id,approval_id,outcome FROM pilot.attempts WHERE occurrence_id=$1', [inFlight.id]),
          [{ id: attempt.attemptId, approval_id: inFlight.approvalId, outcome: 'pending' }]);
        assert.equal(fake!.createCount(tenant.tenant, inFlight.id), 1);
      } finally {
        await owner.query('UPDATE pilot.dispatch_control SET stopped=$1', [stopBefore]);
      }
    });

    assert.deepEqual(await state(control.id), controlState);
    assert.deepEqual(await audit(control.id), []);
    assert.deepEqual(await rows(`SELECT token_hash,last_seen_at FROM pilot.sessions
      WHERE token_hash=ANY($1::text[]) ORDER BY token_hash`, [initialSessions.map(row => row.token_hash)]), initialSessions);
    assert.deepEqual(await rows('SELECT occurrence_id FROM pilot.attempts WHERE tenant_id=ANY($1::uuid[])',
      [[a.tenant, b.tenant]]), [{ occurrence_id: attempted.id }]);
    for (const id of [first.id, concurrent.id, rollback.id, attempted.id, stale.id]) {
      assert.equal(fake.createCount(a.tenant, id), 0);
    }
    assert.equal(fake.createCount(b.tenant, control.id), 0);
  } finally { await owner.end(); }
});
