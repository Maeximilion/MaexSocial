import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, lstat, mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { capture, captureContinuedFixture, hashFile, type Pair } from '../../ops/local/backup.js';
import { compose, connectFixture, loadFixture, verifyContainers, type Fixture } from '../../ops/local/fixture.js';
import { restore } from '../../ops/local/restore.js';
import { applySourceDraftErasure } from '../../ops/local/source-draft-erasure.js';
import { abortPurge, issue, racePurge, seedSamples, state, type Samples } from './draft-erasure-fixture.js';

const input = 'work/draft-erasure-samples.json';
const journal = 'work/pilot/restore-history.json';
const script = 'dist/pilot/tests/pilot/draft-erasure.js';
const recover = 'dist/pilot/ops/local/recover.js';
const erase = 'dist/pilot/ops/local/source-draft-erasure.js';
const sha = (s: string) => createHash('sha256').update(s).digest('hex');

async function stage(name: string) {
  if (name === 'seed') return seedSamples();
  const samples: Samples = JSON.parse(await readFile(input, 'utf8'));
  const db = await connectFixture(true);
  try {
    const f = await loadFixture();
    const { rows: [m] } = await db.query('SELECT restore_history_after::int AS after FROM public.fixture_identity');
    const seq = m.after + 1;
    if (name === 'issue') return await issue(db, samples, m.after);
    if (name === 'append') return await issue(db, samples, m.after, await readFile(journal, 'utf8'));
    if (name === 'abort') await abortPurge(db, seq, samples);
    else if (name === 'race') {
      return [await racePurge(db, samples, seq, 0), await racePurge(db, samples, seq + 1, 1)];
    } else if (name === 'refuse') {
      await assert.rejects(applySourceDraftErasure(seq));
      assert.equal((await db.query('SELECT count(*)::int AS n FROM pilot.fixture_draft_erasure WHERE applied_xid IS NOT NULL')).rows[0].n, 0);
    } else if (name === 'before' || name === 'after') {
      await state(db, samples, name === 'after', !!f.restoreTarget);
    } else throw new Error('Unknown test stage');
    return true;
  } finally { await db.end(); }
}

function run(f: Fixture, name: string) {
  verifyContainers(f);
  const mount = f.restoreTarget ? [] : ['--volume', resolve('work/pilot/provider-state') + ':/workspace/work/pilot/provider-state'];
  return JSON.parse(compose(f, ['run', '--rm', '--no-deps', '--pull', 'never', ...mount, 'runner', 'node', script, name]));
}

async function originals(path: string) {
  const results = [];
  for (const file of (await readdir(path + '/cold-backup')).sort()) results.push(await hashFile(path + '/cold-backup/' + file));
  results.push(await hashFile(path + '/capture-history.json'), await hashFile(process.env.MAEX_COLD_BACKUP_KEY_FILE!));
  return results;
}

