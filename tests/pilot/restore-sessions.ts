import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile, realpath, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Client } from 'pg';
import { capture, databases, volumeName, type Pair } from '../../ops/local/backup.js';
import { compose, connectFixture, docker, loadFixture, runIsolatedFixture, safeDiagnostics, type Fixture } from '../../ops/local/fixture.js';
import { restore } from '../../ops/local/restore.js';
import { seedTenant } from './fixtures.js';
import { assertRestoredSessions, denySessionRevocation, readRestoreSessions, seedRestoreSessions } from './restore-session-fixture.js';

const script = 'dist/pilot/tests/pilot/restore-sessions.js';
const fixtureDir = 'work/pilot';
const backup = 'dist/pilot/ops/local/backup.js';
const quarantine = 'dist/pilot/ops/local/recover.js';
const ready = fixtureDir + '/restore-ready.json';
const pairFile = fixtureDir + '/cold-backup/pair.json';
const allOffline = { internalNetworks: 2, publishedHostPorts: 0 };
const databaseServices = databases.map(db => db.service);
const missing = async (path: string) => assert.rejects(lstat(path), { code: 'ENOENT' });
const run = (command: string, ...args: string[]) =>
  execFileSync(process.execPath, [command, ...args], { encoding: 'utf8', timeout: 60_000 }).trim();

async function readEvidence(db: Client) {
  const { rows: [row] } = await db.query<{
    target: boolean; login: boolean; can_connect: boolean; stopped: boolean;
    occurrences: number; held: number; receipt: string | null; audit: string;
  }>(`SELECT m.restore_target AS target,
    (SELECT rolcanlogin FROM pg_roles WHERE rolname='pilot_app') AS login,
    has_database_privilege('pilot_app',current_database(),'CONNECT') AS can_connect,
    to_jsonb(m)->>'restore_history_digest' AS receipt, d.stopped,
    (SELECT count(*)::int FROM pilot.occurrences) AS occurrences,
    (SELECT count(*)::int FROM pilot.occurrences o WHERE o.state='quarantined'
      AND to_jsonb(o)->>'restore_previous_state'='draft') AS held,
    (SELECT encode(sha256(convert_to(jsonb_agg(a ORDER BY id)::text,'UTF8')),'hex') FROM pilot.audit a) AS audit
    FROM public.fixture_identity m CROSS JOIN pilot.dispatch_control d`);
  return { ...row!, sessions: await readRestoreSessions(db) };
}

async function inRunner(stage: string) {
  const f = await loadFixture();
  const db = await connectFixture(true);
  try {
    if (stage !== 'read') {
      assert.equal(f.purpose, 'backup');
      assert.equal(f.restoreTarget, undefined);
      const tenant = await seedTenant(db);
      await seedRestoreSessions(db, tenant);
      await db.query(`INSERT INTO pilot.audit(tenant_id,actor_id,action,reason,outcome)
        VALUES($1,$2,'fixture_session_history','Invented previous revocation','revoked')`, [tenant.tenant, tenant.user]);
      if (stage === 'seed-fault') await db.query(denySessionRevocation);
    }
    await db.query('BEGIN READ ONLY');
    console.log(JSON.stringify(await readEvidence(db)));
  } finally { await db.end(); }
}

function stage(f: Fixture, action: 'seed' | 'seed-fault' | 'read'): Awaited<ReturnType<typeof readEvidence>> {
  return JSON.parse(runIsolatedFixture(f, [script, action]).output);
}

function refused(args: string[]) {
  const result = spawnSync(process.execPath, [quarantine, ...args], { encoding: 'utf8', timeout: 60_000 });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr.trim(), 'Fixture restore quarantine refused or failed.');
}

