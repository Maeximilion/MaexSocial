import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, rename, rmdir, unlink, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Client } from 'pg';
import { grantDirectory, materialPath, purgeDisposableGrant, type GrantBinding } from '../../apps/worker/src/disposable-grant.js';
import { providerStateDirectory } from '../../apps/worker/src/fake-gbp.js';
import { compose, connectFixture, loadFixture, requireWorkerFixtureDatabase, usesLocalDocker, verifyContainers } from '../../ops/local/fixture.js';
import { approveDispatchOccurrence, binding, seedDispatchApproval, type Case } from './dispatch-fixture.js';

const entry = 'dist/pilot/apps/worker/src/main.js';
const drill = 'dist/pilot/tests/pilot/grant-retirement.js';
const wake = (id: string): string => JSON.parse(execFileSync(process.execPath, [entry, id],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })).state;
const grantArgs = (g: GrantBinding) => [g.tenant, g.location, g.version];
const present = async (path: string) => (await lstat(path)).isFile();
const day = 86_400_000;

function creates(tenant: string, id: string) {
  const db = new DatabaseSync(join(providerStateDirectory, 'fake-gbp.sqlite'), { readOnly: true });
  try { return db.prepare('SELECT count(*) AS n FROM calls WHERE tenant=? AND occurrence=?').get(tenant, id)!.n; }
  finally { db.close(); }
}

async function grantOf(db: Client, target: Case): Promise<GrantBinding> {
  return (await db.query<GrantBinding>('SELECT tenant_id AS tenant,id AS location,version FROM pilot.locations WHERE tenant_id=$1',
    [target.tenant])).rows[0]!;
}

async function provision(db: Client, fixture: string, g: GrantBinding) {
  const bytes = randomBytes(32);
  await writeFile(materialPath(fixture, g), bytes, { mode: 0o600, flag: 'wx' });
  await db.query('INSERT INTO public.disposable_grants(tenant,location,version,digest) VALUES($1,$2,$3,$4)',
    [...grantArgs(g), createHash('sha256').update(bytes).digest('hex')]);
}

async function approveAgain(db: Client, original: Case, request: ReturnType<typeof binding>) {
  const { rows: [o] } = await db.query(`INSERT INTO pilot.occurrences(tenant_id,draft_id,location_id,creation_key,due_at,timezone)
    SELECT tenant_id,draft_id,location_id,$2,due_at,timezone FROM pilot.occurrences WHERE id=$1 RETURNING id`, [original.id, randomUUID()]);
  await approveDispatchOccurrence(request, o.id);
  return o.id as string;
}

