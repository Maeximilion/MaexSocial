import { execFileSync, spawn } from 'node:child_process';
import { createHash, randomUUID, type KeyObject } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { authenticateManifest, decryptArchive, encryptArchive, loadBackupKey, manifestAuthentication, sealManifest,
  validEncryption, type ArchiveEncryption } from './backup-crypto.js';
import { compose, docker, loadFixture, usesLocalDocker, verifyContainers, type Fixture } from './fixture.js';
import { initialize, postgresImage } from './stack.js';

const directory = 'work/pilot/cold-backup';
export const databases = [
  { service: 'postgres', volume: 'app-data', archive: 'app-db.tar', owner: 'pilot_owner', database: 'pilot_fixture' },
  { service: 'identity-db', volume: 'identity-data', archive: 'identity-db.tar', owner: 'identity_owner', database: 'identity_fixture' },
] as const;
export type Database = typeof databases[number];
const digest = /^[a-f0-9]{64}$/;
const retentionMs = 30 * 24 * 60 * 60 * 1000;

async function hashFile(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const bytes of createReadStream(path)) hash.update(bytes);
  return hash.digest('hex');
}

export async function hashSources(paths: string[], locate = (path: string) => path): Promise<string> {
  const hash = createHash('sha256');
  for (const path of paths) {
    const source = (await readFile(locate(path), 'utf8')).replace(/\r\n/g, '\n');
    hash.update(JSON.stringify([path, source]));
  }
  return hash.digest('hex');
}

function configuredKeycloak(f: Fixture, envFile?: string): string {
  const config = JSON.parse(compose(f, ['config', '--format', 'json'], envFile)) as { services: Record<string, { image: string }> };
  const image = config.services.keycloak?.image;
  if (!image || !/^quay\.io\/keycloak\/keycloak:[\w.-]+@sha256:[a-f0-9]{64}$/.test(image)) {
    throw new Error('A pinned Keycloak fixture image is required.');
  }
  return image;
}

export async function compatibility(f: Fixture, envFile?: string) {
  const migrations = (await readdir('db/migrations')).filter(name => name.endsWith('.up.sql')).sort();
  if (!migrations.length) throw new Error('AppDB migrations are missing.');
  return {
    appSchema: await hashSources(migrations.map(name => join('db/migrations', name).replace(/\\/g, '/'))),
    idpConfig: await hashSources(['ops/local/keycloak-realm.json', 'ops/local/keycloak-step-up.json', 'ops/local/stack.ts']),
    stack: await hashSources(['ops/local/compose.yaml', 'ops/local/start-postgres.sh', 'ops/local/pg_hba.conf']),
    keycloakImage: configuredKeycloak(f, envFile),
  };
}

export type Pair = (
  | { format: 1; capturedAt?: never; disposable?: never }
  | { format: 2 | 3; capturedAt: string; disposable?: true }
  | { format: 4; capturedAt: string; disposable: true; lineageCapturedAt: string }
) & {
  lineageCapturedAt?: string;
  fixtureId: string;
  revision: string;
  compatibility: Awaited<ReturnType<typeof compatibility>>;
  appliedAppSchema: string;
  identitySchema: string;
  postgresImage: string;
  effectiveIdentityConfig?: string;
  historyAnchor?: { after: number; evidenceSha256: string };
  archives: Record<string, { sha256: string; systemId: string; catalogVersion: string; encryption?: ArchiveEncryption }>;
};

export function encryptedFormat(format: Pair['format']): boolean {
  return format === 3 || format === 4;
}

export function archiveFile(db: Database, format: Pair['format']): string {
  return encryptedFormat(format) ? db.archive + '.enc' : db.archive;
}

