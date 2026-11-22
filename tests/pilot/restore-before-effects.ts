import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { claimExport } from '../../apps/web/src/server/occurrence-export.js';
import type { CustomerRequest } from '../../apps/web/src/server/request.js';
import { claimDispatch } from '../../apps/worker/src/dispatch.js';
import { loadBackupKey } from '../../ops/local/backup-crypto.js';
import { capture, type Pair } from '../../ops/local/backup.js';
import { compose, connectFixture, loadFixture, safeDiagnostics, verifyContainers, type Fixture } from '../../ops/local/fixture.js';
import { restore } from '../../ops/local/restore.js';
import { binding, clock, inspect, seedDispatchApproval, type Case } from './dispatch-fixture.js';
import { FakeGbp } from './fake-gbp.js';

const command = 'dist/pilot/tests/pilot/restore-before-effects.js';
const inputPath = 'work/restore-before-effects.json';
const fixturePath = 'work/pilot';
const pairPath = fixturePath + '/cold-backup/pair.json';
const captureHistoryPath = fixturePath + '/capture-history.json';
const replayPath = fixturePath + '/restore-history.json';
const historyPath = 'work/restore-before-effects-history.json';
const recover = 'dist/pilot/ops/local/recover.js';
const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
type HistoryCase = Case & { location: string; device: string };

async function seedHistory(c: Case, label: string): Promise<HistoryCase> {
  const db = await connectFixture(true);
  try {
    const { rows: [{ location_id: location }] } = await db.query(
      'SELECT location_id FROM pilot.occurrences WHERE tenant_id=$1 AND id=$2', [c.tenant, c.id]);
    await db.query(`INSERT INTO pilot.business_fact_revisions
      (tenant_id,location_id,revision,text,source_note,evidence_kind,membership_id,membership_version,confirmed_at)
      SELECT $1,$2,revision,$3 || '-' || revision,'invented','synthetic_fixture',id,version,now()
      FROM pilot.memberships CROSS JOIN generate_series(1,2) AS revision WHERE tenant_id=$1 AND identity_id=$4`,
    [c.tenant, location, label, c.user]);
    const grant = randomUUID(), device = randomUUID();
    await db.query('INSERT INTO pilot.platform_grants(id,identity_id) VALUES($1,$2)', [grant, c.user]);
    await db.query('INSERT INTO pilot.devices(id,platform_grant_id,identity_id,public_key) VALUES($1,$2,$3,$4)',
      [device, grant, c.user, 'synthetic ' + label]);
    return { ...c, location, device };
  } finally { await db.end(); }
}

async function inspectHistory(revoke?: string) {
  const db = await connectFixture(true);
  try {
    if (revoke) {
      assert.deepEqual((await db.query(`UPDATE pilot.devices SET active=false,version=version+1
        WHERE id=$1 AND active AND version=1 RETURNING id`, [revoke])).rows, [{ id: revoke }]);
      return;
    }
    await db.query('BEGIN READ ONLY');
    const { rows: facts } = await db.query('SELECT * FROM pilot.business_fact_revisions ORDER BY location_id,revision');
    const { rows: devices } = await db.query('SELECT * FROM pilot.devices ORDER BY id');
    const { rows: [state] } = await db.query(`SELECT d.stopped,
      (SELECT rolcanlogin FROM pg_roles WHERE rolname='pilot_app') AS login,
      has_database_privilege('pilot_app',current_database(),'CONNECT') AS can_connect,
      (SELECT count(*)::int FROM pilot.occurrences o
        WHERE o.state='quarantined' AND to_jsonb(o)->>'restore_previous_state' IS NOT NULL) AS held,
      (SELECT count(*)::int FROM pilot.occurrences) AS occurrences,
      (SELECT tgenabled FROM pg_trigger WHERE tgrelid='pilot.business_fact_revisions'::regclass
        AND tgname='immutable_business_facts') AS trigger,
      marker.restore_history_after::int AS after, marker.restore_history_evidence AS evidence,
      to_jsonb(marker)->>'restore_history_source_id' AS source,
      to_jsonb(marker)->>'restore_history_digest' AS receipt
      FROM pilot.dispatch_control d CROSS JOIN public.fixture_identity marker`);
    return { facts, devices, state };
  } finally { await db.end(); }
}