async function begin(db: Client, fixture: string) {
  assert.equal((await db.query('SELECT 1 FROM pilot.tenants LIMIT 1')).rowCount, 0, 'Requires a fresh dedicated database');
  await db.query(`CREATE TABLE public.disposable_grants (tenant uuid,location uuid,version integer,digest text NOT NULL,
    revoked_at timestamptz,readbacks integer NOT NULL DEFAULT 0, PRIMARY KEY(tenant,location,version))`);
  const app = await connectFixture();
  try {
    await assert.rejects(app.query('SELECT digest FROM public.disposable_grants'), { code: '42501' });
  } finally { await app.end(); }
  const requestA = binding(), requestB = binding();
  const a = await seedDispatchApproval(requestA, true), b = await seedDispatchApproval(requestB, true);
  const old = await grantOf(db, a);
  await db.query('UPDATE pilot.locations SET version=version+1 WHERE tenant_id=$1', [b.tenant]);
  const live = await grantOf(db, b);
  assert.notEqual(live.version, old.version);
  await provision(db, fixture, old);
  await provision(db, fixture, live);
  assert.equal((await db.query('SELECT count(DISTINCT digest)::int AS n FROM public.disposable_grants')).rows[0].n, 2);
  const bId = await approveAgain(db, b, requestB);
  const stale = await approveAgain(db, a, requestA);
  const invalid = await approveAgain(db, a, requestA);
  assert.equal((await db.query('UPDATE pilot.dispatch_control SET stopped=false WHERE singleton AND stopped')).rowCount, 1);
  assert.equal(wake(a.id), 'in_flight');
  assert.equal(wake(a.id), 'pending');
  assert.equal(creates(a.tenant, a.id), 1);
  assert.equal(wake(bId), 'in_flight');

  // A different live capability cannot authorize even an otherwise eligible committed create.
  const path = materialPath(fixture, old);
  await rename(path, path + '.held');
  try {
    await writeFile(path, await readFile(materialPath(fixture, live)), { flag: 'wx', mode: 0o600 });
    const refused = spawnSync(process.execPath, [entry, invalid], { encoding: 'utf8' });
    assert.equal(refused.status, 1);
    assert.equal(refused.stderr.trim(), 'Local worker wake refused or failed.');
    assert.equal(refused.stdout, '');
  } finally { await rename(path + '.held', path); }
  assert.equal(wake(invalid), 'unknown');
  assert.equal(creates(a.tenant, invalid), 0);

  // The database lock serializes the exact old version against the adapter's authorized use.
  await db.query('BEGIN');
  assert.equal((await db.query(`UPDATE pilot.locations SET grant_active=false,version=version+1
    WHERE tenant_id=$1 AND id=$2 AND version=$3 AND grant_active`, grantArgs(old))).rowCount, 1);
  assert.equal((await db.query(`UPDATE public.disposable_grants SET revoked_at=clock_timestamp()
    WHERE tenant=$1 AND location=$2 AND version=$3 AND revoked_at IS NULL`, grantArgs(old))).rowCount, 1);
  await db.query('COMMIT');
  const elapsed = async () => Number((await db.query(`SELECT EXTRACT(EPOCH FROM (clock_timestamp()-revoked_at))*1000 AS ms
    FROM public.disposable_grants WHERE tenant=$1 AND location=$2 AND version=$3`, grantArgs(old))).rows[0].ms);
  const commitUpperMs = await elapsed();
  const reads = async () => (await db.query('SELECT readbacks FROM public.disposable_grants WHERE tenant=$1 AND location=$2 AND version=$3',
    grantArgs(old))).rows[0].readbacks;
  const readsBefore = await reads();
  assert.equal(readsBefore, 2);
  assert.equal(wake(stale), 'denied');
  assert.equal(wake(a.id), 'unknown');
  assert.equal(await present(path), true);
  assert.equal(await reads(), readsBefore);
  assert.equal(creates(a.tenant, a.id), 1);
  assert.equal(creates(a.tenant, stale), 0);
  assert.equal((await db.query('SELECT 1 FROM pilot.attempts WHERE occurrence_id=$1', [stale])).rowCount, 0);
  const deniedUpperMs = await elapsed();

  assert.equal((await db.query('UPDATE pilot.locations SET grant_active=true,version=version+1 WHERE tenant_id=$1 AND id=$2 AND version=$3 AND NOT grant_active',
    [old.tenant, old.location, old.version + 1])).rowCount, 1);
  const reissued = await grantOf(db, a);
  await provision(db, fixture, reissued);
  const newId = await approveAgain(db, a, requestA);
  assert.equal(wake(stale), 'denied');
  assert.equal(wake(a.id), 'unknown');
  assert.equal(wake(newId), 'in_flight');
  return { old, live, reissued, aId: a.id, bId, newId, stale, invalid, commitUpperMs, deniedUpperMs };
}

type Evidence = Awaited<ReturnType<typeof begin>>;

async function retire(db: Client, fixture: string, e: Evidence) {
  const { old, live, reissued } = e;
  const path = materialPath(fixture, old);
  assert.equal(await present(path), true);
  const marker = join(grantDirectory(fixture, true), 'fixture-id');
  await writeFile(marker, 'different-disposable-fixture');
  try { await assert.rejects(purgeDisposableGrant(fixture, old), { message: 'Disposable store mismatch' }); }
  finally { await writeFile(marker, fixture); }
  await assert.rejects(purgeDisposableGrant('0'.repeat(32), old));
  for (const invalid of [live, reissued, { ...old, location: randomUUID() }]) {
    await assert.rejects(purgeDisposableGrant(fixture, invalid), { message: 'Unproven retirement' });
  }
  // Exercise a real failed maintenance operation and leave the original bytes intact for retry.
  await rename(path, path + '.held');
  try {
    await writeFile(path, randomBytes(32), { mode: 0o600, flag: 'wx' });
    await assert.rejects(purgeDisposableGrant(fixture, old), { message: 'Disposable material mismatch' });
    assert.equal(await present(path), true);
  } finally { await rename(path + '.held', path); }
  assert.equal(await purgeDisposableGrant(fixture, old), 'removed');
  assert.equal(await purgeDisposableGrant(fixture, old), 'absent');
  await assert.rejects(lstat(path), { code: 'ENOENT' });
  const { rows: [timing] } = await db.query(`SELECT EXTRACT(EPOCH FROM revoked_at)*1000 AS origin,
    EXTRACT(EPOCH FROM clock_timestamp())*1000 AS observed FROM public.disposable_grants
    WHERE tenant=$1 AND location=$2 AND version=$3`, grantArgs(old));
  const removalUpperMs = Number(timing.observed) - Number(timing.origin);
  assert.ok(removalUpperMs >= e.deniedUpperMs && removalUpperMs < day);
  return { removalUpperMs, originMs: Number(timing.origin) };
}