function pairExpired(pair: Pair): boolean {
  if (pair.format === 1 && pair.capturedAt === undefined && pair.disposable === undefined && pair.lineageCapturedAt === undefined) return false;
  const now = Date.now();
  const captureTime = typeof pair.capturedAt === 'string' ? Date.parse(pair.capturedAt) : NaN;
  if ((pair.format !== 2 && !encryptedFormat(pair.format)) || !Number.isFinite(captureTime) || new Date(captureTime).toISOString() !== pair.capturedAt
      || captureTime > now || (pair.disposable !== undefined && pair.disposable !== true)) {
    throw new Error('Backup pair has an invalid capture time or retention metadata.');
  }
  let retentionStart = captureTime;
  if (pair.format === 4 || pair.lineageCapturedAt !== undefined) {
    retentionStart = typeof pair.lineageCapturedAt === 'string' ? Date.parse(pair.lineageCapturedAt) : NaN;
    if (!encryptedFormat(pair.format) || pair.disposable !== true || !pair.historyAnchor
        || !Number.isFinite(retentionStart) || new Date(retentionStart).toISOString() !== pair.lineageCapturedAt
        || retentionStart > captureTime || (pair.format === 3 && retentionStart !== captureTime)) {
      throw new Error('Backup pair has invalid capture lineage.');
    }
  }
  return now >= retentionStart + retentionMs;
}

export function requireUnexpired(pair: Pair): void {
  if (pairExpired(pair)) throw new Error('Backup pair has expired.');
}

// These fixture revisions change bootstrap/restore controls but produce the same synthetic IdP configuration.
const compatibleIdpConfigs = new Set([
  'a63937e20b8444a2d0baf887ef7fbd2bbdbbb4b95e9cb711d6a40021231a0def', // #216
  '196ca6133119b3aad441392a50395bcf67dea77260af37dafcfcdb96ec26c22c', // #217
  'e6b21a8d0644f45944b1177506118c2c17b923fdda8c639be625eed089acce79', // #219
  '16a317924e98caf2efcacbfbb89274d989c2d2fb667baad0e02561416cd98dad', // paired restore
  '47420f024562f01694126e4edfa0a9903b89df43476d3eb3ac161db61a361fb5', // before dispatch reopen
  'c729c7ec9dad4175bc32abbb0f33d693d7980bcc1132b1d1a3fc88ee80c0cf18', // fixture provenance
  '072a8dbf6bc2883f3ec9451637105adbaefd47fb4163a7898e96339f59fe9e10', // dispatch retention
  'b1271154041a1354e66f287a8f0c5b2e716c436bce702b2babe91033ad8e10b8', // audit retention
]);

// Exact schema revisions eligible for forward offline import, oldest first.
const forwardAppSchemas = [
  '3ae9f21ff752c8ddd96eb7a6d4186f454f9f5aaef66da947b6dc1dc8b8f86ed6', // 010
  '4541e90e1700eeb4d33a2b6cccfec22a21b952fafa2fd924cdc5f9c527894b5e', // 011
  '876960c39b38d3df70bd58acd7fee6398913fd6c95cb7d784d34e7678618dc13', // 012
  '7f0b097431fc0aa8bcd65ab4efba90eafe67d4f3f6df1fd853f2dd74731a3fb5', // 013
  '459bf0884e01499bfc2568026aa24b728776efae865932aa9766bb4cdc7cf341', // 014
  '9266f480fe7c90e8d6ac8b9edaab2b68c86b4e27f9b963ba93946c52786c5494', // 015
  '818970ac5486b1690d74df19d2a03a9b90aac4a9f42cc297012584efb7105db0', // 016
  'fbd94933a49b45464cb50ca6b422a9ad51f476876dcdb1d9a0d2395f30dd42b3', // 017
];

