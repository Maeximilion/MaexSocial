import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Writable } from 'node:stream';
import { archiveFile, captureContinuedFixture, compatibility, databases, verifyPair, type Pair } from '../../ops/local/backup.js';
import { decryptArchive, loadBackupKey } from '../../ops/local/backup-crypto.js';
import { loadFixture } from '../../ops/local/fixture.js';

const pilot = 'work/pilot';
const roots = ['.', 'work/post-purge', 'work/repeated-capture'] as const;
const later = join(roots[1], pilot);
const pairDir = 'cold-backup';
const retention = 30 * 24 * 60 * 60 * 1000;

async function manifest(root: string): Promise<Pair & { format: 3 | 4 }> {
  const pair = JSON.parse(await readFile(join(root, pairDir, 'pair.json'), 'utf8'));
  assert.ok(pair.format === 3 || pair.format === 4);
  return pair;
}

export async function captureAfterPurge(fixtureId: string) {
  for (const root of roots.slice(1)) {
    await mkdir(root, { mode: 0o700 });
    const dir = join(root, pilot);
    await mkdir(dir, { recursive: true, mode: 0o700 });
    for (const file of ['compose.env', 'fixture.json']) await copyFile(join(pilot, file), join(dir, file));
    await captureContinuedFixture(fixtureId, join(dir, pairDir));
  }
  // Cross the deadline after archive verification, immediately before publication.
  const original = await manifest(pilot);
  const cutoff = Date.parse(original.capturedAt) + retention;
  const destination = join(roots[2], 'unpublished');
  const now = Date.now;
  try {
    Date.now = () => existsSync(join(destination + '.pending', 'pair.json')) ? cutoff : now();
    await assert.rejects(captureContinuedFixture(fixtureId, destination), /Backup pair has expired/);
  } finally { Date.now = now; }
  for (const dir of [destination, destination + '.pending']) await assert.rejects(lstat(dir), { code: 'ENOENT' });
  return resolve(later);
}

async function markerPresent(root: string, pair: Pair, marker: Buffer) {
  const key = await loadBackupKey();
  const present: boolean[] = [];
  for (const db of databases) {
    const archived = pair.archives[db.archive]!;
    let found = false, tail = Buffer.alloc(0);
    await decryptArchive(join(root, pairDir, archiveFile(db, 3)), archived.encryption!, archived.sha256,
      key, pair.fixtureId, db.archive, new Writable({
        write(chunk: Buffer, _encoding, callback) {
          if (!found) {
            const bytes = Buffer.concat([tail, chunk]);
            found = bytes.includes(marker);
            tail = bytes.subarray(Math.max(0, bytes.length - marker.length + 1));
          }
          callback();
        },
      }));
    present.push(found);
  }
  return present;
}

function at(now: number, cwd: string, script: string, args: string[], error?: string) {
  const clock = 'data:text/javascript,' + encodeURIComponent('Date.now = () => ' + now);
  const r = spawnSync(process.execPath, ['--import', clock, script, ...args], { cwd, encoding: 'utf8', timeout: 180_000 });
  assert.equal(r.status, error ? 1 : 0, r.error?.message ?? r.stderr);
  if (error) assert.equal(r.stderr.trim(), error);
}

export async function proveExpiry(freshTarget: string, purgeStarted: number, purgeConfirmed: number, label: string) {
  const pre = await manifest(pilot), post = await manifest(later);
  assert.equal(pre.fixtureId, post.fixtureId);
  for (const db of databases) {
    assert.equal(pre.archives[db.archive]!.systemId, post.archives[db.archive]!.systemId);
    assert.notEqual(pre.archives[db.archive]!.sha256, post.archives[db.archive]!.sha256);
  }
  const captured = Date.parse(pre.capturedAt), recaptured = Date.parse(post.capturedAt);
  assert.ok(captured < purgeStarted && purgeStarted <= purgeConfirmed && purgeConfirmed < recaptured);
  const cutoff = captured + retention;
  const marker = Buffer.from(label + '-1');
  const preMarker = await markerPresent(pilot, pre, marker);
  assert.deepEqual(preMarker, [true, false]);
  const postMarker = await markerPresent(later, post, marker);
  const backup = resolve('dist/pilot/ops/local/backup.js');
  const restore = resolve('dist/pilot/ops/local/restore.js');
  assert.deepEqual(postMarker, [true, false]);
  const repeated = await manifest(join(roots[2], pilot));
  assert.equal(pre.format, 3);
  assert.equal(pre.lineageCapturedAt, pre.capturedAt);
  for (const copy of [post, repeated]) {
    assert.equal(copy.format, 4);
    assert.equal(copy.fixtureId, pre.fixtureId);
    assert.deepEqual(copy.historyAnchor, pre.historyAnchor);
    assert.equal(copy.lineageCapturedAt, pre.capturedAt);
    for (const db of databases) assert.equal(copy.archives[db.archive]!.systemId, pre.archives[db.archive]!.systemId);
  }
  assert.ok(Date.parse(repeated.capturedAt) > recaptured);
  for (const root of roots) {
    const dir = resolve(root, pilot);
    at(cutoff - 1, process.cwd(), __filename, [dir]);
    at(cutoff - 1, root, backup, ['expire'], 'Backup pair has not expired.');
    for (const when of [cutoff, cutoff + 1, purgeStarted + retention, purgeConfirmed + retention]) {
      at(when, process.cwd(), __filename, [dir], 'Backup pair has expired.');
      at(when, freshTarget, restore, [dir], 'Backup pair has expired.');
      await assert.rejects(lstat(join(freshTarget, pilot)), { code: 'ENOENT' });
    }
  }
  return { capturedAt: pre.capturedAt, purgeStarted, purgeConfirmed, cutoff, recapturedAt: post.capturedAt,
    repeatedAt: repeated.capturedAt, preMarker, postMarker };
}

export async function expireOwnedCopies(cutoff: number) {
  const backup = resolve('dist/pilot/ops/local/backup.js');
  for (const root of roots) {
    const dir = join(root, pilot, pairDir);
    const metadata = () => Promise.all(['pair.auth', 'pair.json'].map(file => readFile(join(dir, file))));
    const before = await metadata();
    assert.deepEqual((await readdir(dir)).sort(), ['app-db.tar.enc', 'identity-db.tar.enc', 'pair.auth', 'pair.json']);
    for (const when of [cutoff, cutoff + 1]) {
      at(when, root, backup, ['expire']);
      assert.deepEqual((await readdir(dir)).sort(), ['pair.auth', 'pair.json']);
      assert.deepEqual(await metadata(), before);
    }
  }
}

if (require.main === module) (async () => {
  const dir = process.argv[2]!;
  const f = await loadFixture(true);
  await verifyPair(join(dir, pairDir), f.id, await compatibility(f), await manifest(dir));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
