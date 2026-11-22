import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';
import { FakeGbp } from './fake-gbp.js';
import { occurrence, seedTenant } from './fixtures.js';

const entry = 'dist/pilot/ops/local/dispatch-control.js';
const command = (action: string) =>
  JSON.parse(execFileSync(process.execPath, [entry, action], { encoding: 'utf8' }));

test('local dispatch stop persists across processes and reports only unresolved attempts', async () => {
  if (process.env.PILOT_CONTAINER !== '1') {
    console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/dispatch-stop.test.js']));
    return;
  }
  const dir = await mkdtemp(join('/dev/shm', 'maex-dispatch-stop-'));
  const fake = new FakeGbp(dir, { clock: () => 1000 });
  const owner = await connectFixture(true);
  const readAttempts = (tenant: string) => owner.query(
    'SELECT * FROM pilot.attempts WHERE tenant_id = $1 ORDER BY id', [tenant]);
  try {
    const tenant = await seedTenant(owner);
    const baseline = (await owner.query<{ total: number }>(`SELECT count(*)::int AS total
      FROM pilot.attempts WHERE outcome IN ('unknown', 'pending')`)).rows[0]!.total;
    for (const outcome of ['unknown', 'pending', 'confirmed', 'rejected']) {
      const id = await occurrence(owner, tenant);
      await owner.query(`WITH approval AS (
        INSERT INTO pilot.approvals (tenant_id, occurrence_id, draft_id, revision_id, location_id,
          membership_id, membership_version, grant_version, due_at, timezone, mfa_at)
        SELECT tenant_id, id, draft_id, $2, location_id, $3, 1, 1, due_at, timezone, now()
        FROM pilot.occurrences WHERE id = $1 RETURNING tenant_id, occurrence_id, id
      )
      INSERT INTO pilot.attempts (tenant_id, occurrence_id, approval_id, outcome)
        SELECT tenant_id, occurrence_id, id, $4 FROM approval`, [id, tenant.revision, tenant.membership, outcome]);
    }
    const attempts = (await readAttempts(tenant.tenant)).rows;
    const unknown = attempts.find(attempt => attempt.outcome === 'unknown');
    assert.ok(unknown);
    const inFlight = { tenantId: tenant.tenant, occurrenceId: unknown.occurrence_id,
      attemptId: unknown.id, location: 'locations/invented' };
    const newWork = await occurrence(owner, tenant);
    await fake.create(inFlight);

    // Simulate an open control row in the disposable fixture before exercising the stop.
    await owner.query('UPDATE pilot.dispatch_control SET stopped = false');
    assert.deepEqual(command('status'), { stopped: false, outstandingAttempts: baseline + 2 });
    assert.equal((await owner.query('SELECT stopped FROM pilot.dispatch_control')).rows[0].stopped, false);
    const expected = { stopped: true, outstandingAttempts: baseline + 2 };
    assert.deepEqual(command('stop'), expected);
    assert.equal((await owner.query('SELECT stopped FROM pilot.dispatch_control')).rows[0].stopped, true);
    assert.deepEqual(command('stop'), expected);
    assert.deepEqual(command('status'), expected);
    assert.deepEqual((await readAttempts(tenant.tenant)).rows, attempts);
    assert.equal((await fake.readback(inFlight)).candidates[0]?.state, 'PROCESSING');
    for (const attempt of attempts) {
      assert.equal(fake.createCount(tenant.tenant, attempt.occurrence_id), attempt.id === inFlight.attemptId ? 1 : 0);
    }
    assert.equal(fake.createCount(tenant.tenant, newWork), 0);
  } finally {
    await owner.query('UPDATE pilot.dispatch_control SET stopped = true');
    await owner.end();
    fake.close();
    await rm(dir, { recursive: true });
  }
});