export async function verifyPair(path: string, fixtureId: string, expected: Pair['compatibility'], pair: Pair,
  suppliedKey?: KeyObject): Promise<void> {
  const idpConfig = pair?.compatibility?.idpConfig;
  const compatible = { ...expected };
  if (idpConfig && compatibleIdpConfigs.has(expected.idpConfig) && compatibleIdpConfigs.has(idpConfig)) {
    compatible.idpConfig = idpConfig;
  }
  const sourceSchemaIndex = forwardAppSchemas.indexOf(pair?.compatibility?.appSchema);
  if (sourceSchemaIndex >= 0 && sourceSchemaIndex < forwardAppSchemas.indexOf(expected.appSchema)) {
    compatible.appSchema = pair.compatibility.appSchema;
  }
  if ((pair?.format !== 1 && pair?.format !== 2 && !encryptedFormat(pair?.format)) || !/^[a-f0-9]{32}$/.test(fixtureId) || pair.fixtureId !== fixtureId
      || !/^[a-f0-9]{40}$/.test(pair.revision) || !digest.test(pair.appliedAppSchema) || !digest.test(pair.identitySchema)
      || pair.postgresImage !== postgresImage
      || !isDeepStrictEqual(pair.compatibility, compatible)) {
    throw new Error('Backup pair has an unknown identity or incompatible build, schema or configuration.');
  }
  if (pair.historyAnchor !== undefined && (!pair.historyAnchor
      || !Number.isSafeInteger(pair.historyAnchor.after) || pair.historyAnchor.after < 1
      || typeof pair.historyAnchor.evidenceSha256 !== 'string' || !digest.test(pair.historyAnchor.evidenceSha256))) {
    throw new Error('Backup history anchor is invalid.');
  }
  const key = encryptedFormat(pair.format) ? suppliedKey ?? await loadBackupKey(dirname(path)) : undefined;
  if (key) await authenticateManifest(path, pair, key);
  else if ((await readdir(path)).includes(manifestAuthentication)) throw new Error('Backup manifest format mismatch.');
  requireUnexpired(pair);
  if (Object.keys(pair.archives ?? {}).length !== databases.length) throw new Error('Backup pair is incomplete.');
  const systemIds = new Set<string>();
  for (const db of databases) {
    const record = pair.archives[db.archive];
    const file = join(path, archiveFile(db, pair.format));
    if (!record || typeof record.sha256 !== 'string' || !digest.test(record.sha256)
        || typeof record.systemId !== 'string' || !/^\d{1,20}$/.test(record.systemId)
        || typeof record.catalogVersion !== 'string' || !/^\d{9}$/.test(record.catalogVersion)) {
      throw new Error('Backup archive metadata is incomplete.');
    }
    const info = await lstat(file).catch(() => undefined);
    if (!info?.isFile() || info.size === 0) throw new Error('A backup archive is missing.');
    if (key) {
      if (!validEncryption(record.encryption) || record.encryption.bytes !== info.size) {
        throw new Error('Encrypted archive metadata or length is invalid.');
      }
      await decryptArchive(file, record.encryption, record.sha256, key, fixtureId, db.archive);
    } else if (record.encryption !== undefined || await hashFile(file) !== record.sha256) {
      throw new Error('A legacy backup archive failed its format or SHA-256 check.');
    }
    systemIds.add(record.systemId);
  }
  if (systemIds.size !== databases.length || pair.archives['app-db.tar']?.catalogVersion !== pair.archives['identity-db.tar']?.catalogVersion) {
    throw new Error('The pair must contain two distinct compatible PostgreSQL clusters.');
  }
  requireUnexpired(pair);
}

async function expire(): Promise<void> {
  for (const path of ['work', 'work/pilot', directory]) {
    if (!(await lstat(path)).isDirectory()) throw new Error('Expiry requires a local backup directory.');
  }
  const manifest = join(directory, 'pair.json');
  for (const path of ['work/pilot/fixture.json', manifest]) {
    if (!(await lstat(path)).isFile()) throw new Error('Expiry requires local fixture and pair manifests.');
  }
  const fixture = await loadFixture(true);
  const pair: Pair = JSON.parse(await readFile(manifest, 'utf8'));
  if (fixture.restoreTarget || (pair?.format !== 2 && !encryptedFormat(pair?.format))
      || pair.disposable !== true || pair.fixtureId !== fixture.id) {
    throw new Error('Expiry requires a disposable pair captured for this fixture.');
  }
  if (encryptedFormat(pair.format)) await authenticateManifest(directory, pair, await loadBackupKey());
  else if ((await readdir(directory)).includes(manifestAuthentication)) throw new Error('Backup manifest format mismatch.');
  if (!pairExpired(pair)) throw new Error('Backup pair has not expired.');

  for (const db of databases) {
    const expected = pair.archives?.[db.archive]?.sha256;
    const path = join(directory, archiveFile(db, pair.format));
    const info = await lstat(path).catch(error => {
      if (error.code !== 'ENOENT') throw error;
    });
    if (typeof expected !== 'string' || !digest.test(expected)
        || (info && (!info.isFile() || await hashFile(path) !== expected))) {
      throw new Error('Expiry requires the original backup archive files.');
    }
  }
  // Keep the manifest so expiry can be retried after either archive has been removed.
  for (const db of databases) await rm(join(directory, archiveFile(db, pair.format)), { force: true });
}

