import assert from 'node:assert/strict';
import { execFile, execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { promisify } from 'node:util';
import type { Client } from 'pg';
import { providerStateDirectory } from '../../apps/worker/src/fake-gbp.js';
import { compose, connectFixture, loadFixture, verifyContainers } from '../../ops/local/fixture.js';
import { binding, seedDispatchApproval } from './dispatch-fixture.js';

const entry = 'dist/pilot/apps/worker/src/main.js';
const harness = 'dist/pilot/tests/pilot/worker-wake.test.js';
const sqlitePath = join(providerStateDirectory, 'fake-gbp.sqlite');
const refused = 'Local worker wake refused or failed.';
const exec = promisify(execFile);
const node = (file: string, ...args: string[]) => execFileSync(process.execPath, [file, ...args],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180_000 }).trim();
const control = (action: string) => JSON.parse(node('dist/pilot/ops/local/dispatch-control.js', action));

function assertRefusal(args: string[], cwd = process.cwd()) {
  const result = spawnSync(process.execPath, [resolve(entry), ...args], { cwd, encoding: 'utf8', timeout: 15_000 });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr.trim(), refused);
}

async function counters(db: Client) {
  return (await db.query(`
    SELECT (SELECT count(*)::int FROM pilot.attempts) AS attempts,
      (SELECT count(*)::int FROM pilot.audit WHERE action='dispatch_claim') AS claims,
      (SELECT count(*)::int FROM pilot.audit WHERE action='occurrence_export') AS exports,
      (SELECT count(*)::int FROM pilot.budget_reservations) AS reservations,
      (SELECT COALESCE(sum(settled_units),0)::int FROM pilot.budget_reservations WHERE state='settled') AS charged,
      (SELECT count(*)::int FROM information_schema.tables WHERE table_schema='pilot'
        AND table_name ~ '(media|job|storage)') AS "mediaRelations"
  `)).rows[0];
}

async function overlap(db: Client, id: string) {
  const observer = await connectFixture(true);
  try {
    await db.query('BEGIN');
    await db.query(`SELECT d.id FROM pilot.drafts d JOIN pilot.occurrences o ON o.tenant_id=d.tenant_id AND o.draft_id=d.id
      WHERE o.id=$1 FOR UPDATE OF d`, [id]);
    const wakes = Promise.allSettled([1, 2].map(() => exec(process.execPath, [entry, id], { timeout: 15_000 })));
    let blocked = 0;
    try {
      const deadline = performance.now() + 4_000;
      while (blocked !== 2 && performance.now() < deadline) {
        const result = await observer.query(`SELECT count(*)::int AS blocked FROM pg_stat_activity
          WHERE usename='pilot_app' AND wait_event_type='Lock' AND query=$1`,
        ['SELECT id FROM pilot.drafts WHERE tenant_id=$1 AND id=$2 FOR UPDATE']);
        blocked = result.rows[0].blocked;
      }
    } finally {
      await db.query('ROLLBACK');
      await wakes;
    }
    assert.equal(blocked, 2, 'two distinct worker sessions waited on the draft lock');
    const states = (await wakes).map(result => {
      if (result.status === 'rejected') throw result.reason;
      return JSON.parse(result.value.stdout).state;
    });
    assert.equal(states.filter(state => state === 'in_flight').length, 1);
    assert.equal(states.filter(state => state === 'unknown' || state === 'pending').length, 1);
    return blocked;
  } finally {
    await observer.end();
  }
}

async function isolated(stage: string, id?: string, controlId?: string) {
  const db = await connectFixture(true);
  try {
    if (stage === 'exercise') {
      const approved = await seedDispatchApproval(binding(), true);
      const control = await seedDispatchApproval(binding(), true);
      await db.query('INSERT INTO pilot.budgets(tenant_id,synthetic_units) VALUES ($1,10),($2,10)',
        [approved.tenant, control.tenant]);
      const before = await counters(db);
      await db.query('UPDATE public.fixture_identity SET restore_target=true');
      try {
        assertRefusal([control.id]);
      } finally {
        await db.query('UPDATE public.fixture_identity SET restore_target=false');
      }
      assert.deepEqual(await counters(db), before);
      const blocked = await overlap(db, approved.id);
      console.log(JSON.stringify({ approved, control, before, blocked }));
      return;
    }

    assert.equal(stage, 'snapshot');
    const { rows } = await db.query(`
      SELECT o.id, o.state, a.id AS "attemptId", a.approval_id AS "approvalId", p.revision_id AS "revisionId"
      FROM pilot.occurrences o LEFT JOIN pilot.attempts a ON a.tenant_id=o.tenant_id AND a.occurrence_id=o.id
      LEFT JOIN pilot.approvals p ON p.tenant_id=a.tenant_id AND p.occurrence_id=a.occurrence_id AND p.id=a.approval_id
      WHERE o.id IN ($1,$2) ORDER BY o.id
    `, [id, controlId]);
    console.log(JSON.stringify({ counters: await counters(db), rows }));
  } finally {
    await db.end();
  }
}

function fakeCounters() {
  if (!existsSync(sqlitePath)) return { calls: 0, intents: 0 };
  const db = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    const row = db.prepare('SELECT (SELECT count(*) FROM calls) AS calls, (SELECT count(*) FROM call_intents) AS intents').get()!;
    return { calls: Number(row.calls), intents: Number(row.intents) };
  } finally {
    db.close();
  }
}

