import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { test } from 'node:test';
import type { Client } from 'pg';
import type { InspectIdentity } from '../../packages/contracts/pilot.js';
import { approveOccurrence, readApprovalProposal } from '../../apps/web/src/routes/content.js';
import { requireCustomerRequest } from '../../apps/web/src/server/request.js';
import { tokenHash } from '../../apps/web/src/server/session.js';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';
import { occurrence, seedTenant } from './fixtures.js';

const now = new Date('2030-01-01T10:00:00Z');
const freshAt = new Date(now.getTime() - 300_000);
const factor = 'synthetic-otp';
const clock = () => new Date(now);

test('private approval transaction preserves the exact proposal and refuses stale authority', async t => {
  if (process.env.PILOT_CONTAINER !== '1') {
    console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/approval.test.js']));
    return;
  }

  const owner = await connectFixture(true);
  try {
    const a = await seedTenant(owner), b = await seedTenant(owner);
    await owner.query('INSERT INTO pilot.budgets(tenant_id,synthetic_units) VALUES ($1,5)', [a.tenant]);
    const foreign = await occurrence(owner, b);
    const actor = async (role: 'Manager' | 'Employee' = 'Manager', audience: 'customer' | 'management' = 'customer') => {
      const subject = randomUUID();
      const binding = { token: randomBytes(32).toString('hex'), csrf: randomBytes(32).toString('hex') };
      const identity = (await owner.query<{ id: string }>(
        'INSERT INTO pilot.identities(subject,verified) VALUES($1,true) RETURNING id', [subject])).rows[0]!.id;
      const membership = (await owner.query<{ id: string }>(
        'INSERT INTO pilot.memberships(tenant_id,identity_id,role) VALUES($1,$2,$3) RETURNING id',
        [a.tenant, identity, role])).rows[0]!.id;
      await owner.query("INSERT INTO pilot.memberships(tenant_id,identity_id,role) VALUES($1,$2,'Manager')", [b.tenant, identity]);
      let device: string | null = null;
      if (audience === 'management') {
        const grant = (await owner.query<{ id: string }>('INSERT INTO pilot.platform_grants(identity_id) VALUES($1) RETURNING id', [identity])).rows[0]!.id;
        device = (await owner.query<{ id: string }>(`INSERT INTO pilot.devices(platform_grant_id,identity_id,public_key)
          VALUES($1,$2,'synthetic') RETURNING id`, [grant, identity])).rows[0]!.id;
      }
      const id = (await owner.query<{ id: string }>(`INSERT INTO pilot.sessions(token_hash,csrf_hash,identity_id,identity_version,tenant_id,
        tenant_version,membership_id,membership_version,audience,created_at,last_seen_at,expires_at,mfa_at,mfa_credential_id,device_id,device_version)
        VALUES($1,$2,$3,1,$4,$5,$6,$5,$7,$8,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [tokenHash(binding.token), tokenHash(binding.csrf), identity, device ? null : a.tenant, device ? null : 1, device ? null : membership,
        audience, new Date(now.getTime() - 600_000), new Date(now.getTime() + 600_000), freshAt, factor, device, device ? 1 : null])).rows[0]!.id;
      return { subject, identity, membership, binding, id };
    };
    const inspect: InspectIdentity = async subject => ({
      subject, enabled: true, verified: true, requiredActions: [], credentials: [{ id: factor, type: 'otp' }]
    });
    const manager = await actor(), employee = await actor('Employee'), admin = await actor('Manager', 'management');
    const proposalFor = async (id: string, who = manager) => {
      const db = await connectFixture();
      try {
        await db.query('BEGIN');
        const context = await requireCustomerRequest(db, who.binding, clock, inspect, 'read-only');
        const proposal = await readApprovalProposal(db, context, id);
        await db.query('COMMIT');
        return proposal;
      } catch (error) { await db.query('ROLLBACK'); throw error; }
      finally { await db.end(); }
    };
    const read = async (id: string) => (await owner.query(`SELECT o.state,o.approval_id,o.due_at=a.due_at AS exact_due,
        a.membership_id,a.membership_version,a.grant_version,a.revision_id,a.location_id,a.provider_location,a.timezone,a.mfa_at,r.text
      FROM pilot.occurrences o LEFT JOIN pilot.approvals a ON a.tenant_id=o.tenant_id AND a.id=o.approval_id
      LEFT JOIN pilot.draft_revisions r ON r.tenant_id=a.tenant_id AND r.id=a.revision_id
      WHERE o.tenant_id=$1 AND o.id=$2`, [a.tenant, id])).rows[0];
    const count = async (id: string) => (await owner.query(`SELECT count(*)::int AS n FROM pilot.approvals
      WHERE occurrence_id=$1`, [id])).rows[0].n;

    await t.test('concurrent and repeated exact submissions preserve one immutable record', async () => {
      const otherLocation = (await owner.query<{ id: typeof a.location }>(`INSERT INTO pilot.locations(tenant_id,provider_location)
        VALUES($1,'Synthetic second destination') RETURNING id`, [a.tenant])).rows[0]!.id;
      const id = await occurrence(owner, { ...a, location: otherLocation });
      await owner.query(`UPDATE pilot.occurrences SET due_at='2030-07-01T12:00:00.000007Z' WHERE id=$1`, [id]);
      const proposal = await proposalFor(id);
      const blocker = await connectFixture();
      try {
        await blocker.query('BEGIN');
        await blocker.query('SELECT id FROM pilot.drafts WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [a.tenant, a.draft]);
        const submitted = { ...proposal };
        const concurrent = Promise.allSettled([
          approveOccurrence(connectFixture, manager.binding, submitted, clock, inspect),
          approveOccurrence(connectFixture, manager.binding, submitted, clock, inspect)
        ]);
        try {
          await waitForWaiter(owner, blocker, 'SELECT id FROM pilot.drafts');
          submitted.occurrenceId = foreign;
        }
        finally { await blocker.query('ROLLBACK'); }
        const results = await concurrent;
        for (const result of results) if (result.status === 'rejected') throw result.reason;
        const [{ value: approval }] = results as [PromiseFulfilledResult<string>, PromiseFulfilledResult<string>];
        assert.deepEqual(results, [{ status: 'fulfilled', value: approval }, { status: 'fulfilled', value: approval }]);
        assert.equal(await approveOccurrence(connectFixture, manager.binding, proposal, clock, inspect), approval);
        assert.equal(await count(id), 1);
        assert.deepEqual(await read(id), {
          state: 'approved', approval_id: approval, exact_due: true, membership_id: manager.membership, membership_version: 1,
          grant_version: 1, revision_id: a.revision, location_id: otherLocation, provider_location: 'Synthetic second destination',
          timezone: 'Europe/Berlin', mfa_at: freshAt, text: 'Invented plain text'
        });
        await assert.rejects(owner.query('UPDATE pilot.approvals SET provider_location=$1 WHERE id=$2', ['Rewritten', approval]), { code: '23514' });
        await owner.query('UPDATE pilot.locations SET provider_location=$1,version=version+1 WHERE tenant_id=$2 AND id=$3',
          ['Renamed', a.tenant, otherLocation]);
        assert.equal((await read(id)).provider_location, 'Synthetic second destination');
        await assert.rejects(approveOccurrence(connectFixture, manager.binding, proposal, clock, inspect), /Denied/);
        assert.equal(await count(id), 1);
      } finally { await blocker.end(); }
    });

    await t.test('different current Manager grants competing for one occurrence leave one approval', async () => {
      const id = await occurrence(owner, a);
      const other = await actor();
      const first = await proposalFor(id), second = await proposalFor(id, other);
      const results = await Promise.allSettled([
        approveOccurrence(connectFixture, manager.binding, first, clock, inspect),
        approveOccurrence(connectFixture, other.binding, second, clock, inspect)
      ]);
      const accepted = results.filter(result => result.status === 'fulfilled');
      const denied = results.filter(result => result.status === 'rejected');
      assert.equal(accepted.length, 1);
      assert.equal(denied.length, 1);
      assert.match(String(denied[0]!.reason), /Denied/);
      assert.equal(await count(id), 1);
      assert.equal((await read(id)).approval_id, accepted[0]!.value);
    });

    await t.test('role, tenant, proof, member, schedule and revision denials leave no approval', async () => {
      const id = await occurrence(owner, a);
      const proposal = await proposalFor(id);
      const staleMember = await actor();
      const staleProposal = await proposalFor(id, staleMember);
      const reject = async (attempt: Promise<string>) => {
        await assert.rejects(attempt, /Denied/);
        assert.equal(await count(id), 0);
        assert.equal((await read(id)).state, 'draft');
      };
      await assert.rejects(proposalFor(foreign), /Denied/);
      await assert.rejects(proposalFor(id, employee), /Denied/);
      await reject(approveOccurrence(connectFixture, employee.binding, proposal, clock, inspect));
      await reject(approveOccurrence(connectFixture, admin.binding, proposal, clock, inspect));
      await reject(approveOccurrence(connectFixture, { ...manager.binding, csrf: randomBytes(32).toString('hex') }, proposal, clock, inspect));
      await reject(approveOccurrence(connectFixture, manager.binding, { ...proposal, occurrenceId: foreign }, clock, inspect));
      await reject(approveOccurrence(connectFixture, manager.binding, proposal, clock, async (subject: string) => ({
        ...await inspect(subject), credentials: [{ id: 'replacement-otp', type: 'otp' }]
      })));
      await reject(approveOccurrence(connectFixture, manager.binding, proposal, () => new Date(now.getTime() + 1), inspect));

      await owner.query('UPDATE pilot.memberships SET active=false,version=version+1 WHERE tenant_id=$1 AND id=$2',
        [a.tenant, staleMember.membership]);
      await reject(approveOccurrence(connectFixture, staleMember.binding, staleProposal, clock, inspect));
      await owner.query('UPDATE pilot.locations SET version=version+1 WHERE tenant_id=$1 AND id=$2', [a.tenant, a.location]);
      await reject(approveOccurrence(connectFixture, manager.binding, proposal, clock, inspect));
      const sameSchedule = await proposalFor(id);
      await owner.query('UPDATE pilot.occurrences SET timezone=$1 WHERE id=$2', ['Unknown/Zone', id]);
      await reject(approveOccurrence(connectFixture, manager.binding, { ...sameSchedule, timezone: 'Unknown/Zone' }, clock, inspect));
      await owner.query('UPDATE pilot.occurrences SET timezone=$1 WHERE id=$2', ['UTC', id]);
      await reject(approveOccurrence(connectFixture, manager.binding, sameSchedule, clock, inspect));
      await owner.query("UPDATE pilot.occurrences SET timezone='Europe/Berlin',due_at=due_at+interval '1 microsecond' WHERE id=$1", [id]);
      await reject(approveOccurrence(connectFixture, manager.binding, sameSchedule, clock, inspect));
      const next = await proposalFor(id);
      await owner.query("INSERT INTO pilot.draft_revisions(tenant_id,draft_id,revision,text) VALUES($1,$2,2,'New revision')",
        [a.tenant, a.draft]);
      await reject(approveOccurrence(connectFixture, manager.binding, next, clock, inspect));
      await assert.rejects(approveOccurrence(connectFixture, manager.binding, { ...next, occurrenceId: foreign }, clock, inspect), /Denied/);
      assert.equal(await count(foreign), 0);
    });

    await t.test('proof expiration and factor removal after a lock wait both deny', async () => {
      const id = await occurrence(owner, a);
      const proposal = await proposalFor(id);
      const blocker = await connectFixture();
      try {
        for (const change of ['expire', 'remove'] as const) {
          await blocker.query('BEGIN');
          await blocker.query('SELECT id FROM pilot.drafts WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [a.tenant, a.draft]);
          let elapsed = 0, enrolled = true;
          const denied = assert.rejects(approveOccurrence(connectFixture, manager.binding, proposal,
            () => new Date(now.getTime() + elapsed),
            async subject => ({ ...await inspect(subject), credentials: enrolled ? [{ id: factor, type: 'otp' }] : [] })), /Denied/);
          try {
            await waitForWaiter(owner, blocker, 'SELECT id FROM pilot.drafts');
            if (change === 'expire') elapsed = 1;
            else enrolled = false;
          } finally { await blocker.query('ROLLBACK'); }
          await denied;
          assert.equal(await count(id), 0);
          assert.equal((await read(id)).state, 'draft');
        }
      } finally { await blocker.end(); }
    });

    await t.test('a waiting approval cannot refresh its way past idle expiry', async () => {
      const id = await occurrence(owner, a);
      const approver = await actor();
      const idle = new Date(now.getTime() - 1_799_999);
      await owner.query('UPDATE pilot.sessions SET created_at=$1,last_seen_at=$1,mfa_at=$2 WHERE id=$3',
        [idle, new Date(now.getTime() - 1000), approver.id]);
      const proposal = await proposalFor(id, approver);
      const blocker = await connectFixture();
      try {
        await blocker.query('BEGIN');
        await blocker.query('SELECT id FROM pilot.drafts WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [a.tenant, a.draft]);
        let elapsed = 0;
        const submitted = approveOccurrence(connectFixture, approver.binding, proposal,
          () => new Date(now.getTime() + elapsed), inspect);
        const result = Promise.allSettled([submitted]);
        try {
          await waitForWaiter(owner, blocker, 'SELECT id FROM pilot.drafts');
          elapsed = 1;
        } finally { await blocker.query('ROLLBACK'); }
        const [denied] = await result;
        assert.equal(denied?.status, 'rejected');
        assert.match(String(denied.reason), /Denied/);
        assert.equal(await count(id), 0);
        assert.deepEqual((await owner.query('SELECT last_seen_at FROM pilot.sessions WHERE id=$1', [approver.id])).rows[0].last_seen_at, idle);
      } finally { await blocker.end(); }
    });

    await t.test('a membership withdrawal committed first defeats a waiting approval', async () => {
      const id = await occurrence(owner, a);
      const approver = await actor();
      const proposal = await proposalFor(id, approver);
      const blocker = await connectFixture();
      try {
        await blocker.query('BEGIN');
        await blocker.query('SELECT id FROM pilot.identities WHERE id=$1 FOR UPDATE', [approver.identity]);
        await blocker.query('UPDATE pilot.memberships SET active=false,version=version+1 WHERE tenant_id=$1 AND id=$2',
          [a.tenant, approver.membership]);
        const denied = assert.rejects(approveOccurrence(connectFixture, approver.binding, proposal, clock, inspect), /Denied/);
        try { await waitForWaiter(owner, blocker, 'SELECT id FROM pilot.identities'); }
        finally { await blocker.query('COMMIT'); }
        await denied;
        assert.equal(await count(id), 0);
        assert.equal((await read(id)).state, 'draft');
        await approveOccurrence(connectFixture, manager.binding, await proposalFor(id), clock, inspect);
        assert.equal(await count(id), 1);
      } finally { await blocker.end(); }
    });

    await t.test('a failed occurrence update rolls back the approval and session update', async () => {
      const id = await occurrence(owner, a);
      const proposal = await proposalFor(id);
      const before = new Date(now.getTime() - 1000);
      await owner.query('UPDATE pilot.sessions SET last_seen_at=$1 WHERE id=$2', [before, manager.id]);
      try {
        await owner.query(`CREATE FUNCTION pilot.reject_approval_link_probe() RETURNS trigger LANGUAGE plpgsql AS $$
          BEGIN RAISE EXCEPTION 'synthetic approval linkage failure'; END $$;
          CREATE TRIGGER reject_approval_link_probe BEFORE UPDATE ON pilot.occurrences
          FOR EACH ROW WHEN (NEW.state = 'approved') EXECUTE FUNCTION pilot.reject_approval_link_probe()`);
        await assert.rejects(approveOccurrence(connectFixture, manager.binding, proposal, clock, inspect),
          /synthetic approval linkage failure/);
        assert.equal(await count(id), 0);
        assert.equal((await read(id)).state, 'draft');
        assert.deepEqual((await owner.query('SELECT last_seen_at FROM pilot.sessions WHERE id=$1', [manager.id])).rows[0].last_seen_at, before);
      } finally {
        await owner.query(`DROP TRIGGER IF EXISTS reject_approval_link_probe ON pilot.occurrences;
          DROP FUNCTION IF EXISTS pilot.reject_approval_link_probe()`);
      }
    });

    assert.deepEqual((await owner.query('SELECT synthetic_units FROM pilot.budgets WHERE tenant_id=$1',
      [a.tenant])).rows, [{ synthetic_units: '5' }]);
    for (const table of ['attempts', 'budget_reservations']) {
      assert.equal((await owner.query(`SELECT count(*)::int AS n FROM pilot.${table}
        WHERE tenant_id=ANY($1::uuid[])`, [[a.tenant, b.tenant]])).rows[0].n, 0);
    }
  } finally { await owner.end(); }
});

async function waitForWaiter(observer: Client, blocker: Client, queryStart: string): Promise<void> {
  const pid = (await blocker.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
  for (let i = 0; i < 80; i++) {
    const result = await observer.query(`SELECT 1 FROM pg_stat_activity
      WHERE $1=ANY(pg_blocking_pids(pid)) AND starts_with(query,$2)`, [pid, queryStart]);
    if (result.rowCount) return;
    await setTimeout(25);
  }
  assert.fail('Approval did not wait on the expected lock');
}