interface Container {
  Id: string;
  Image: string;
  Config: { Labels: Record<string, string> };
  State: { Status: string; StartedAt: string; FinishedAt: string; ExitCode: number };
  Mounts: { Type: string; Name?: string; Destination: string }[];
}

function containers(f: Fixture): Map<string, Container> {
  const ids = docker(['ps', '-aq', '--filter', 'label=com.docker.compose.project=' + f.project]).split(/\s+/).filter(Boolean);
  if (ids.length !== 4) throw new Error('Unknown fixture containers or active fixture runner.');
  const services = new Map<string, Container>();
  for (const container of JSON.parse(docker(['inspect', ...ids])) as Container[]) {
    const labels = container.Config.Labels;
    const service = labels['com.docker.compose.service'];
    if (!service || !['postgres', 'identity-db', 'keycloak', 'mailbox'].includes(service)
        || services.has(service) || labels['org.maexsocial.fixture'] !== f.id
        || labels['com.docker.compose.oneoff'] !== 'False') throw new Error('Unknown fixture container.');
    services.set(service, container);
  }
  return services;
}

export function volumeName(f: Fixture, db: Database): string {
  return f.project + '_' + db.volume;
}

function validateDatabases(f: Fixture, services: Map<string, Container>, imageId: string): void {
  for (const db of databases) {
    const container = services.get(db.service)!;
    const name = volumeName(f, db);
    const [volume] = JSON.parse(docker(['volume', 'inspect', name]));
    const mount = container.Mounts.find(entry => entry.Destination === '/var/lib/postgresql/data');
    if (container.Image !== imageId || mount?.Type !== 'volume' || mount.Name !== name
        || volume.Driver !== 'local' || Object.keys(volume.Options ?? {}).length
        || volume.Labels?.['com.docker.compose.project'] !== f.project
        || volume.Labels?.['com.docker.compose.volume'] !== db.volume) throw new Error('Unknown fixture database volume or image.');
  }
}

function stoppedState(f: Fixture, original: Map<string, Container>): string[] {
  const current = containers(f);
  for (const [service, container] of current) {
    const previous = original.get(service);
    if (container.State.Status !== 'exited' || container.Id !== previous?.Id
        || container.State.StartedAt !== previous.State.StartedAt
        || (databases.some(db => db.service === service) && container.State.ExitCode !== 0)) {
      throw new Error('The backup source is active or did not shut down cleanly.');
    }
  }
  for (const db of databases) {
    if (docker(['ps', '-q', '--filter', 'volume=' + volumeName(f, db)])) throw new Error('A backup source volume is in use.');
  }
  return [...current.keys()].sort().map(service => current.get(service)!.State.FinishedAt);
}

function query(container: Container, db: Database, sql: string): string {
  return docker(['exec', '--user', 'postgres', container.Id, 'psql', '-XAt', '-v', 'ON_ERROR_STOP=1',
    '-U', db.owner, '-d', db.database, '-c', sql]);
}

