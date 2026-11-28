import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { Client } from 'pg';
import { reconcileOccurrence } from '../../apps/worker/src/reconcile.js';
import { connectFixture, databaseConfig, loadFixture, runIsolated } from '../../ops/local/fixture.js';
import { FakeGbp } from '../../apps/worker/src/fake-gbp.js';
import { occurrence, seedTenant } from './fixtures.js';
import { assertRestoredSessions, denySessionRevocation, readRestoreSessions, seedRestoreSessions } from './restore-session-fixture.js';

const command = 'dist/pilot/ops/local/recover.js';
const runQuarantine = () => promisify(execFile)(process.execPath, [command], { timeout: 20_000 });
const occurredAt = new Date('2030-01-01T12:00:00Z');
const location = 'locations/invented-restore';

test('the restore quarantine command requires an offline restore target', async t => {
  const fixture = await loadFixture();
  if (!fixture.restoreTarget) {
    await assert.rejects(runQuarantine(), { code: 1, stderr: 'Fixture restore quarantine refused or failed.\n' });
    return;
  }
  if (process.env.PILOT_CONTAINER !== '1') {
    console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/restore-quarantine.test.js']));
    assert.deepEqual(JSON.parse((await runQuarantine()).stdout), {
      quarantined: 0, stopped: true, applicationLogin: false,
      topology: { internalNetworks: 2, publishedHostPorts: 0 },
    });
    return;
  }
  const owner = await connectFixture(true);
  t.after(() => owner.end());
  const state = async () => (await owner.query('SELECT stopped FROM pilot.dispatch_control')).rows[0]!.stopped;
  const quarantined = async (count: number) => assert.deepEqual(JSON.parse((await runQuarantine()).stdout),
    { quarantined: count, stopped: true, applicationLogin: false });

  const appAuthority = (await owner.query(`SELECT rolcanlogin,
    has_database_privilege('pilot_app', current_database(), 'CONNECT') AS can_connect
    FROM pg_roles WHERE rolname='pilot_app'`)).rows[0];
  assert.deepEqual(appAuthority, { rolcanlogin: false, can_connect: false });
  const app = new Client(await databaseConfig(fixture));
  try { await assert.rejects(app.connect(), { code: '28P01' }); }
  finally { await app.end(); }

  assert.equal((await owner.query('SELECT id FROM pilot.occurrences LIMIT 1')).rowCount, 0,
    'Run the restore quarantine regression on a fresh disposable target');
  await quarantined(0);
  assert.equal(await state(), true);

  const a = await seedTenant(owner), b = await seedTenant(owner);
  const historicalStates = ['draft', 'approved', 'held', 'exported', 'in_flight', 'unknown', 'pending', 'confirmed',
    'rejected', 'quarantined'] as const;
  const historical = new Map<string, string>();
  const intents = new Map<string, { tenantId: string; occurrenceId: string; attemptId: string; location: string }>();
  for (const previous of historicalStates) {
    const tenant = previous === 'exported' ? b : a;
    const id = await occurrence(owner, tenant);
    historical.set(id, previous);
    if (previous === 'draft' || previous === 'held') {
      await owner.query('UPDATE pilot.occurrences SET state=$2 WHERE id=$1', [id, previous]);
      if (previous === 'held') {
        // Model the imported compact decision after its source audit detail expired.
        await owner.query('INSERT INTO pilot.expired_occurrence_decisions(tenant_id,occurrence_id) VALUES($1,$2)',
          [tenant.tenant, id]);
      }
      continue;
    }
    const { rows: [approval] } = await owner.query<{ id: string }>(`INSERT INTO pilot.approvals
      (tenant_id,occurrence_id,draft_id,revision_id,location_id,membership_id,membership_version,grant_version,
       due_at,timezone,mfa_at,provider_location) VALUES ($1,$2,$3,$4,$5,$6,1,1,$7,'Europe/Berlin',$7,$8)
       RETURNING id`, [tenant.tenant, id, tenant.draft, tenant.revision, tenant.location, tenant.membership,
      occurredAt, previous === 'quarantined' ? null : location]);
    await owner.query('UPDATE pilot.occurrences SET state=$2,approval_id=$3 WHERE id=$1', [id, previous, approval!.id]);
    let attemptId = randomUUID();
    if (previous !== 'approved' && previous !== 'exported') {
      const outcome = previous === 'in_flight' || previous === 'quarantined' ? 'unknown' : previous;
      const { rows: [attempt] } = await owner.query<{ id: ReturnType<typeof randomUUID> }>(`INSERT INTO pilot.attempts
        (tenant_id,occurrence_id,approval_id,claimed_at,outcome) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [tenant.tenant, id, approval!.id, occurredAt, outcome]);
      attemptId = attempt!.id;
    }
    if (previous === 'exported') {
      await owner.query(`INSERT INTO pilot.audit(tenant_id,actor_id,occurrence_id,action,reason,outcome)
        VALUES($1,$2,$3,'fixture_export','Invented historical export','exported')`, [tenant.tenant, tenant.user, id]);
    }
    intents.set(previous, { tenantId: tenant.tenant, occurrenceId: id, attemptId, location });
  }

  const fakePath = await mkdtemp(join('/dev/shm', 'maex-restore-provider-'));
  t.after(() => rm(fakePath, { recursive: true, force: true }));
  const clock = () => occurredAt.getTime();
  const sending = new FakeGbp(fakePath, { clock, loseReply: true });
  const apparentlyUnsent = intents.get('approved')!;
  try { await assert.rejects(sending.create(apparentlyUnsent), /lost after acceptance/); }
  finally { sending.close(); }
  const provider = new FakeGbp(fakePath, { clock });
  t.after(() => provider.close());

  const history = async () => (await owner.query(`SELECT
    (SELECT jsonb_agg(a ORDER BY id) FROM pilot.approvals a) AS approvals,
    (SELECT jsonb_agg(a ORDER BY id) FROM pilot.attempts a) AS attempts,
    (SELECT jsonb_agg(a ORDER BY id) FROM pilot.audit a) AS audit,
    (SELECT jsonb_agg(to_jsonb(o) - ARRAY['state','restore_previous_state'] ORDER BY id) FROM pilot.occurrences o)
      AS occurrence_bindings`)).rows[0];
  const decisions = async () => (await owner.query('SELECT tenant_id,occurrence_id,approval_id FROM pilot.occurrence_decisions')).rows;
  const compactHold = [{ tenant_id: a.tenant, occurrence_id: [...historical].find(([, state]) => state === 'held')![0], approval_id: null }];
  assert.deepEqual(await decisions(), compactHold);
  const originalHistory = await history();

  // A pre-stop snapshot may carry an enabled flag. The database still has no app login.
  await owner.query('UPDATE pilot.dispatch_control SET stopped=false');
  await seedRestoreSessions(owner, a);
  const originalSessions = await readRestoreSessions(owner);
  const assertUnchanged = async () => {
    assert.equal(await state(), false);
    const { rows } = await owner.query('SELECT id,state FROM pilot.occurrences');
    assert.deepEqual(new Map(rows.map(row => [row.id, row.state])), historical);
    assert.deepEqual(await readRestoreSessions(owner), originalSessions);
  };
  await owner.query('UPDATE public.fixture_identity SET restore_target=false');
  try {
    await assert.rejects(runQuarantine(), { code: 1, stderr: 'Fixture restore quarantine refused or failed.\n' });
    await assertUnchanged();
  } finally { await owner.query('UPDATE public.fixture_identity SET restore_target=true'); }

  await owner.query(denySessionRevocation);
  try {
    await assert.rejects(runQuarantine(), { code: 1, stderr: 'Fixture restore quarantine refused or failed.\n' });
    await assertUnchanged();
  } finally { await owner.query('ALTER TABLE pilot.sessions DROP CONSTRAINT fixture_revocation_fault'); }

  await quarantined(historical.size);
  const revokedSessions = await readRestoreSessions(owner);
  assertRestoredSessions(originalSessions, revokedSessions);
  await quarantined(0);
  assert.deepEqual(await readRestoreSessions(owner), revokedSessions);
  assert.equal(await state(), true);
  assert.deepEqual(await history(), originalHistory);
  assert.deepEqual(await decisions(), compactHold);

  const missing = intents.get('unknown')!;
  assert.equal(await reconcileOccurrence(() => connectFixture(true), apparentlyUnsent.occurrenceId, provider), null);
  assert.equal(await reconcileOccurrence(() => connectFixture(true), missing.occurrenceId, provider), 'unknown');
  const { rows } = await owner.query('SELECT id,state,restore_previous_state FROM pilot.occurrences');
  assert.deepEqual(new Map(rows.map(row => [row.id, row.restore_previous_state])), historical);
  assert.ok(rows.every(row => row.state === 'quarantined'));
  for (const intent of intents.values()) {
    assert.equal(provider.createCount(intent.tenantId, intent.occurrenceId), Number(intent === apparentlyUnsent));
  }
});