async function readState(c: Case, target: boolean) {
  const db = await connectFixture(true);
  try {
    await db.query('BEGIN READ ONLY');
    const { rows: [row] } = await db.query(`SELECT o.id, o.state, o.tenant_id, o.approval_id, a.revision_id,
      (SELECT stopped FROM pilot.dispatch_control) AS stopped
      ${target ? ', o.restore_previous_state' : ''}
      FROM pilot.occurrences o JOIN pilot.approvals a
        ON a.tenant_id=o.tenant_id AND a.occurrence_id=o.id AND a.id=o.approval_id WHERE o.id=$1`, [c.id]);
    assert.equal(row?.tenant_id, c.tenant);
    assert.equal(row.approval_id, c.approvalId);
    assert.equal(row.revision_id, c.revision);
    const { rows: attempts } = await db.query('SELECT id, approval_id, outcome FROM pilot.attempts WHERE occurrence_id=$1', [c.id]);
    const { rows: effects } = await db.query(`SELECT actor_id, action, outcome FROM pilot.audit
      WHERE occurrence_id=$1 AND action IN ('dispatch_claim','occurrence_export') ORDER BY id`, [c.id]);
    return { row, attempts, effects };
  } finally { await db.end(); }
}

async function runStage(stage: string) {
  const input = JSON.parse(await readFile(inputPath, 'utf8')) as
    { a: CustomerRequest; b: CustomerRequest; cases: [HistoryCase, HistoryCase] };
  if (stage === 'seed') {
    const cases = [await seedHistory(await seedDispatchApproval(input.a, true), 'target'),
      await seedHistory(await seedDispatchApproval(input.b, false), 'control')];
    assert.notEqual(cases[0]!.id, cases[1]!.id);
    console.log(JSON.stringify(cases));
    return;
  }
  const [a, b] = input.cases;
  if (stage === 'history' || stage === 'revoke-device') {
    const fixture = await loadFixture();
    const revoke = stage === 'revoke-device';
    if (revoke) {
      assert.equal(fixture.purpose, 'backup');
      assert.equal(fixture.restoreTarget, undefined);
    }
    console.log(JSON.stringify(await inspectHistory(revoke ? a.device : undefined) ?? null));
    return;
  }
  if (stage === 'deliver') {
    const owner = await connectFixture(true);
    try {
      assert.equal((await loadFixture()).restoreTarget, undefined);
      assert.deepEqual((await owner.query('UPDATE pilot.dispatch_control SET stopped=false WHERE singleton AND stopped RETURNING stopped')).rows,
        [{ stopped: false }]);
    } finally { await owner.end(); }
    const fake = new FakeGbp('/fake');
    try {
      const result = await claimDispatch(connectFixture, a.id, fake);
      assert.equal(result.state, 'in_flight');
      const exported = await claimExport(connectFixture, input.b, b.id, clock, inspect);
      assert.ok(exported.state === 'exported' && exported.text === 'Invented plain text', 'Unexpected source export');
      console.log(JSON.stringify({ attemptId: result.attemptId }));
    } finally { fake.close(); }
    return;
  }
  const target = stage === 'target';
  const authDenials: string[] = [];
  if (target) {
    assert.equal((await loadFixture()).pairedRestore, true);
    let creates = 0;
    const fake = { policy: 'synthetic-organic-text' as const, async create() { creates++; throw new Error('Unexpected create'); } };
    const denied = (error: { code?: string }) => {
      assert.ok(error.code === '28000' || error.code === '28P01', 'Expected PostgreSQL authentication refusal');
      authDenials.push(error.code);
      return true;
    };
    await assert.rejects(claimDispatch(connectFixture, a.id, fake), denied);
    await assert.rejects(claimExport(connectFixture, input.b, b.id, clock, inspect), denied);
    assert.equal(creates, 0);
  }
  const states = await Promise.all([readState(a, target), readState(b, target)]);
  console.log(JSON.stringify(target ? { authDenials, states } : states));
}

