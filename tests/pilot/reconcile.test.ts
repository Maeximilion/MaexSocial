import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { reconcileOccurrence } from '../../apps/worker/src/reconcile.js';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';
import { FakeGbp } from '../../apps/worker/src/fake-gbp.js';
import { occurrence, seedTenant } from './fixtures.js';

const location = 'locations/approved-orchard';
const claimedAt = new Date('2030-01-01T12:00:00Z');

test('stored GBP attempts reconcile without a second create or a return to export eligibility', async t => {
  if (process.env.PILOT_CONTAINER !== '1') {
    console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/reconcile.test.js']));
    return;
  }
  // The isolated runner mounts the workspace and filesystem read-only.
  const path = await mkdtemp(join('/dev/shm', 'maex-reconcile-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  const owner = await connectFixture(true);
  try {
    const a = await seedTenant(owner), b = await seedTenant(owner);
    const seed = async (tenant: typeof a, destination: string | null = location, resource: string | null = null) => {
      const occurrenceId = await occurrence(owner, tenant);
      const approval = (await owner.query<{ id: string }>(`INSERT INTO pilot.approvals
        (tenant_id,occurrence_id,draft_id,revision_id,location_id,membership_id,membership_version,grant_version,
         due_at,timezone,mfa_at,provider_location) VALUES ($1,$2,$3,$4,$5,$6,1,1,$7,'Europe/Berlin',$7,$8) RETURNING id`,
      [tenant.tenant, occurrenceId, tenant.draft, tenant.revision, tenant.location, tenant.membership, claimedAt, destination])).rows[0]!;
      await owner.query("UPDATE pilot.occurrences SET state='in_flight',approval_id=$2 WHERE id=$1", [occurrenceId, approval.id]);
      const attemptId = (await owner.query<{ id: string }>(`INSERT INTO pilot.attempts
        (tenant_id,occurrence_id,approval_id,claimed_at,resource_name) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [tenant.tenant, occurrenceId, approval.id, claimedAt, resource])).rows[0]!.id;
      return { tenantId: tenant.tenant, occurrenceId, attemptId, location };
    };
    const stored = async (id: string) => (await owner.query(`SELECT o.state,a.outcome,a.observed_at,a.resource_name,a.id AS attempt_id
      FROM pilot.occurrences o JOIN pilot.attempts a ON a.tenant_id=o.tenant_id AND a.occurrence_id=o.id WHERE o.id=$1`, [id])).rows[0];
    const reconcile = (id: string, fake: FakeGbp) => reconcileOccurrence(connectFixture, id, fake);
    const readStop = async () => (await owner.query('SELECT * FROM pilot.dispatch_control')).rows;
    const originalStop = await readStop();

    await t.test('lost reply, processing, restart and matching LIVE preserve a single create and its evidence', async () => {
      const intent = await seed(a);
      let now = claimedAt.getTime();
      const clock = () => now;
      const sending = new FakeGbp(path, { clock, loseReply: true, frames: [
        { afterMs: 0, candidates: ['PROCESSING'] }, { afterMs: 50, candidates: ['LIVE'] },
      ] });
      try {
        await assert.rejects(sending.create(intent), /lost after acceptance/);
        assert.equal(await reconcile(intent.occurrenceId, sending), 'pending');
        assert.deepEqual(await stored(intent.occurrenceId), { state: 'pending', outcome: 'pending',
          observed_at: new Date(now), resource_name: null, attempt_id: intent.attemptId });
      } finally { sending.close(); }

      now += 50;
      const restarted = await promisify(execFile)(process.execPath, ['-e', `
        const { reconcileOccurrence } = require('./dist/pilot/apps/worker/src/reconcile.js');
        const { connectFixture } = require('./dist/pilot/ops/local/fixture.js');
        const { FakeGbp } = require('./dist/pilot/apps/worker/src/fake-gbp.js');
        const [directory, occurrenceId, observedAt] = process.argv.slice(1);
        const fake = new FakeGbp(directory, { clock: () => Number(observedAt) });
        reconcileOccurrence(connectFixture, occurrenceId, fake)
          .then(result => console.log(result)).finally(() => fake.close());
      `, path, intent.occurrenceId, String(now)], { timeout: 10_000 });
      assert.equal(restarted.stdout.trim(), 'confirmed');
      const reopened = new FakeGbp(path, { clock });
      try {
        const resource = (await reopened.readback(intent)).candidates[0]!.resourceName;
        assert.deepEqual(await Promise.all([reconcile(intent.occurrenceId, reopened), reconcile(intent.occurrenceId, reopened)]),
          ['confirmed', 'confirmed']);
        assert.deepEqual(await stored(intent.occurrenceId), { state: 'confirmed', outcome: 'confirmed',
          observed_at: new Date(now), resource_name: resource, attempt_id: intent.attemptId });
        assert.equal(reopened.createCount(a.tenant, intent.occurrenceId), 1);
      } finally { reopened.close(); }
    });

    await t.test('multiple LIVE candidates and missing or unrelated results stay unknown across reopen', async () => {
      const absent = await seed(a), ambiguous = await seed(a), wrongLocation = await seed(a), unsent = await seed(a);
      const wrongResource = await seed(a, location, `${location}/localPosts/another-post`);
      const legacy = await seed(a, null);
      const otherTenant = await seed(b);
      const beforeOther = await stored(otherTenant.occurrenceId);
      const clock = () => claimedAt.getTime() + 10;
      const sending = new FakeGbp(path, { clock, frames: [{ afterMs: 0, candidates: ['LIVE', 'LIVE'] }] });
      try { await sending.create(ambiguous); } finally { sending.close(); }
      const exact = new FakeGbp(path, { clock, frames: [{ afterMs: 0, candidates: ['LIVE'] }] });
      try {
        await exact.create({ ...wrongLocation, location: 'locations/other' });
        await exact.create(wrongResource);
        await exact.create({ ...absent, tenantId: otherTenant.tenantId });
        await exact.create({ ...absent, attemptId: randomUUID() });
        await exact.create(legacy);
      } finally { exact.close(); }

      for (let pass = 0; pass < 2; pass++) {
        const reopened = new FakeGbp(path, { clock });
        try {
          for (const [intent, count, resource] of [
            [absent, 1, null], [ambiguous, 1, null], [wrongLocation, 1, null],
            [wrongResource, 1, `${location}/localPosts/another-post`], [legacy, 1, null], [unsent, 0, null],
          ] as const) {
            assert.equal(await reconcile(intent.occurrenceId, reopened), 'unknown');
            assert.deepEqual(await stored(intent.occurrenceId), { state: 'unknown', outcome: 'unknown',
              observed_at: intent === legacy ? null : new Date(clock()), resource_name: resource, attempt_id: intent.attemptId });
            assert.equal(reopened.createCount(intent.tenantId, intent.occurrenceId), count);
          }
          assert.deepEqual(await stored(otherTenant.occurrenceId), beforeOther);
        } finally { reopened.close(); }
      }
    });

    await t.test('the stored receipt selects the exact resource and a stale LIVE read cannot confirm', async () => {
      const intent = await seed(a);
      let now = claimedAt.getTime();
      const fake = new FakeGbp(path, { clock: () => now, frames: [
        { afterMs: 0, candidates: ['LIVE', 'LIVE'] }, { afterMs: 10, candidates: ['PROCESSING', 'LIVE'] },
        { afterMs: 50, candidates: ['LIVE', 'LIVE'] },
      ] });
      try {
        const receipt = await fake.create(intent);
        await owner.query('UPDATE pilot.attempts SET resource_name=$2 WHERE occurrence_id=$1',
          [intent.occurrenceId, receipt.resourceName]);
        now += 10;
        assert.equal(await reconcile(intent.occurrenceId, fake), 'pending');
        const pending = await stored(intent.occurrenceId);
        now -= 10;
        assert.equal(await reconcile(intent.occurrenceId, fake), 'pending');
        assert.deepEqual(await stored(intent.occurrenceId), pending);
        now += 50;
        assert.equal(await reconcile(intent.occurrenceId, fake), 'confirmed');
        assert.deepEqual(await stored(intent.occurrenceId), { state: 'confirmed', outcome: 'confirmed',
          observed_at: new Date(now), resource_name: receipt.resourceName, attempt_id: intent.attemptId });
        assert.equal(fake.createCount(a.tenant, intent.occurrenceId), 1);
      } finally { fake.close(); }
    });

    await t.test('a matching rejection is durable and a quarantined occurrence stays quarantined', async () => {
      const rejected = await seed(a), quarantined = await seed(a);
      await owner.query("UPDATE pilot.occurrences SET state='quarantined' WHERE id=$1", [quarantined.occurrenceId]);
      const clock = () => claimedAt.getTime() + 20;
      const fake = new FakeGbp(path, { clock, frames: [{ afterMs: 0, candidates: ['REJECTED'] }] });
      try {
        await fake.create(rejected);
        assert.equal(await reconcile(rejected.occurrenceId, fake), 'rejected');
        assert.equal(await reconcile(rejected.occurrenceId, fake), 'rejected');
        assert.deepEqual(await stored(rejected.occurrenceId), { state: 'rejected', outcome: 'rejected',
          observed_at: new Date(clock()), resource_name: null, attempt_id: rejected.attemptId });
        assert.equal(fake.createCount(a.tenant, rejected.occurrenceId), 1);
        assert.equal(await reconcile(quarantined.occurrenceId, fake), 'unknown');
        assert.equal((await stored(quarantined.occurrenceId)).state, 'quarantined');
        assert.equal(fake.createCount(a.tenant, quarantined.occurrenceId), 0);
        assert.equal(await reconcile(await occurrence(owner, a), fake), null);
      } finally { fake.close(); }
    });

    await t.test('a failed occurrence update also rolls back the attempt observation', async () => {
      const intent = await seed(a);
      const before = await stored(intent.occurrenceId);
      const fake = new FakeGbp(path, { clock: () => claimedAt.getTime(), frames: [{ afterMs: 0, candidates: ['LIVE'] }] });
      try {
        await fake.create(intent);
        await owner.query('REVOKE UPDATE (state) ON pilot.occurrences FROM pilot_app');
        try {
          await assert.rejects(reconcile(intent.occurrenceId, fake), { code: '42501' });
          assert.deepEqual(await stored(intent.occurrenceId), before);
          assert.equal((await owner.query('SELECT resolved_at FROM pilot.attempts WHERE occurrence_id=$1',
            [intent.occurrenceId])).rows[0].resolved_at, null);
        } finally { await owner.query('GRANT UPDATE (state) ON pilot.occurrences TO pilot_app'); }
        assert.equal(await reconcile(intent.occurrenceId, fake), 'confirmed');
        assert.equal(fake.createCount(a.tenant, intent.occurrenceId), 1);
      } finally { fake.close(); }
    });

    await t.test('a blocked readback leaves both rows unlocked and discards stale resource correlation', async () => {
      const intent = await seed(a);
      const fake = new FakeGbp(path, { clock: () => claimedAt.getTime(), frames: [{ afterMs: 0, candidates: ['LIVE'] }] });
      try {
        await fake.create(intent);
        let observed!: () => void, release!: () => void;
        const reachedProvider = new Promise<void>(resolve => { observed = resolve; });
        const releaseProvider = new Promise<void>(resolve => { release = resolve; });
        const reading = reconcileOccurrence(connectFixture, intent.occurrenceId, {
          async readback(attempt) {
            const result = await fake.readback(attempt);
            observed();
            await releaseProvider;
            return result;
          },
        });
        await Promise.race([reachedProvider, reading.then(() => assert.fail('readback did not start'))]);
        const resource = `${location}/localPosts/a-different-receipt`;
        try {
          await owner.query('BEGIN');
          await owner.query('SELECT id FROM pilot.occurrences WHERE id=$1 FOR UPDATE NOWAIT', [intent.occurrenceId]);
          await owner.query('SELECT id FROM pilot.attempts WHERE occurrence_id=$1 FOR UPDATE NOWAIT', [intent.occurrenceId]);
          await owner.query("UPDATE pilot.occurrences SET state='quarantined' WHERE id=$1", [intent.occurrenceId]);
          await owner.query('UPDATE pilot.attempts SET resource_name=$2 WHERE occurrence_id=$1', [intent.occurrenceId, resource]);
          await owner.query('COMMIT');
        } catch (error) { await owner.query('ROLLBACK'); throw error; }
        finally { release(); await reading; }
        assert.equal(await reading, 'unknown');
        assert.deepEqual(await stored(intent.occurrenceId), { state: 'quarantined', outcome: 'unknown',
          observed_at: null, resource_name: resource, attempt_id: intent.attemptId });
        assert.equal(fake.createCount(a.tenant, intent.occurrenceId), 1);
      } finally { fake.close(); }
    });
    assert.deepEqual(await readStop(), originalStop);
  } finally { await owner.end(); }
});