async function captureHistory(f: Fixture, app: Container, disposable: boolean): Promise<NonNullable<Pair['historyAnchor']>> {
  const db = databases[0];
  const tenantId = randomUUID(), prior = randomUUID(), draft = randomUUID();
  query(app, db, `BEGIN;
    INSERT INTO pilot.tenants(id,name) VALUES ('${tenantId}','Cold Backup Orchard');
    INSERT INTO pilot.locations(tenant_id,id,provider_location,grant_active)
      VALUES ('${tenantId}','${prior}','before-snapshot',true),
        ('${tenantId}',gen_random_uuid(),'after-snapshot',true),
        ('${tenantId}',gen_random_uuid(),'unaffected',true);
    INSERT INTO pilot.drafts(tenant_id,id) VALUES ('${tenantId}','${draft}');
    INSERT INTO pilot.occurrences(tenant_id,draft_id,location_id,creation_key,due_at,timezone)
      SELECT tenant_id,'${draft}',id,gen_random_uuid(),'2030-01-01T12:00:00Z','UTC'
      FROM pilot.locations WHERE tenant_id='${tenantId}';
    COMMIT;`);

  // The independent journal exists before the cold copy and outside either database or archive.
  const records = [{ seq: 1, kind: 'revoke-grant', tenantId, id: prior, version: 1 }];
  const path = 'work/pilot/capture-history.json';
  const journal = JSON.stringify({ schema: 1, fixtureId: f.id, after: 0, through: records.length, records });
  await writeFile(path, journal, { mode: 0o600, flag: 'wx' });
  query(app, db, `UPDATE pilot.locations SET grant_active=false,version=version+1
    WHERE tenant_id='${tenantId}' AND id='${prior}' AND grant_active AND version=1`);
  if (query(app, db, `SELECT count(*) FROM pilot.locations
    WHERE tenant_id='${tenantId}' AND id='${prior}' AND NOT grant_active AND version=2`) !== '1') {
    throw new Error('The synthetic history event did not take effect.');
  }
  const evidence = await readFile(path, 'utf8');
  if (evidence !== journal) throw new Error('Capture history evidence changed.');
  const { through } = JSON.parse(evidence) as { through: number };
  const evidenceSha256 = createHash('sha256').update(evidence).digest('hex');
  query(app, db, `ALTER TABLE public.fixture_identity
    ADD COLUMN restore_history_after bigint NOT NULL DEFAULT ${through},
    ADD COLUMN disposable_backup boolean NOT NULL DEFAULT ${disposable ? 'true' : 'false'},
    ADD COLUMN restore_history_evidence text NOT NULL DEFAULT '${evidenceSha256}'`);
  return { after: through, evidenceSha256 };
}

async function copyCluster(f: Fixture, db: Database, output: string, key: KeyObject): Promise<Pair['archives'][string]> {
  const child = spawn('docker', ['run', '--rm', '--read-only', '--tmpfs', '/tmp', '--network', 'none', '--pull', 'never',
    '--log-driver', 'none', '--label', 'org.maexsocial.fixture=' + f.id, '--entrypoint', 'sh',
    '--mount', 'type=volume,src=' + volumeName(f, db) + ',dst=/source,readonly,volume-nocopy', postgresImage, '-eu', '-c',
    'export LC_ALL=C; test "$(cat /source/PG_VERSION)" = "$PG_MAJOR"; test ! -e /source/postmaster.pid; '
    + 'test -z "$(find /source -type l -print -quit)"; '
    + 'control=$(pg_controldata /source 2>/tmp/pg-control) && test ! -s /tmp/pg-control; '
    + 'printf "%s\\n" "$control" | grep -Eq "^Database cluster state:[[:space:]]+shut down$"; '
    + 'tar -cf - -C /source .; test ! -e /source/postmaster.pid; '
    + 'test "$control" = "$(pg_controldata /source)"; printf "%s\\n" "$control" >&2'],
  { stdio: ['ignore', 'pipe', 'pipe'], timeout: 180_000 });
  let control = '';
  let excessiveOutput = false;
  child.stderr.setEncoding('utf8').on('data', (text: string) => {
    if (control.length + text.length <= 8192) control += text;
    else { excessiveOutput = true; child.kill(); }
  });
  const completed = new Promise<void>((resolve, reject) => {
    const failed = () => reject(new Error('The cold cluster could not be read.'));
    child.once('error', failed);
    child.once('close', code => { if (code === 0 && !excessiveOutput) resolve(); else failed(); });
  });
  const file = join(output, archiveFile(db, 3));
  const encrypted = encryptArchive(child.stdout, file, key, f.id, db.archive).catch(error => {
    child.kill();
    throw error;
  });
  const [processResult, archiveResult] = await Promise.allSettled([completed, encrypted]);
  if (archiveResult.status === 'rejected') throw archiveResult.reason;
  if (processResult.status === 'rejected') throw processResult.reason;
  const systemId = control.match(/^Database system identifier:\s+(\d+)$/m)?.[1];
  const catalogVersion = control.match(/^Catalog version number:\s+(\d+)$/m)?.[1];
  if (!systemId || !catalogVersion) throw new Error('The cold cluster could not be identified.');
  return { sha256: await hashFile(file), systemId, catalogVersion, encryption: archiveResult.value };
}