async function drill() {
  const archive = resolve('work/draft-erasure-source');
  const cli = (cmd: string, ...args: string[]) => JSON.parse(execFileSync(process.execPath, [cmd, ...args],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 90_000 }));
  for (const path of [archive, input, 'work/pilot']) await assert.rejects(lstat(path), { code: 'ENOENT' });
  let active: Fixture | undefined;
  try {
    let samples: Samples | undefined;
    await capture(true, f => { active = f; samples = run(f, 'seed'); });
    assert.ok(samples);
    await writeFile(input, JSON.stringify(samples), { flag: 'wx', mode: 0o600 });
    const f = await loadFixture();
    const pair: Pair = JSON.parse(await readFile('work/pilot/cold-backup/pair.json', 'utf8'));
    assert.equal(pair.format, 3);
    const prior = await originals('work/pilot');
    compose(f, ['start', '--wait', '--wait-timeout', '120']);
    run(f, 'before');
    run(f, 'refuse');
    const earlier: string = run(f, 'issue');
    await writeFile(journal, earlier, { flag: 'wx', mode: 0o600 });
    compose(f, ['stop']);
    const intervalPair = 'work/pilot/issued-draft-backup';
    await mkdir(intervalPair, { mode: 0o700 });
    for (const file of ['fixture.json', 'compose.env', 'keycloak.conf', 'keycloak-realm.json', 'capture-history.json']) {
      await copyFile('work/pilot/' + file, intervalPair + '/' + file);
    }
    await captureContinuedFixture(f.id, intervalPair + '/cold-backup');
    const savedInterval = await originals(intervalPair);
    compose(f, ['start', '--wait', '--wait-timeout', '120']);
    const history: string = run(f, 'append');
    const log = JSON.parse(history);
    const changedEarlier = { ...log, records: [log.records[0], { ...log.records[1], id: samples.drafts[2]!.draft }, log.records[2]] };
    for (const wrong of [
      changedEarlier,
      { ...log, fixtureId: 'wrong' },
      { ...log, records: [{ ...log.records[0], kind: 'delete-facts' }, ...log.records.slice(1)] },
      { ...log, records: [{ ...log.records[0], id: samples.drafts[2]!.draft }, ...log.records.slice(1)] },
    ]) {
      await writeFile(journal, JSON.stringify(wrong), { mode: 0o600 });
      run(f, 'refuse');
    }
    await writeFile(journal, history);
    run(f, 'abort');
    run(f, 'before');
    compose(f, ['stop', 'postgres']);
    compose(f, ['start', '--wait', '--wait-timeout', '120', 'postgres']);
    const results: Awaited<ReturnType<typeof applySourceDraftErasure>>[] = run(f, 'race');
    assert.deepEqual(results.map(r => [r.removed, r.timing]), [[2, 'within-seven-days'], [2, 'within-seven-days']]);
    const later = cli(erase, String(log.through));
    assert.deepEqual([later.sequence, later.removed, later.timing], [log.through, 1, 'within-seven-days']);
    const elapsedMs = results.map(r => Date.parse(r.confirmedBy) - Date.parse(r.authorizedAt));
    assert.ok(elapsedMs.every(n => n >= 0 && n <= 7 * 86400_000));
    run(f, 'after');
    compose(f, ['stop', 'postgres']);
    compose(f, ['start', '--wait', '--wait-timeout', '120', 'postgres']);
    for (const result of [...results, later]) {
      const retry = cli(erase, String(result.sequence));
      assert.deepEqual([retry.removed, retry.timing], [0, 'already-applied']);
    }
    run(f, 'after');
    compose(f, ['stop']);
    const continuedPath = 'work/pilot/continued-draft-backup';
    await captureContinuedFixture(f.id, continuedPath);
    const continued: Pair = JSON.parse(await readFile(continuedPath + '/pair.json', 'utf8'));
    assert.equal(continued.format, 4);
    assert.equal(continued.lineageCapturedAt, pair.capturedAt);
    assert.ok(Date.parse(continued.capturedAt!) > Date.parse(pair.capturedAt!));
    const backupDeadline = Date.parse(continued.lineageCapturedAt!) + 30 * 86400_000;
    assert.ok(backupDeadline <= Date.parse(results[0]!.authorizedAt) + 30 * 86400_000);
    compose(f, ['down']);
    active = undefined;
    await rename('work/pilot', archive);

    const target = await restore(archive + '/issued-draft-backup', f => { active = f; });
    assert.ok(target.stopped && !target.applicationLogin && target.verifiedDatabases === 2);
    const t = await loadFixture();
    run(t, 'before');
    const replay = (digest: string) => cli(recover, 'replay-history', String(log.after), String(log.through), digest);
    assert.throws(() => replay(sha(history)));
    const incomplete = JSON.stringify({ ...log, records: log.records.slice(0, 1) });
    await writeFile(journal, incomplete, { flag: 'wx', mode: 0o600 });
    assert.throws(() => replay(sha(incomplete)));
    run(t, 'before');
    const changed = JSON.stringify(changedEarlier);
    await writeFile(journal, changed);
    assert.throws(() => replay(sha(changed)));
    run(t, 'before');
    await writeFile(journal, history);
    assert.equal(replay(sha(history)).history.applied, 3);
    run(t, 'after');
    compose(t, ['stop', 'postgres']);
    compose(t, ['start', '--wait', '--wait-timeout', '120', 'postgres']);
    assert.equal(replay(sha(history)).history.applied, 0);
    run(t, 'after');
    assert.deepEqual(await originals(archive), prior);
    assert.deepEqual(await originals(archive + '/issued-draft-backup'), savedInterval);
    return { revision: pair.revision, authorization: results[0]!.authorizedAt, confirmedBy: results.map(r => r.confirmedBy),
      continuedBackupDeadline: new Date(backupDeadline).toISOString(), elapsedMs, removed: [2, 2], unaffectedRevisions: 4, selectedNewAttempts: 0, originalCreates: 3,
      restoredDatabases: target.verifiedDatabases, held: target.quarantined, postSnapshotRemoved: later.removed, postSnapshotAuthorizedAt: later.authorizedAt, postSnapshotConfirmedBy: later.confirmedBy, historyApplied: [3, 0] };
  } finally {
    if (active && (await loadFixture(true)).id === active.id) compose(active, ['down']);
  }
}

const inside = process.env.PILOT_CONTAINER === '1';
(inside ? stage(process.argv[2]!) : drill()).then(value => console.log(JSON.stringify(value))).catch(error => {
  // Sample bindings and invented content remain private even on failed assertions.
  const location = error instanceof Error ? error.stack?.split('\n').find(s => s.includes('/tests/pilot/') || s.includes('\\tests\\pilot\\')) : undefined;
  console.error('Draft erasure drill failed.', location?.trim() ?? '', (error as { code?: string }).code ?? '');
  process.exitCode = 1;
});