async function drill(targetPath: string, controlPath: string, failurePath: string) {
  const [source, target, control, failure] = await Promise.all([
    realpath(process.cwd()), realpath(resolve(targetPath)), realpath(resolve(controlPath)), realpath(resolve(failurePath)),
  ]);
  const worktrees = [source, target, control, failure];
  assert.equal(new Set(worktrees.map(path => path.toLowerCase())).size, 4);
  const prepared = await Promise.all(worktrees.map(async cwd => {
    await missing(resolve(cwd, fixtureDir));
    await lstat(resolve(cwd, script));
    const git = (...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
    assert.equal(git('status', '--porcelain'), '', 'The drill requires clean worktrees');
    return git('rev-parse', 'HEAD');
  }));
  assert.equal(new Set(prepared).size, 1, 'The drill requires matching revisions');

  const owned = new Map<string, Fixture>();
  let phase = 'capture';
  const captureSource = async (cwd: string, fail: boolean) => {
    phase = fail ? 'independent fault-control capture' : 'source capture';
    process.chdir(cwd);
    let seeded: Awaited<ReturnType<typeof readEvidence>> | undefined;
    await capture(true, f => {
      owned.set(cwd, f);
      seeded = stage(f, fail ? 'seed-fault' : 'seed');
    });
    assert.ok(seeded);
    const f = await loadFixture();
    const original = await readFile(pairFile, 'utf8');
    const pair = JSON.parse(original) as Pair;
    assert.equal(pair.format, 3);
    assert.ok(pair.historyAnchor);
    assert.equal(pair.fixtureId, f.id);
    const beforeHistory = await readFile(fixtureDir + '/capture-history.json', 'utf8');
    compose(f, ['start', '--wait', '--wait-timeout', '120']);
    const before = stage(f, 'read');
    assert.deepEqual(before, { ...seeded, occurrences: 3 });
    assert.deepEqual([before.target, before.login, before.can_connect, before.held], [false, true, true, 0]);
    refused([]);
    assert.deepEqual(stage(f, 'read'), before);
    return { f, before, pair, original, beforeHistory, dir: resolve(fixtureDir) };
  };

  try {
    const normal = await captureSource(source, false);
    const other = await captureSource(control, true);
    assert.notEqual(other.f.id, normal.f.id);
    assert.notDeepEqual(other.before.sessions.map(row => row.bindings), normal.before.sessions.map(row => row.bindings));

    phase = 'paired restore with a session update fault';
    process.chdir(failure);
    let failedTarget: Fixture | undefined;
    await assert.rejects(restore(other.dir, f => { failedTarget = f; }), {
      message: 'Paired restore failed during offline quarantine; target storage was removed and has no readiness record.',
    });
    assert.ok(failedTarget);
    await missing(ready);
    await missing(fixtureDir + '/restore-ready.pending');
    for (const resource of ['ps', 'volume', 'network']) {
      const args = resource === 'ps' ? ['ps', '-aq'] : [resource, 'ls', '-q'];
      assert.equal(docker([...args, '--filter', 'label=com.docker.compose.project=' + failedTarget.project]), '');
    }
    for (const db of databases) {
      assert.equal(docker(['volume', 'ls', '--format', '{{.Name}}']).split(/\s+/).includes(volumeName(failedTarget, db)), false);
    }

    phase = 'ordinary encrypted paired restore';
    process.chdir(target);
    const restored = await restore(normal.dir, f => { owned.set(target, f); });
    const t = await loadFixture();
    assert.equal(new Set([t.id, normal.f.id, other.f.id, failedTarget.id]).size, 4);
    assert.equal(t.pairedRestore, true);
    const receipt = await readFile(ready, 'utf8');
    assert.deepEqual(restored, {
      verifiedDatabases: 2, quarantined: normal.before.occurrences, stopped: true, applicationLogin: false, topology: allOffline,
    });
    assert.deepEqual(JSON.parse(receipt), restored);
    const checkIdentityMarker = () => assert.equal(compose(t, ['exec', '-T', '--user', 'postgres', 'identity-db',
      'psql', '-XAt', '-v', 'ON_ERROR_STOP=1', '-U', 'identity_owner', '-d', 'identity_fixture', '-c',
      `SELECT NOT rolcanlogin AND EXISTS (SELECT 1 FROM user_entity
        WHERE username='cold-backup-${normal.f.id}' AND NOT enabled) FROM pg_roles WHERE rolname='keycloak'`]), 't');
    checkIdentityMarker();
    const after = stage(t, 'read');
    assert.deepEqual(after, {
      ...normal.before, target: true, login: false, can_connect: false, stopped: true,
      held: normal.before.occurrences, sessions: after.sessions,
    });
    assertRestoredSessions(normal.before.sessions, after.sessions);
    const noSessionChanges = async () => {
      assert.deepEqual(stage(t, 'read'), after);
      assert.equal(await readFile(ready, 'utf8'), receipt);
    };

    phase = 'incomplete independent history and retained restart';
    const afterSequence = normal.pair.historyAnchor!.after;
    const incomplete = JSON.stringify({ schema: 1, fixtureId: normal.f.id,
      after: afterSequence, through: afterSequence + 1, records: [] });
    await writeFile(fixtureDir + '/restore-history.json', incomplete, { mode: 0o600, flag: 'wx' });
    refused(['replay-history', String(afterSequence), String(afterSequence + 1), createHash('sha256').update(incomplete).digest('hex')]);
    await noSessionChanges();
    compose(t, ['stop', ...databaseServices]);
    compose(t, ['start', '--wait', '--wait-timeout', '90', ...databaseServices]);
    checkIdentityMarker();
    await noSessionChanges();
    assert.deepEqual(JSON.parse(run(quarantine)), { quarantined: 0, stopped: true, applicationLogin: false, topology: allOffline });
    await noSessionChanges();
    const reopen = spawnSync(process.execPath, ['dist/pilot/ops/local/dispatch-control.js', 'reopen'], {
      encoding: 'utf8', timeout: 10_000,
    });
    assert.equal(reopen.status, 1);
    assert.equal(reopen.stderr.trim(), 'Dispatch reopen requires an ordinary fixture manifest.');

    phase = 'source and independent control readback';
    for (const [cwd, fixture] of [[source, normal], [control, other]] as const) {
      process.chdir(cwd);
      assert.deepEqual(stage(fixture.f, 'read'), fixture.before);
      assert.equal(await readFile(pairFile, 'utf8'), fixture.original);
      assert.equal(await readFile(fixtureDir + '/capture-history.json', 'utf8'), fixture.beforeHistory);
      assert.equal(run(backup, 'verify'), 'Verified synthetic AppDB and IdP backup pair.');
    }
    return { databases: restored.verifiedDatabases, sessionsRevoked: 2, priorRevocationsPreserved: 2,
      auditPreserved: true, sourceAndSeparateControlPreserved: true, incompleteHistoryRefused: true,
      failureWithoutReadiness: true, retainedRestart: true, reopenRefused: true, ...allOffline };
  } catch (error) {
    console.error('Session restore drill failed during ' + phase + '.');
    throw error;
  } finally {
    for (const [cwd, f] of owned) {
      process.chdir(cwd);
      try {
        assert.equal((await loadFixture(true)).id, f.id, 'Fixture ownership changed');
        compose(f, ['down']);
      } catch (error) {
        console.error('Owned fixture teardown could not be confirmed.');
        process.exitCode = 1;
      }
    }
    process.chdir(source);
  }
}

const args = process.argv.slice(2);
const inContainer = process.env.PILOT_CONTAINER === '1';
if (inContainer ? args.length !== 1 || !['seed', 'seed-fault', 'read'].includes(args[0]!) : args.length !== 3) {
  throw new Error('Run from a clean built source with fresh target, fault-control and failure-target worktrees.');
}
(inContainer ? inRunner(args[0]!) : drill(args[0]!, args[1]!, args[2]!).then(result => console.log(JSON.stringify(result))))
  .catch(error => {
    const detail = error instanceof Error ? (error as { stderr?: string }).stderr || error.message : 'Unknown drill failure.';
    console.error(safeDiagnostics(detail).replace(/[a-f0-9]{32}/gi, '[fixture id]'));
    process.exitCode = 1;
  });