async function verify(db: Client, fixture: string, e: Evidence, originMs: number) {
  const { mock } = await import('node:test');
  mock.timers.enable({ apis: ['Date'], now: Math.floor(originMs) });
  try {
    mock.timers.tick(day);
    assert.equal(Date.now() - Math.floor(originMs), day);
    await assert.rejects(lstat(materialPath(fixture, e.old)), { code: 'ENOENT' });
    for (const g of [e.live, e.reissued]) assert.equal(await present(materialPath(fixture, g)), true);
  } finally { mock.timers.reset(); }
  assert.equal(wake(e.stale), 'denied');
  assert.equal(wake(e.aId), 'unknown');
  assert.equal(wake(e.bId), 'pending');
  assert.equal(wake(e.newId), 'pending');
  const counts = {
    oldCreates: creates(e.old.tenant, e.aId),
    oldReadbacks: (await db.query('SELECT readbacks FROM public.disposable_grants WHERE tenant=$1 AND location=$2 AND version=$3',
      grantArgs(e.old))).rows[0].readbacks,
    invalidCreates: creates(e.old.tenant, e.invalid),
    independentCreates: creates(e.live.tenant, e.bId),
    reissuedCreates: creates(e.reissued.tenant, e.newId),
    staleAttempts: (await db.query('SELECT id FROM pilot.attempts WHERE occurrence_id=$1', [e.stale])).rowCount,
    oldAttempts: (await db.query('SELECT id FROM pilot.attempts WHERE occurrence_id=$1', [e.aId])).rowCount,
    invalidAttempts: (await db.query('SELECT id FROM pilot.attempts WHERE occurrence_id=$1', [e.invalid])).rowCount,
  };
  assert.deepEqual(counts, { oldCreates: 1, oldReadbacks: 2, invalidCreates: 0, independentCreates: 1,
    reissuedCreates: 1, staleAttempts: 0, oldAttempts: 1, invalidAttempts: 1 });
  const files = (await readdir(grantDirectory(fixture, true))).filter(name => name !== 'fixture-id');
  console.log(JSON.stringify({ ...counts, deadlineObservationMs: day, remainingFiles: files.length }));
}

async function main() {
  const f = await loadFixture();
  assert.equal(f.purpose, 'grant-retirement');
  assert.ok(!f.restoreTarget && !f.pairedRestore);
  if (process.env.PILOT_CONTAINER === '1') {
    const db = await connectFixture(true);
    try {
      await requireWorkerFixtureDatabase(db, f.id, 'grant-retirement');
      switch (process.argv[2]) {
        case 'begin': console.log(JSON.stringify(await begin(db, f.id))); return;
        case 'retire': console.log(JSON.stringify(await retire(db, f.id, JSON.parse(process.argv[3]!)))); return;
        case 'verify': await verify(db, f.id, JSON.parse(process.argv[3]!), Number(process.argv[4])); return;
        default: throw new Error('Unknown drill stage');
      }
    } finally { await db.end(); }
  }
  assert.ok(usesLocalDocker());
  verifyContainers(f, true);
  const directory = grantDirectory(f.id, false);
  const target = grantDirectory(f.id, true);
  await mkdir(directory, { mode: 0o700 });
  try {
    await writeFile(join(directory, 'fixture-id'), f.id, { mode: 0o600, flag: 'wx' });
    const run = (...args: string[]) => JSON.parse(compose(f, ['run', '--rm', '-T', '--no-deps', '--pull', 'never',
      '--volume', directory + ':' + target, '--volume', resolve(providerStateDirectory) + ':/workspace/' + providerStateDirectory,
      'runner', 'node', drill, ...args]));
    const e: Evidence = run('begin');
    assert.equal(wake(e.aId), 'unknown');
    assert.equal(wake(e.bId), 'pending');
    const neverMounted = compose(f, ['run', '--rm', '-T', '--no-deps', '--pull', 'never', 'runner', 'node', '-e',
      'if(require("node:fs").existsSync(process.argv[1]))process.exit(1)', target]);
    assert.equal(neverMounted, '');
    const { removalUpperMs, originMs } = run('retire', JSON.stringify(e));
    const verified = run('verify', JSON.stringify(e), String(originMs));
    assert.equal(verified.remainingFiles, 2);
    console.log(JSON.stringify({ ...verified, commitUpperMs: e.commitUpperMs, immediateDenialUpperMs: e.deniedUpperMs, removalUpperMs }));
  } finally {
    // This invocation exclusively created the directory. Refuse unexpected entries during teardown.
    for (const name of await readdir(directory)) {
      if (name !== 'fixture-id') assert.match(name, /^[a-f0-9-]{36}-[a-f0-9-]{36}-[1-9][0-9]*(?:\.held)?$/);
      const file = join(directory, basename(name));
      assert.ok((await lstat(file)).isFile());
      await unlink(file);
    }
    await rmdir(directory);
    await assert.rejects(lstat(directory), { code: 'ENOENT' });
  }
}

main().catch(error => {
  if (process.env.PILOT_CONTAINER !== '1' && error instanceof Error && error.message.startsWith('Docker compose failed:')) {
    console.error(error.message);
  }
  console.error('Grant retirement drill failed.', error instanceof Error ? error.stack?.split('\n').filter(line =>
    line.trimStart().startsWith('at ')).slice(0, 4).join('\n') : '');
  process.exitCode = 1;
});
