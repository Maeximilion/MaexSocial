import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, lstat, mkdir, readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Writable } from 'node:stream';
import { archiveFile, captureContinuedFixture, compatibility, databases, verifyPair, type Pair } from '../../ops/local/backup.js';
import { decryptArchive, loadBackupKey } from '../../ops/local/backup-crypto.js';
import { loadFixture } from '../../ops/local/fixture.js';

const pilot = 'work/pilot';
const later = 'work/post-purge';
const pairDir = 'cold-backup';
const retention = 30 * 24 * 60 * 60 * 1000;

async function manifest(root: string): Promise<Pair & { format: 3 }> {
  const pair = JSON.parse(await readFile(join(root, pairDir, 'pair.json'), 'utf8'));
  assert.equal(pair.format, 3);
  return pair;
}

export async function captureAfterPurge(fixtureId: string) {
  await mkdir(later, { mode: 0o700 });
  for (const file of ['compose.env', 'fixture.json']) await copyFile(join(pilot, file), join(later, file));
  await captureContinuedFixture(fixtureId, join(later, pairDir));
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

export async function proveExpiry(freshTarget: string, purgedAt: number, label: string) {
  const pre = await manifest(pilot), post = await manifest(later);
  assert.equal(pre.fixtureId, post.fixtureId);
  for (const db of databases) {
    assert.equal(pre.archives[db.archive]!.systemId, post.archives[db.archive]!.systemId);
    assert.notEqual(pre.archives[db.archive]!.sha256, post.archives[db.archive]!.sha256);
  }
  const captured = Date.parse(pre.capturedAt), recaptured = Date.parse(post.capturedAt);
  assert.ok(captured < purgedAt && purgedAt < recaptured);
  const cutoff = captured + retention;
  const marker = Buffer.from(label + '-1');
  const preMarker = await markerPresent(pilot, pre, marker);
  assert.deepEqual(preMarker, [true, false]);
  const postMarker = await markerPresent(later, post, marker);
  const backup = resolve('dist/pilot/ops/local/backup.js');
  const restore = resolve('dist/pilot/ops/local/restore.js');
  const at = (now: number, cwd: string, script: string, args: string[], error?: string) => {
    const clock = 'data:text/javascript,' + encodeURIComponent('Date.now = () => ' + now);
    const r = spawnSync(process.execPath, ['--import', clock, script, ...args], { cwd, encoding: 'utf8', timeout: 180_000 });
    assert.equal(r.status, error ? 1 : 0, r.error?.message ?? r.stderr);
    if (error) assert.equal(r.stderr.trim(), error);
  };
  const cwd = process.cwd();
  const verifyPost = (now: number, error?: string) => at(now, cwd, __filename, [], error);
  const expired = 'Backup pair has expired.';
  at(cutoff - 1, cwd, backup, ['verify']);
  at(cutoff - 1, cwd, backup, ['expire'], 'Backup pair has not expired.');
  at(cutoff, cwd, backup, ['verify'], expired);
  at(cutoff, freshTarget, restore, [resolve(pilot)], expired);
  await assert.rejects(lstat(join(freshTarget, pilot)), { code: 'ENOENT' });
  verifyPost(cutoff);
  verifyPost(purgedAt + retention);
  verifyPost(recaptured + retention - 1);
  verifyPost(recaptured + retention, expired);
  const path = join(pilot, pairDir);
  const metadata = await Promise.all(['pair.auth', 'pair.json'].map(file => readFile(join(path, file))));
  assert.deepEqual((await readdir(path)).sort(), ['app-db.tar.enc', 'identity-db.tar.enc', 'pair.auth', 'pair.json']);
  for (const when of [cutoff, cutoff + 1]) {
    at(when, cwd, backup, ['expire']);
    assert.deepEqual((await readdir(path)).sort(), ['pair.auth', 'pair.json']);
    assert.deepEqual(await Promise.all(['pair.auth', 'pair.json'].map(file => readFile(join(path, file)))), metadata);
  }
  verifyPost(cutoff);
  assert.deepEqual(await manifest(later), post);
  return { captureToPurgeMs: purgedAt - captured, purgeToLaterCaptureMs: recaptured - purgedAt,
    preCaptureToExpiryMs: retention, purgeToPreExpiryMs: cutoff - purgedAt,
    purgeToLaterExpiryMs: recaptured + retention - purgedAt, preMarker, postMarker,
    archiveFilesBefore: 2, archiveFilesAfter: 0 };
}

if (require.main === module) (async () => {
  const f = await loadFixture(true);
  await verifyPair(join(later, pairDir), f.id, await compatibility(f), await manifest(later));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
