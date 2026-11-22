import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';
import { FakeGbp } from './fake-gbp.js';
import { occurrence, seedTenant } from './fixtures.js';

const entry = 'dist/pilot/ops/local/dispatch-control.js';
const command = (action: string) =>
  JSON.parse(execFileSync(process.execPath, [entry, action], { encoding: 'utf8' }));

test('reopen refuses restore, backup, drill and unknown manifests before Docker', async t => {
  const root = await mkdtemp(join(tmpdir(), 'maex-reopen-target-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const dir = join(root, 'work', 'pilot');
  await mkdir(dir, { recursive: true });
  const id = 'a'.repeat(32);
  const password = 'b'.repeat(64);
  const fixture = { schema: 1, id, project: 'maex-pilot-' + id, expiresAt: Date.now() + 60_000,
    ownerPassword: password, appPassword: password, identityPassword: password, keycloakPassword: password };
  for (const marker of [{ purpose: 'backup' }, { purpose: 'readiness' },
    { purpose: 'restore-target', restoreTarget: true }, { purpose: 'ordinary', restoreTarget: true },
    { purpose: 'paired-restore', restoreTarget: true, pairedRestore: true }, {}, { purpose: 'unknown' }]) {
    await writeFile(join(dir, 'fixture.json'), JSON.stringify({ ...fixture, ...marker }));
    const result = spawnSync(process.execPath, [resolve(entry), 'reopen'], { cwd: root, encoding: 'utf8', timeout: 10_000 });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.equal(result.stderr.trim(), marker.purpose === 'unknown'
      ? 'Fixture dispatch command refused or failed.' : 'Dispatch reopen requires an ordinary fixture manifest.');
  }
});

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