function assertStoredText(attemptId: string, occurrenceId: string, revisionId: string) {
  const db = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    const rows = db.prepare('SELECT i.intent FROM call_intents i JOIN calls c ON c.id=i.call_id WHERE c.occurrence=?')
      .all(occurrenceId);
    assert.equal(rows.length, 1);
    const stored = JSON.parse(String(rows[0]!.intent));
    assert.equal(stored.attemptId, attemptId);
    assert.equal(stored.revisionId, revisionId);
    assert.equal(stored.text, 'Invented plain text');
  } finally {
    db.close();
  }
}

if (process.env.PILOT_CONTAINER === '1' && process.argv[2]) {
  isolated(process.argv[2], process.argv[3], process.argv[4]).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
} else {
  test('worker refuses a restore manifest from another worktree before reaching a runner', async t => {
    const root = await mkdtemp(join(tmpdir(), 'maex-worker-restore-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const dir = join(root, 'work', 'pilot');
    await mkdir(join(dir, 'provider-state'), { recursive: true });
    const id = 'a'.repeat(32), password = 'b'.repeat(64);
    await writeFile(join(dir, 'fixture.json'), JSON.stringify({
      schema: 1, id, project: 'maex-pilot-' + id, expiresAt: Date.now() + 60_000,
      purpose: 'paired-restore', restoreTarget: true, pairedRestore: true,
      ownerPassword: password, appPassword: password, identityPassword: password, keycloakPassword: password,
    }));
    assertRefusal([randomUUID()], root);
    assert.deepEqual(await readdir(join(dir, 'provider-state')), []);
  });

  test('isolated worker entry overlaps claims, restarts and refuses extra wake data', { timeout: 180_000 }, async () => {
    const fixture = await loadFixture();
    assert.deepEqual(verifyContainers(fixture, true), { internalNetworks: 2, publishedHostPorts: 0 });
    const runHarness = (...args: string[]) => JSON.parse(compose(fixture, ['run', '--rm', '-T', '--no-deps',
      '--pull', 'never', '--volume', resolve(providerStateDirectory) + ':/workspace/' + providerStateDirectory,
      'runner', 'node', harness, ...args]));
    const wasStopped = control('status').stopped;
    try {
      if (wasStopped) control('reopen');
      const fakeBefore = fakeCounters();
      const { approved, control: eligible, before, blocked } = runHarness('exercise');
      assert.deepEqual(fakeCounters(), { calls: fakeBefore.calls + 1, intents: fakeBefore.intents + 1 });

      const snapshot = () => runHarness('snapshot', approved.id, eligible.id);
      const preDenial = snapshot();
      const fakeAfter = fakeCounters();
      const files = await readdir(providerStateDirectory);
      for (const args of [
        [JSON.stringify({ occurrenceId: eligible.id, media: ['https://media.invalid/worker-canary'] })],
        [eligible.id, '--media=work/worker-canary.jpg'],
        [eligible.id, JSON.stringify({ tenantId: approved.tenant, role: 'Manager', target: 'override',
          payload: 'worker-canary', adapter: './worker-canary.js' })],
      ]) assertRefusal(args);
      const afterDenial = snapshot();
      const fakeAfterDenial = fakeCounters();
      const filesAfterDenial = await readdir(providerStateDirectory);
      assert.deepEqual(afterDenial, preDenial);
      assert.deepEqual(fakeAfterDenial, fakeAfter);
      assert.deepEqual(filesAfterDenial, files);

      control('stop');
      assert.deepEqual(JSON.parse(node(entry, eligible.id)), { state: 'denied' });
      const restarts = await Promise.all([1, 2].map(() => exec(process.execPath, [entry, approved.id], { timeout: 45_000 })));
      for (const restart of restarts) assert.deepEqual(JSON.parse(restart.stdout), { state: 'pending' });
      const after = snapshot();
      assert.deepEqual(after.counters, { ...before, attempts: before.attempts + 1, claims: before.claims + 1 });
      assert.equal(after.counters.mediaRelations, 0);
      const a = after.rows.find((row: { id: string }) => row.id === approved.id);
      assert.equal(a.state, 'pending');
      assert.equal(a.approvalId, approved.approvalId);
      assert.equal(a.revisionId, approved.revision);
      assertStoredText(a.attemptId, approved.id, approved.revision);
      assert.deepEqual(after.rows.find((row: { id: string }) => row.id === eligible.id),
        { id: eligible.id, state: 'approved', attemptId: null, approvalId: null, revisionId: null });
      assert.deepEqual(fakeCounters(), fakeAfter);
      console.log(JSON.stringify({ blockedWorkerSessions: blocked, creates: fakeAfter.calls - fakeBefore.calls,
        attempts: after.counters.attempts - before.attempts, approvedIntents: fakeAfter.intents - fakeBefore.intents,
        extraWakeDenials: 3, extraEffects: { creates: fakeAfterDenial.calls - fakeAfter.calls,
          attempts: afterDenial.counters.attempts - preDenial.counters.attempts,
          exports: afterDenial.counters.exports - preDenial.counters.exports,
          reservations: afterDenial.counters.reservations - preDenial.counters.reservations,
          charged: afterDenial.counters.charged - preDenial.counters.charged },
        mediaRelations: after.counters.mediaRelations, extraProviderFiles: filesAfterDenial.length - files.length,
        publishedHostPorts: 0 }));
    } finally {
      if (control('status').stopped !== wasStopped) control(wasStopped ? 'stop' : 'reopen');
    }
  });
}
