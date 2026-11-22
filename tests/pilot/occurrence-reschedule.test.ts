import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { test } from 'node:test';
import { rescheduleOccurrence } from '../../apps/web/src/routes/content.js';
import * as customerRequests from '../../apps/web/src/server/request.js';
import { tokenHash } from '../../apps/web/src/server/session.js';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';
import { occurrence, seedTenant } from './fixtures.js';

test('private occurrence reschedule validates time and destination and preserves claim and approval history', async t => {
  if (process.env.PILOT_CONTAINER !== '1') {
    console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/occurrence-reschedule.test.js']));
    return;
  }

  const owner = await connectFixture(true);
  try {
    const a = await seedTenant(owner), b = await seedTenant(owner);
    const original = await occurrence(owner, a), foreign = await occurrence(owner, b);
    const destination = (await owner.query<{ id: string }>(`INSERT INTO pilot.locations(tenant_id,provider_location)
      VALUES($1,'Synthetic alternate location') RETURNING id`, [a.tenant])).rows[0]!.id;
    await owner.query('UPDATE pilot.identities SET verified=true,version=2 WHERE id=$1', [a.user]);
    await owner.query("INSERT INTO pilot.memberships(tenant_id,identity_id,role) VALUES($1,$2,'Manager')", [b.tenant, a.user]);
    const binding = { token: randomBytes(32).toString('hex'), csrf: randomBytes(32).toString('hex') };
    const clock = () => new Date('2030-01-01T10:00:00Z');
    await owner.query(`INSERT INTO pilot.sessions(token_hash,csrf_hash,identity_id,identity_version,tenant_id,tenant_version,
      membership_id,membership_version,audience,created_at,last_seen_at,expires_at)
      VALUES($1,$2,$3,2,$4,1,$5,1,'customer','2030-01-01T09:55Z','2030-01-01T09:55Z','2030-01-01T11:00Z')`,
    [tokenHash(binding.token), tokenHash(binding.csrf), a.user, a.tenant, a.membership]);

    const fold = {
      draftId: a.draft, occurrenceId: original, locationId: a.location,
      timezone: 'Europe/Berlin', localTime: '2030-10-27T02:30:00.123456', dueAt: '2030-10-27T00:30:00.123456Z'
    };
    const change = (schedule: Parameters<typeof rescheduleOccurrence>[2]) =>
      rescheduleOccurrence(connectFixture, binding, schedule, clock, async subject => ({
        subject, enabled: true, verified: true, requiredActions: [], credentials: []
      }));
    const read = async (id: string) => (await owner.query(`SELECT id,draft_id,tenant_id,creation_key,created_at,
        location_id,due_at::text AS due_at,timezone,state,approval_id FROM pilot.occurrences WHERE id=$1`, [id])).rows[0];
    const history = async (id: string) => (await owner.query(`SELECT to_jsonb(a) AS snapshot FROM pilot.approvals a
      WHERE occurrence_id=$1 ORDER BY id`, [id])).rows;
    const seedApproval = async (id: string, state = 'approved') => {
      const approval = (await owner.query<{ id: string }>(`INSERT INTO pilot.approvals(tenant_id,occurrence_id,draft_id,revision_id,
        location_id,provider_location,membership_id,membership_version,grant_version,due_at,timezone,mfa_at)
        SELECT tenant_id,id,draft_id,$2,location_id,'fake-location',$3,1,1,due_at,timezone,'2030-01-01T09:59Z'
        FROM pilot.occurrences WHERE id=$1 RETURNING id`, [id, a.revision, a.membership])).rows[0]!.id;
      await owner.query('UPDATE pilot.occurrences SET approval_id=$2,state=$3 WHERE id=$1', [id, approval, state]);
      return approval;
    };

    await t.test('both fold instants work, exact replay is a no-op, and time-only edits detach approval', async () => {
      assert.equal(await change(fold), true);
      await seedApproval(original);
      const before = await read(original), approval = await history(original);
      assert.equal(before.due_at, '2030-10-27 00:30:00.123456+00');
      assert.equal(await change(fold), false);
      assert.deepEqual(await read(original), before);
      const later = { ...fold, dueAt: '2030-10-27T01:30:00.123456Z' };
      assert.equal(await change(later), true);
      assert.deepEqual(await read(original), { ...before, due_at: '2030-10-27 01:30:00.123456+00', state: 'draft', approval_id: null });
      assert.deepEqual(await history(original), approval);
      assert.equal(await change(later), false);

      await seedApproval(original);
      const beforeZone = await read(original), zoneHistory = await history(original);
      assert.equal(await change({ ...later, timezone: 'UTC', localTime: '2030-10-27T01:30:00.123456' }), true);
      assert.deepEqual(await read(original), { ...beforeZone, timezone: 'UTC', state: 'draft', approval_id: null });
      assert.deepEqual(await history(original), zoneHistory);
    });

    await t.test('a location-only change detaches approval without releasing holds or quarantine', async () => {
      for (const state of ['approved', 'held', 'quarantined']) {
        const id = await occurrence(owner, a);
        await seedApproval(id, state);
        const before = await read(id), approval = await history(id);
        const unchanged = { ...fold, occurrenceId: id, localTime: '2030-01-01T13:00', dueAt: '2030-01-01T12:00:00.000000Z' };
        assert.equal(await change(unchanged), false);
        assert.deepEqual(await read(id), before);
        assert.equal(await change({ ...unchanged, locationId: destination }), true);
        assert.deepEqual(await read(id), { ...before, location_id: destination, state: state === 'approved' ? 'draft' : state, approval_id: null });
        assert.deepEqual(await history(id), approval);
      }
    });

    await t.test('gap, mismatched instant, invalid zone/calendar and foreign bindings leave all records intact', async () => {
      const before = [await read(original), await read(foreign), await history(original)];
      for (const invalid of [
        { localTime: '2030-03-31T02:30', dueAt: '2030-03-31T00:30Z' },
        { localTime: '2030-03-31T02:30', dueAt: '2030-03-31T01:30Z' },
        { dueAt: '2030-10-27T02:30:00.123456Z' },
        { dueAt: '2030-10-27T00:30:00.123457Z' },
        { dueAt: '2030-02-30T00:30:00.123456Z' },
        { timezone: 'Invalid/Zone' }, { timezone: '+02:00' },
        { locationId: b.location }, { draftId: b.draft, occurrenceId: foreign }, { occurrenceId: foreign },
        { draftId: b.draft }, { occurrenceId: 'invalid' }
      ]) {
        await assert.rejects(change({ ...fold, ...invalid }), { message: 'Denied' });
      }
      assert.deepEqual([await read(original), await read(foreign), await history(original)], before);
    });

    await t.test('an unsupported customer role denies before and after domain locks', async t => {
      const before = await read(original), approval = await history(original);
      const require = customerRequests.requireCustomerRequest;
      for (const denyAt of [1, 2]) {
        let checks = 0;
        const mocked = t.mock.method(customerRequests, 'requireCustomerRequest', async (...args: Parameters<typeof require>) => {
          const context = await require(...args);
          // Simulate a future role at the authority boundary without altering the fixture schema.
          return ++checks === denyAt ? { ...context, role: 'Unsupported' } as unknown as typeof context : context;
        });
        try {
          await assert.rejects(change(fold), { message: 'Denied' });
          assert.equal(checks, denyAt);
          assert.deepEqual(await read(original), before);
          assert.deepEqual(await history(original), approval);
        } finally { mocked.mock.restore(); }
      }
    });

    await t.test('every delivery state is protected even without an attempt row', async () => {
      for (const state of ['exported', 'in_flight', 'unknown', 'pending', 'confirmed', 'rejected']) {
        const id = await occurrence(owner, a);
        await seedApproval(id, state);
        const before = await read(id), approval = await history(id);
        await assert.rejects(change({ ...fold, occurrenceId: id }), { message: 'Denied' });
        assert.deepEqual(await read(id), before);
        assert.deepEqual(await history(id), approval);
      }
    });

    await t.test('an attempt committed while reschedule waits still prevents mutation', async () => {
      const id = await occurrence(owner, a);
      const approvalId = await seedApproval(id, 'held');
      const before = await read(id), approval = await history(id);
      const blocker = await connectFixture();
      try {
        await blocker.query('BEGIN');
        // Block on the occurrence itself so the waiting statement starts before the attempt commits.
        await blocker.query('SELECT id FROM pilot.occurrences WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [a.tenant, id]);
        const attempt = await blocker.query(`INSERT INTO pilot.attempts(tenant_id,occurrence_id,approval_id)
          VALUES($1,$2,$3) RETURNING id,outcome`, [a.tenant, id, approvalId]);
        const pid = (await blocker.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
        const denied = assert.rejects(change({ ...fold, occurrenceId: id }), { message: 'Denied' });
        try {
          let blocked = false;
          for (let n = 0; n < 80 && !blocked; n++) {
            blocked = (await owner.query(`SELECT 1 FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))
              AND starts_with(query,'SELECT id FROM pilot.occurrences')`, [pid])).rowCount === 1;
            if (!blocked) await setTimeout(25);
          }
          assert.equal(blocked, true);
          await blocker.query('COMMIT');
        } finally {
          await blocker.query('ROLLBACK');
          await denied;
        }
        assert.deepEqual(await read(id), before);
        assert.deepEqual(await history(id), approval);
        assert.deepEqual((await owner.query('SELECT id,outcome FROM pilot.attempts WHERE tenant_id=$1', [a.tenant])).rows, attempt.rows);
      } finally { await blocker.end(); }
    });
  } finally { await owner.end(); }
});