function cleanRevision(): string {
  const git = (...args: string[]) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  if (git('status', '--porcelain', '--untracked-files=normal')) throw new Error('Capture requires a clean source worktree.');
  return git('rev-parse', 'HEAD');
}

type CaptureMetadata = Pick<Pair, 'fixtureId' | 'revision' | 'compatibility' | 'appliedAppSchema'
  | 'identitySchema' | 'postgresImage' | 'historyAnchor' | 'disposable'>;

export function continuedRetention(parent: Pair, archives: Pair['archives']) {
  if (!parent.lineageCapturedAt || !databases.every(db => {
    const prior = parent.archives[db.archive], next = archives[db.archive];
    return prior && next && prior.systemId === next.systemId && prior.catalogVersion === next.catalogVersion;
  })) throw new Error('Continued capture requires the original PostgreSQL clusters and capture lineage.');
  return { format: 4 as const, disposable: true as const, lineageCapturedAt: parent.lineageCapturedAt };
}

async function writeStoppedPair(f: Fixture, sources: Map<string, Container>, pending: string, destination: string,
  key: KeyObject, metadata: CaptureMetadata | Pair): Promise<void> {
  const before = stoppedState(f, sources);
  const capturedAt = new Date().toISOString();
  const archives: Pair['archives'] = {};
  for (const db of databases) archives[db.archive] = await copyCluster(f, db, pending, key);
  if (!isDeepStrictEqual(before, stoppedState(f, sources))) throw new Error('The backup source restarted during capture.');
  const retention = 'archives' in metadata ? continuedRetention(metadata, archives)
    : { format: 3 as const, ...(metadata.disposable ? { lineageCapturedAt: capturedAt } : {}) };
  const pair: Pair = { ...metadata, ...retention, capturedAt, archives };
  await sealManifest(pending, pair, key);
  await verifyPair(pending, f.id, await compatibility(f), pair, key);
  if (cleanRevision() !== metadata.revision) throw new Error('The source revision changed during capture.');
  await writeFile(join(pending, 'pair.json'), JSON.stringify(pair, null, 2), { mode: 0o600, flag: 'wx' });
  requireUnexpired(pair);
  await rename(pending, destination);
}

// The physical drill continues its own disposable source without reinitializing or reseeding either database.
export async function captureContinuedFixture(expectedId: string, destination: string): Promise<void> {
  const f = await loadFixture();
  if (f.id !== expectedId || f.purpose !== 'backup' || f.restoreTarget || !usesLocalDocker()) {
    throw new Error('Continued capture requires the original local backup fixture.');
  }
  const original: Pair = JSON.parse(await readFile(join(directory, 'pair.json'), 'utf8'));
  const key = await loadBackupKey();
  if (!encryptedFormat(original.format) || !original.disposable || !original.lineageCapturedAt
      || !original.historyAnchor || original.revision !== cleanRevision()) {
    throw new Error('Continued capture requires a disposable encrypted pair at the same revision.');
  }
  await verifyPair(directory, f.id, await compatibility(f), original, key);
  if (await hashFile('work/pilot/capture-history.json') !== original.historyAnchor.evidenceSha256) {
    throw new Error('Continued capture requires the original capture history.');
  }
  const sources = containers(f);
  validateDatabases(f, sources, docker(['image', 'inspect', '--format', '{{.Id}}', postgresImage]));
  const pending = destination + '.pending';
  await mkdir(pending, { mode: 0o700 });
  try {
    await writeStoppedPair(f, sources, pending, destination, key, original);
  } catch (error) {
    await rm(pending, { recursive: true, force: true });
    throw error;
  }
}