function node(script: string, ...args: string[]) {
  return execFileSync(process.execPath, [script, ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 300_000,
  }).trim();
}

async function freshWorktree(cwd: string) {
  const git = (...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  assert.equal(git('status', '--porcelain'), '', 'The drill requires clean worktrees');
  await assert.rejects(lstat(resolve(cwd, fixturePath)), { code: 'ENOENT' });
  await lstat(resolve(cwd, command));
  return git('rev-parse', 'HEAD');
}

async function drill(targetDir: string) {
  const source = process.cwd();
  const target = resolve(targetDir);
  assert.notEqual(source.toLowerCase(), target.toLowerCase());
  const revision = await freshWorktree(source);
  assert.equal(await freshWorktree(target), revision, 'Source and target builds must use the same revision');
  await loadBackupKey(target);
  const input = { a: binding(), b: binding(), cases: [] as HistoryCase[] };
  const fakeDir = resolve('work/restore-before-effects-fake');
  const save = (flag: 'w' | 'wx') => writeFile(inputPath, JSON.stringify(input), { flag, mode: 0o600 });
  const stage = (fixture: Fixture, name: string) => {
    verifyContainers(fixture);
    return JSON.parse(compose(fixture, ['run', '--rm', '--no-deps', '--pull', 'never', 'runner', 'node', command, name]));
  };
  await mkdir('work', { recursive: true });
  await mkdir(fakeDir);
  await save('wx');
  let targetInput = false;
  let sourceFixture: Fixture | undefined, targetFixture: Fixture | undefined;
  let phase = 'cold capture';
  try {
    await capture(true, f => {
      sourceFixture = f;
      input.cases = stage(f, 'seed');
    });
    await save('w');
    const pair = await readFile(pairPath);
    const captureHistory = await readFile(captureHistoryPath);
    const { format, historyAnchor, fixtureId } = JSON.parse(pair.toString()) as Pair;
    assert.equal(format, 3);
    const f = await loadFixture();
    assert.ok(historyAnchor);
    const { after: snapshotSequence, evidenceSha256 } = historyAnchor;
    assert.equal(fixtureId, f.id);
    assert.equal(JSON.parse(captureHistory.toString()).through, snapshotSequence);
    assert.equal(sha256(captureHistory), evidenceSha256);
    const [a, b] = input.cases as [HistoryCase, HistoryCase];
    phase = 'continued source';
    compose(f, ['start', '--wait', '--wait-timeout', '120']);
    const snapshot: NonNullable<Awaited<ReturnType<typeof inspectHistory>>> = stage(f, 'history');
    assert.equal(snapshot.facts.length, 4);
    assert.equal(snapshot.devices.length, 2);
    for (const [c, label] of [[a, 'target'], [b, 'control']] as const) {
      assert.deepEqual(snapshot.facts.filter(row => row.tenant_id === c.tenant && row.location_id === c.location)
        .map(row => [row.revision, row.text]), [[1, label + '-1'], [2, label + '-2']]);
      const device = snapshot.devices.find(row => row.id === c.device);
      assert.deepEqual([device?.identity_id, device?.active, device?.version], [c.user, true, 1]);
    }
    assert.deepEqual(snapshot.state, { stopped: true, login: true, can_connect: true, held: 0, occurrences: 5,
      trigger: 'O', after: snapshotSequence, evidence: evidenceSha256, source: null, receipt: null });
    const history = {
      schema: 1, fixtureId, after: snapshotSequence, through: snapshotSequence + 2,
      records: [
        { seq: snapshotSequence + 1, kind: 'delete-facts', tenantId: a.tenant, id: a.location },
        { seq: snapshotSequence + 2, kind: 'revoke-device', id: a.device, version: 1 },
      ],
    };
    const historyBytes = JSON.stringify(history);
    const historyDigest = sha256(historyBytes);
    await writeFile(historyPath, historyBytes, { flag: 'wx', mode: 0o600 });
    stage(f, 'revoke-device');
    const revokedDevices = snapshot.devices.map(row => row.id === a.device ? { ...row, active: false, version: 2 } : row);
    assert.deepEqual(stage(f, 'history'), { ...snapshot, devices: revokedDevices });
    const before = stage(f, 'source');
    for (const c of before) {
      assert.equal(c.row.state, 'approved');
      assert.equal(c.row.stopped, true);
      assert.deepEqual([c.attempts, c.effects], [[], []]);
    }
    const { attemptId } = JSON.parse(compose(f, ['run', '--rm', '--no-deps', '--pull', 'never',
      '--volume', fakeDir + ':/fake', 'runner', 'node', command, 'deliver']));
    const after = stage(f, 'source');
    assert.deepEqual(after, [
      { row: { ...before[0].row, state: 'in_flight', stopped: false },
        attempts: [{ id: attemptId, approval_id: a.approvalId, outcome: 'unknown' }],
        effects: [{ actor_id: a.user, action: 'dispatch_claim', outcome: 'in_flight' }] },
      { row: { ...before[1].row, state: 'exported', stopped: false }, attempts: [],
        effects: [{ actor_id: b.user, action: 'occurrence_export', outcome: 'exported' }] },
    ]);
    const checkFake = () => {
      const fake = new DatabaseSync(resolve(fakeDir, 'fake-gbp.sqlite'), { readOnly: true });
      try {
        const rows = fake.prepare('SELECT tenant, occurrence, attempt, intent FROM calls JOIN call_intents ON id=call_id').all();
        assert.equal(fake.prepare('SELECT count(*) AS total FROM calls').get()!.total, 1);
        assert.equal(rows.length, 1);
        const [receipt] = rows;
        assert.deepEqual([receipt!.tenant, receipt!.occurrence, receipt!.attempt], [a.tenant, a.id, attemptId]);
        const intent = JSON.parse(String(receipt!.intent));
        assert.deepEqual([intent.approvalId, intent.revisionId], [a.approvalId, a.revision]);
      } finally { fake.close(); }
    };
    checkFake();
    const archive = resolve(fixturePath);
    phase = 'offline paired restore';
    process.chdir(target);
    await mkdir('work', { recursive: true });
    await save('wx');
    targetInput = true;
    const restored = await restore(archive, f => { targetFixture = f; });
    const t = await loadFixture();
    const topology = { internalNetworks: 2, publishedHostPorts: 0 };
    const quarantine = { stopped: true, applicationLogin: false, topology };
    assert.deepEqual(restored, { verifiedDatabases: 2, quarantined: 5, ...quarantine });
    assert.notEqual(t.id, fixtureId);
    const checkIdentityLock = () => assert.equal(compose(t, ['exec', '-T', '--user', 'postgres', 'identity-db',
      'psql', '-XAt', '-U', 'identity_owner', '-d', 'identity_fixture', '-c',
      "SELECT NOT rolcanlogin FROM pg_roles WHERE rolname='keycloak'"]), 't');
    checkIdentityLock();
    const expected = before.map((c: typeof before[number]) => ({
      ...c, row: { ...c.row, state: 'quarantined', restore_previous_state: 'approved' },
    }));
    phase = 'unprivileged repeat and repeated quarantine';
    const reopen = spawnSync(process.execPath, ['dist/pilot/ops/local/dispatch-control.js', 'reopen'],
      { encoding: 'utf8', timeout: 10_000 });
    assert.equal(reopen.status, 1);
    assert.equal(reopen.stdout, '');
    assert.equal(reopen.stderr.trim(), 'Dispatch reopen requires an ordinary fixture manifest.');
    const first = stage(t, 'target');
    assert.deepEqual(first.states, expected);
    assert.equal(first.authDenials.length, 2);
    assert.deepEqual(JSON.parse(node(recover)), { quarantined: 0, ...quarantine });

    phase = 'bound history replay';
    const held = { ...snapshot, state: { ...snapshot.state, login: false, can_connect: false, held: 5, source: fixtureId } };
    assert.deepEqual(stage(t, 'history'), held);
    const replayArgs = (digest: string): [string, ...string[]] => [recover, 'replay-history', String(history.after), String(history.through), digest];
    const refuseReplay = (digest: string) => {
      const attempt = spawnSync(process.execPath, replayArgs(digest), { encoding: 'utf8', timeout: 45_000 });
      assert.equal(attempt.status, 1);
      assert.equal(attempt.stdout, '');
      assert.equal(attempt.stderr.trim(), 'Fixture restore quarantine refused or failed.');
      assert.deepEqual(stage(t, 'history'), held);
    };
    refuseReplay(historyDigest);
    const incomplete = JSON.stringify({ ...history, records: history.records.slice(0, 1) });
    await writeFile(replayPath, incomplete, { flag: 'wx', mode: 0o600 });
    refuseReplay(sha256(incomplete));
    await writeFile(replayPath, historyBytes);
    refuseReplay('0'.repeat(64));

    const appliedState = {
      facts: snapshot.facts.filter(row => row.location_id === b.location),
      devices: revokedDevices,
      state: { ...held.state, receipt: historyDigest },
    };
    const checkReplay = (applied: number) => {
      assert.deepEqual(JSON.parse(node(...replayArgs(historyDigest))),
        { quarantined: 0, ...quarantine, history: { applied } });
      assert.deepEqual(stage(t, 'history'), appliedState);
    };
    checkReplay(2);
    checkReplay(0);

    phase = 'offline target restart';
    compose(t, ['stop', 'postgres', 'identity-db']);
    compose(t, ['start', '--wait', '--wait-timeout', '90', 'postgres', 'identity-db']);
    checkIdentityLock();
    assert.deepEqual(stage(t, 'history'), appliedState);
    checkReplay(0);
    assert.equal(await readFile(replayPath, 'utf8'), historyBytes);
    const repeated = stage(t, 'target');
    assert.deepEqual(repeated.states, expected);
    assert.equal(repeated.authDenials.length, 2);

    phase = 'archive, source and fake comparison';
    process.chdir(source);
    assert.deepEqual(stage(f, 'source'), after);
    assert.deepEqual(stage(f, 'history'), {
      ...snapshot, devices: revokedDevices, state: { ...snapshot.state, stopped: false },
    });
    assert.ok((await readFile(captureHistoryPath)).equals(captureHistory), 'Capture history changed');
    assert.equal(await readFile(historyPath, 'utf8'), historyBytes);
    checkFake();
    assert.ok((await readFile(pairPath)).equals(pair), 'Pair manifest changed');
    assert.equal(node('dist/pilot/ops/local/backup.js', 'verify'), 'Verified synthetic AppDB and IdP backup pair.');
    return { revision, source: after, target: expected, fakeCreates: 1,
      targetAuthDenials: [...first.authDenials, ...repeated.authDenials], ...quarantine,
      history: { snapshotSequence, sourceFactsRetained: 4, targetFactsRemoved: 2, controlFactsRetained: 2,
        revokedDeviceVersion: 2, controlDeviceVersion: 1, invalidReplaysRefused: 3,
        applied: 2, repeatApplied: 0, restartApplied: 0, originalInputsVerified: true } };
  } catch (error) {
    console.error('Restore drill failed during ' + phase + '.');
    throw error;
  } finally {
    const stop = async (fixture?: Fixture) => {
      try { await unlink(inputPath); }
      finally {
        if (fixture) {
          assert.equal((await loadFixture(true)).id, fixture.id, 'Fixture ownership changed');
          compose(fixture, ['down']);
        }
      }
    };
    try {
      if (targetInput) {
        process.chdir(target);
        await stop(targetFixture);
      }
    } finally {
      process.chdir(source);
      await stop(sourceFixture);
    }
  }
}

const [argument, ...extra] = process.argv.slice(2);
const inRunner = process.env.PILOT_CONTAINER === '1';
if (!argument || extra.length || (inRunner && !['seed', 'deliver', 'source', 'target', 'history', 'revoke-device'].includes(argument))) {
  throw new Error('Run from a fresh built source worktree with one fresh built target worktree path.');
}
(inRunner ? runStage(argument) : drill(argument).then(result => console.log(JSON.stringify(result)))).catch(error => {
  const detail = error instanceof Error
    ? safeDiagnostics(String((error as { stderr?: string }).stderr || error.message)) : 'Unknown drill failure.';
  console.error(detail);
  process.exitCode = 1;
});
