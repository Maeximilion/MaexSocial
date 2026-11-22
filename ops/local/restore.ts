import { lstat, readFile, rename, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { compatibility, databases, hashSources, verifyPair, volumeName,
  type Database, type Pair } from './backup.js';
import { compose, docker, runIsolatedFixture, usesLocalDocker, validateFixture, type Fixture } from './fixture.js';
import { initialize, postgresImage } from './stack.js';

// These fixture revisions change bootstrap/restore controls but produce the same synthetic IdP configuration.
const compatibleIdpConfigs = new Set([
  'a63937e20b8444a2d0baf887ef7fbd2bbdbbb4b95e9cb711d6a40021231a0def', // #216
  '196ca6133119b3aad441392a50395bcf67dea77260af37dafcfcdb96ec26c22c', // #217
  'e6b21a8d0644f45944b1177506118c2c17b923fdda8c639be625eed089acce79', // #219
  '16a317924e98caf2efcacbfbb89274d989c2d2fb667baad0e02561416cd98dad', // paired restore
]);

async function verifySource(sourceDir: string) {
  const backupPath = join(sourceDir, 'cold-backup');
  const source: unknown = JSON.parse(await readFile(join(sourceDir, 'fixture.json'), 'utf8'));
  validateFixture(source, true);
  if (source.restoreTarget) throw new Error('Backup source must be an ordinary synthetic fixture.');
  const pair: Pair = JSON.parse(await readFile(join(backupPath, 'pair.json'), 'utf8'));
  const expected = await compatibility(source, join(sourceDir, 'compose.env'));
  if (compatibleIdpConfigs.has(expected.idpConfig) && compatibleIdpConfigs.has(pair?.compatibility?.idpConfig)) {
    expected.idpConfig = pair.compatibility.idpConfig;
  }
  await verifyPair(backupPath, source.id, expected, pair);
  if (pair.effectiveIdentityConfig !== undefined && pair.effectiveIdentityConfig !== await hashSources(
    ['work/pilot/keycloak.conf', 'work/pilot/keycloak-realm.json'], path => join(sourceDir, basename(path)))) {
    throw new Error('Backup pair has an incompatible generated identity configuration.');
  }
  return { source, pair, backupPath };
}

function restoreCluster(f: Fixture, source: Fixture, pair: Pair, backupPath: string, db: Database): void {
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
  docker(['run', '--rm', '--read-only', '--tmpfs', '/tmp', '--network', 'none', '--pull', 'never',
    '--label', 'org.maexsocial.fixture=' + f.id, '--entrypoint', 'sh',
    '--mount', 'type=volume,src=' + name + ',dst=/var/lib/postgresql/data,volume-nocopy',
    '--mount', 'type=bind,src=' + join(backupPath, db.archive) + ',dst=/archive.tar,readonly',
    '--mount', 'type=bind,src=' + resolve('work/pilot') + ',dst=/fixture,readonly',
    '--mount', 'type=bind,src=' + resolve('ops/local/restore-cluster.sh') + ',dst=/restore.sh,readonly',
    postgresImage, '/restore.sh', db.service, db.owner, db.database, archive.sha256, archive.systemId,
    archive.catalogVersion, source.id, f.id, schema, new Date(f.expiresAt).toISOString()]);
}

async function main(): Promise<void> {
  if (process.argv.length !== 3 || process.env.PILOT_CONTAINER === '1') {
    throw new Error('Usage: npm run pilot:restore -- <private synthetic backup fixture directory>');
  }
  if (await lstat('work/pilot').catch(error => {
    if (error.code !== 'ENOENT') throw error;
  })) throw new Error('Paired restore requires a fresh worktree without work/pilot.');
  if (!usesLocalDocker()) throw new Error('Paired restore requires a local Docker socket.');
  const { source, pair, backupPath } = await verifySource(resolve(process.argv[2]!));
  const f = await initialize('paired-restore');
  const services = databases.map(db => db.service);
  const volumes = docker(['volume', 'ls', '--format', '{{.Name}}']).split(/\s+/);
  if (source.id === f.id || databases.some(db => volumes.includes(volumeName(f, db)))
      || docker(['ps', '-aq', '--filter', 'label=com.docker.compose.project=' + f.project])) {
    throw new Error('Paired restore target storage already exists.');
  }
  let stage = 'target creation';
  let starting = false;
  try {
    compose(f, ['create', '--no-build', '--pull', 'never', ...services]);
    for (const db of databases) {
      stage = db.service === 'postgres' ? 'AppDB import' : 'IdP import';
      restoreCluster(f, source, pair, backupPath, db);
    }
    stage = 'offline quarantine';
    starting = true;
    compose(f, ['start', '--wait', '--wait-timeout', '90', ...services]);
    const { topology, output } = runIsolatedFixture(f, ['dist/pilot/ops/local/recover.js']);
    const quarantine = JSON.parse(output) as { quarantined: number; stopped: boolean; applicationLogin: boolean };
    if (!Number.isSafeInteger(quarantine.quarantined) || quarantine.quarantined < 0
        || quarantine.stopped !== true || quarantine.applicationLogin !== false) {
      throw new Error('Restore quarantine did not complete.');
    }
    const result = JSON.stringify({ verifiedDatabases: 2, ...quarantine, topology });
    await writeFile('work/pilot/restore-ready.pending', result + '\n', { mode: 0o600, flag: 'wx' });
    await rename('work/pilot/restore-ready.pending', 'work/pilot/restore-ready.json');
    console.log(result);
  } catch {
    if (starting) {
      try { compose(f, ['stop', ...services]); }
      catch { throw new Error('Restore failed and database stop could not be confirmed. Keep target isolated.'); }
    }
    throw new Error('Paired restore failed during ' + stage + '; target is offline and has no readiness record.');
  }
}

main().catch(error => {
  const message = error instanceof Error && error.constructor === Error && !error.message.startsWith('Docker ')
    ? error.message : 'Paired restore refused before target import.';
  console.error(message);
  process.exitCode = 1;
});