export async function capture(disposable: boolean, seed?: (fixture: Fixture) => void): Promise<void> {
  const revision = cleanRevision();
  const key = await loadBackupKey();
  if (!usesLocalDocker()) throw new Error('Cold backup requires a local Docker socket.');
  const f = await initialize('backup');
  const expected = await compatibility(f);
  const imageId = (image: string) => docker(['image', 'inspect', '--format', '{{.Id}}', image]);
  const postgresId = imageId(postgresImage);
  const keycloakId = imageId(expected.keycloakImage);
  const pending = directory + '.pending';
  await mkdir(pending, { mode: 0o700 });
  let stopped = false;
  let published = false;
  try {
    compose(f, ['up', '-d', '--pull', 'never', '--wait', '--wait-timeout', '120']);
    verifyContainers(f);
    const run = (...args: string[]) => compose(f, ['run', '--rm', '--no-deps', '--pull', 'never', 'runner', 'node', ...args]);
    run('dist/pilot/ops/local/stack.js', 'check');
    run('dist/pilot/scripts/pilot-db.js', 'up');
    seed?.(f);
    const sources = containers(f);
    validateDatabases(f, sources, postgresId);
    if (sources.get('keycloak')!.Image !== keycloakId) throw new Error('Unknown Keycloak image.');

    const [app, identity] = databases;
    const appContainer = sources.get(app.service)!;
    if (query(appContainer, app, 'SELECT id FROM public.fixture_identity') !== f.id) throw new Error('AppDB fixture identity mismatch.');
    const historyAnchor = await captureHistory(f, appContainer, disposable);
    const schema = docker(['exec', '--user', 'postgres', appContainer.Id, 'pg_dump', '-U', app.owner, '-d', app.database,
      '--schema=pilot', '--schema-only', '--restrict-key=MaexSocialColdBackupSchema']);
    const appliedAppSchema = createHash('sha256').update(schema).digest('hex');
    const idpContainer = sources.get(identity.service)!;
    if (query(idpContainer, identity, "SELECT username FROM user_entity JOIN realm ON realm.id = user_entity.realm_id "
      + "WHERE realm.name = 'pilot' AND NOT user_entity.enabled AND username = 'cold-backup-" + f.id + "'") !== 'cold-backup-' + f.id) {
      throw new Error('Identity database fixture identity mismatch.');
    }
    const identitySchema = query(idpContainer, identity, "SELECT encode(sha256(convert_to(string_agg(concat_ws('|', id, author, filename, md5sum), "
      + "E'\\n' ORDER BY orderexecuted), 'UTF8')), 'hex') FROM databasechangelog");

    compose(f, ['stop']);
    await writeStoppedPair(f, sources, pending, directory, key, {
      fixtureId: f.id, revision, compatibility: expected, appliedAppSchema, identitySchema,
      postgresImage, historyAnchor, ...(disposable ? { disposable: true } : {}),
    });
    stopped = true;
    published = true;
  } finally {
    try { if (!stopped) compose(f, ['stop']); }
    finally { if (!published) await rm(pending, { recursive: true, force: true }); }
  }
}

async function main(): Promise<void> {
  const [action, option, ...extra] = process.argv.slice(2);
  const disposable = action === 'capture' && option === '--disposable';
  if (!['capture', 'verify', 'expire'].includes(action ?? '') || extra.length || (option !== undefined && !disposable)) {
    throw new Error('Usage: npm run pilot:backup -- capture [--disposable] | verify | expire');
  }
  if (action === 'expire') {
    await expire();
    console.log('Expired both synthetic backup archives.');
    return;
  }
  if (action === 'capture') {
    if (await lstat('work/pilot').catch(error => {
      if (error.code !== 'ENOENT') throw error;
    })) throw new Error('Capture requires a fresh worktree without work/pilot.');
    await capture(disposable);
  } else {
    const f = await loadFixture(true);
    const pair: Pair = JSON.parse(await readFile(join(directory, 'pair.json'), 'utf8'));
    await verifyPair(directory, f.id, await compatibility(f), pair);
    if (pair.format === 1) {
      console.log('Legacy pair verified for offline inspection; capture time and retention eligibility are unknown.');
      return;
    }
  }
  console.log('Verified synthetic AppDB and IdP backup pair.');
}

if (require.main === module) main().catch(error => {
  // Docker, SQL, and filesystem diagnostics may contain private fixture data.
  const message = error instanceof Error && error.constructor === Error
    && !error.message.startsWith('Docker ') ? error.message : 'Fixture operation failed; the backup pair was not verified.';
  console.error(message);
  process.exitCode = 1;
});
