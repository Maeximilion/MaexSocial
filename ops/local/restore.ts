import { spawn } from 'node:child_process';
import type { KeyObject } from 'node:crypto';
import { lstat, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { decryptArchive, loadBackupKey, maxArchiveBytes, validEncryption } from './backup-crypto.js';
import { archiveFile, compatibility, databases, encryptedFormat, hashSources, requireUnexpired, verifyPair, volumeName,
  type Database, type Pair } from './backup.js';
import { compose, docker, runIsolatedFixture, usesLocalDocker, validateFixture, type Fixture } from './fixture.js';
import { initialize, postgresImage } from './stack.js';

async function verifySource(sourceDir: string) {
  const backupPath = join(sourceDir, 'cold-backup');
  const source: unknown = JSON.parse(await readFile(join(sourceDir, 'fixture.json'), 'utf8'));
  validateFixture(source, true);
  if (source.restoreTarget) throw new Error('Backup source must be an ordinary synthetic fixture.');
  const pair: Pair = JSON.parse(await readFile(join(backupPath, 'pair.json'), 'utf8'));
  const expected = await compatibility(source, join(sourceDir, 'compose.env'));
  const key = encryptedFormat(pair?.format) ? await loadBackupKey(sourceDir) : undefined;
  await verifyPair(backupPath, source.id, expected, pair, key);
  if (pair.effectiveIdentityConfig !== undefined && pair.effectiveIdentityConfig !== await hashSources(
    ['work/pilot/keycloak.conf', 'work/pilot/keycloak-realm.json'], path => join(sourceDir, basename(path)))) {
    throw new Error('Backup pair has an incompatible generated identity configuration.');
  }
  return { source, pair, backupPath, key };
}

async function restoreCluster(f: Fixture, source: Fixture, pair: Pair, backupPath: string, db: Database,
  key?: KeyObject): Promise<void> {
  const name = volumeName(f, db);
  const [volume] = JSON.parse(docker(['volume', 'inspect', name]));
  if (volume.Driver !== 'local' || Object.keys(volume.Options ?? {}).length
      || volume.Labels?.['com.docker.compose.project'] !== f.project
      || volume.Labels?.['com.docker.compose.volume'] !== db.volume
      || docker(['ps', '-q', '--filter', 'volume=' + name])) {
    throw new Error('Unknown or active restore target volume.');
  }
  const archive = pair.archives[db.archive]!;
  const schema = db.service === 'postgres' ? pair.appliedAppSchema : pair.identitySchema;
  const encryption = archive.encryption;
  const path = join(backupPath, archiveFile(db, pair.format));
  const args = ['run', '--rm', '--read-only',
    ...(key ? ['--memory', '512m', '--memory-swap', '512m'] : []),
    '--tmpfs', key ? '/tmp:size=' + (maxArchiveBytes + 8 * 1024 * 1024) : '/tmp',
    '--network', 'none', '--pull', 'never', '--log-driver', 'none',
    '--label', 'org.maexsocial.fixture=' + f.id, '--label', 'org.maexsocial.archive-import=' + f.id, '--entrypoint', 'sh',
    '--mount', 'type=volume,src=' + name + ',dst=/var/lib/postgresql/data,volume-nocopy',
    ...(key ? ['--interactive'] : ['--mount', 'type=bind,src=' + path + ',dst=/archive.tar,readonly']),
    '--mount', 'type=bind,src=' + resolve('work/pilot') + ',dst=/fixture,readonly',
    '--mount', 'type=bind,src=' + resolve('ops/local/restore-cluster.sh') + ',dst=/restore.sh,readonly',
    postgresImage, '/restore.sh', db.service, db.owner, db.database, archive.sha256, archive.systemId,
    archive.catalogVersion, source.id, f.id, schema, new Date(f.expiresAt).toISOString(),
    pair.historyAnchor ? String(pair.historyAnchor.after) : '', pair.historyAnchor?.evidenceSha256 ?? '',
    key && encryption ? String(encryption.bytes) : ''];
  if (!encryptedFormat(pair.format)) {
    docker(args);
    return;
  }
  if (!key || !validEncryption(encryption)) throw new Error('Encrypted archive metadata is invalid.');
  const child = spawn('docker', args, { stdio: ['pipe', 'ignore', 'ignore'], timeout: 180_000 });
  const completed = new Promise<void>((resolve, reject) => {
    const failed = () => reject(new Error('Restore import refused the archive.'));
    child.once('error', failed);
    child.once('close', code => { if (code === 0) resolve(); else failed(); });
  });
  const [streamResult, processResult] = await Promise.allSettled([
    decryptArchive(path, encryption, archive.sha256, key, source.id, db.archive, child.stdin), completed,
  ]);
  if (streamResult.status === 'rejected') throw streamResult.reason;
  if (processResult.status === 'rejected') throw processResult.reason;
}

export async function restore(sourceDir: string, ownTarget?: (fixture: Fixture) => void) {
  if (process.env.PILOT_CONTAINER === '1') {
    throw new Error('Usage: npm run pilot:restore -- <private synthetic backup fixture directory>');
  }
  if (await lstat('work/pilot').catch(error => {
    if (error.code !== 'ENOENT') throw error;
  })) throw new Error('Paired restore requires a fresh worktree without work/pilot.');
  if (!usesLocalDocker()) throw new Error('Paired restore requires a local Docker socket.');
  const { source, pair, backupPath, key } = await verifySource(resolve(sourceDir));
  requireUnexpired(pair);
  const f = await initialize('paired-restore');
  const services = databases.map(db => db.service);
  const volumes = docker(['volume', 'ls', '--format', '{{.Name}}']).split(/\s+/);
  if (source.id === f.id || databases.some(db => volumes.includes(volumeName(f, db)))
      || docker(['ps', '-aq', '--filter', 'label=com.docker.compose.project=' + f.project])) {
    throw new Error('Paired restore target storage already exists.');
  }
  ownTarget?.(f);
  let stage = 'target creation';
  try {
    compose(f, ['create', '--no-build', '--pull', 'never', ...services]);
    for (const db of databases) {
      stage = db.service === 'postgres' ? 'AppDB import' : 'IdP import';
      await restoreCluster(f, source, pair, backupPath, db, key);
    }
    stage = 'offline quarantine';
    compose(f, ['start', '--wait', '--wait-timeout', '90', ...services]);
    const { topology, output } = runIsolatedFixture(f, ['dist/pilot/ops/local/recover.js']);
    const quarantine = JSON.parse(output) as { quarantined: number; stopped: boolean; applicationLogin: boolean };
    if (!Number.isSafeInteger(quarantine.quarantined) || quarantine.quarantined < 0
        || quarantine.stopped !== true || quarantine.applicationLogin !== false) {
      throw new Error('Restore quarantine did not complete.');
    }
    const result = { verifiedDatabases: 2, ...quarantine, topology };
    await writeFile('work/pilot/restore-ready.pending', JSON.stringify(result) + '\n', { mode: 0o600, flag: 'wx' });
    await rename('work/pilot/restore-ready.pending', 'work/pilot/restore-ready.json');
    return result;
  } catch {
    try {
      const helpers = docker(['ps', '-aq', '--filter', 'label=org.maexsocial.archive-import=' + f.id]);
      if (helpers) docker(['rm', '-f', ...helpers.split(/\s+/)]);
      compose(f, ['down', '--volumes']);
      await rm('work/pilot/restore-ready.pending', { force: true });
    } catch {
      throw new Error('Restore failed and target teardown could not be confirmed. Keep target isolated.');
    }
    throw new Error('Paired restore failed during ' + stage + '; target storage was removed and has no readiness record.');
  }
}

async function main(): Promise<void> {
  if (process.argv.length !== 3) {
    throw new Error('Usage: npm run pilot:restore -- <private synthetic backup fixture directory>');
  }
  console.log(JSON.stringify(await restore(process.argv[2]!)));
}

if (require.main === module) main().catch(error => {
  const message = error instanceof Error && error.constructor === Error && !error.message.startsWith('Docker ')
    ? error.message : 'Paired restore refused before target import.';
  console.error(message);
  process.exitCode = 1;
});
