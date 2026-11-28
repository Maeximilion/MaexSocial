import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { Client, type ClientConfig } from 'pg';

const purposes = ['ordinary', 'backup', 'restore-target', 'readiness', 'paired-restore', 'dispatch-retention', 'audit-retention'] as const;
export type FixturePurpose = typeof purposes[number];

export interface Fixture {
  schema: 1;
  id: string;
  project: string;
  purpose?: FixturePurpose;
  restoreTarget?: true;
  pairedRestore?: true;
  expiresAt: number;
  ownerPassword: string;
  appPassword: string;
  identityPassword: string;
  keycloakPassword: string;
}

export function validateFixture(value: unknown, allowExpired = false): asserts value is Fixture {
  if (!value || typeof value !== 'object') throw new Error('Invalid fixture manifest');
  const f = value as Record<string, unknown>;
  if (f.schema !== 1 || typeof f.id !== 'string' || !/^[a-f0-9]{32}$/.test(f.id)
      || (f.purpose !== undefined && !purposes.some(purpose => purpose === f.purpose))
      || (f.restoreTarget !== undefined && f.restoreTarget !== true)
      || (f.pairedRestore !== undefined && (f.pairedRestore !== true || f.restoreTarget !== true))
      || f.project !== `maex-pilot-${f.id}` || typeof f.expiresAt !== 'number'
      || !Number.isFinite(f.expiresAt) || (!allowExpired && f.expiresAt <= Date.now())) {
    throw new Error('Unknown, expired or non-fixture target');
  }
  for (const key of ['ownerPassword', 'appPassword', 'identityPassword', 'keycloakPassword']) {
    if (typeof f[key] !== 'string' || !/^[a-f0-9]{64}$/.test(f[key])) throw new Error('Invalid fixture credential');
  }
}

export async function loadFixture(allowExpired = false): Promise<Fixture> {
  const value: unknown = JSON.parse(await readFile('work/pilot/fixture.json', 'utf8'));
  validateFixture(value, allowExpired);
  return value;
}

export function docker(args: string[], env: NodeJS.ProcessEnv = process.env): string {
  try { return execFileSync('docker', args, { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'], timeout: 180_000 }).trim(); }
  catch (error) {
    const failure = error as { stdout?: string; stderr?: string };
    throw new Error(`Docker ${args[0]} failed: ${safeDiagnostics(`${failure.stdout ?? ''}\n${failure.stderr ?? ''}`)}`);
  }
}

export function usesLocalDocker(): boolean {
  const endpoint = (!process.env.DOCKER_CONTEXT && process.env.DOCKER_HOST)
    || JSON.parse(docker(['context', 'inspect', '--format', '{{json .Endpoints.docker.Host}}']));
  return typeof endpoint === 'string' && /^(unix|npipe):\/\//.test(endpoint);
}

export function safeDiagnostics(text: string): string {
  // This fixture generates only 64-hex credentials; never use this as a general log sanitizer.
  return text.replace(/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]*?(?:-----END (?:RSA |EC )?PRIVATE KEY-----|$)/g, '[private key]')
    .replace(/[a-f0-9]{64}/gi, '[fixture secret]').slice(-12000);
}

export function compose(f: Fixture, args: string[], envFile = 'work/pilot/compose.env'): string {
  return docker(['compose', '--project-name', f.project, '--env-file', envFile,
    '-f', 'ops/local/compose.yaml', ...args], { ...process.env,
    FIXTURE_ID: f.id, FIXTURE_UID: String(process.getuid?.() ?? 0), FIXTURE_GID: String(process.getgid?.() ?? 0) });
}

export async function databaseConfig(f: Fixture, owner = false): Promise<ClientConfig> {
  return { host: 'postgres', port: 5432, database: 'pilot_fixture',
    user: owner ? 'pilot_owner' : 'pilot_app', password: owner ? f.ownerPassword : f.appPassword,
    ssl: { ca: await readFile('work/pilot/postgres.crt', 'utf8'), rejectUnauthorized: true },
    options: '-c statement_timeout=10000 -c lock_timeout=5000', connectionTimeoutMillis: 5000 };
}

interface ContainerInfo {
  Id: string;
  Config: { Labels: Record<string, string> };
  State?: { Status: string; Health?: { Status: string } };
  NetworkSettings: { Ports: Record<string, unknown>; Networks: Record<string, { NetworkID: string }> };
}
interface NetworkInfo {
  Id: string;
  Name: string;
  Internal: boolean;
  Labels: Record<string, string>;
  Containers?: Record<string, unknown>;
}

export function verifyTopology(f: Fixture, containers: ContainerInfo[], networks: NetworkInfo[]) {
  const services = new Map([['postgres', 'application'], ['identity-db', 'identity'], ['keycloak', 'identity'], ['mailbox', 'identity']]);
  if (f.pairedRestore) {
    services.delete('keycloak');
    services.delete('mailbox');
  }
  if (containers.length !== services.size || networks.length !== 2) throw new Error('Incomplete fixture topology');
  if (f.restoreTarget && networks.flatMap(network => Object.keys(network.Containers ?? {})).length !== containers.length) {
    throw new Error('Unexpected restore network attachments');
  }
  let publishedHostPorts = 0;
  for (const container of containers) {
    const labels = container.Config.Labels;
    const service = labels['com.docker.compose.service']!;
    const networkName = services.get(service);
    const expected = networks.find(n => n.Name === `${f.project}_${networkName}`);
    const attachments = Object.entries(container.NetworkSettings.Networks);
    const portMappings = Object.values(container.NetworkSettings.Ports).flatMap(value => Array.isArray(value) ? value : []);
    publishedHostPorts += portMappings.length;
    if (!networkName || !expected || expected.Internal !== true || expected.Labels['com.docker.compose.project'] !== f.project
        || labels['org.maexsocial.fixture'] !== f.id || labels['com.docker.compose.project'] !== f.project
        || attachments.length !== 1 || attachments[0]![0] !== expected.Name || attachments[0]![1].NetworkID !== expected.Id
        || (f.restoreTarget && !Object.hasOwn(expected.Containers ?? {}, container.Id)) || portMappings.length) {
      throw new Error('Fixture service is not isolated');
    }
    services.delete(service);
  }
  return { internalNetworks: networks.filter(network => network.Internal).length, publishedHostPorts };
}

export function verifyContainers(f: Fixture, requireHealthyDatabases = false) {
  const ids = compose(f, ['ps', '-q']).split(/\s+/).filter(Boolean);
  if (ids.length !== (f.pairedRestore ? 2 : 4)) throw new Error('Fixture services are not running');
  const containers = JSON.parse(docker(['inspect', ...ids])) as ContainerInfo[];
  const topology = verifyTopology(f, containers,
    JSON.parse(docker(['network', 'inspect', `${f.project}_application`, `${f.project}_identity`])));
  if (requireHealthyDatabases && containers.some(({ Config, State }) =>
    ['postgres', 'identity-db'].includes(Config.Labels['com.docker.compose.service']!)
      && (State?.Status !== 'running' || State.Health?.Status !== 'healthy'))) {
    throw new Error('Fixture databases are not ready');
  }
  return topology;
}

export function runIsolatedFixture(f: Fixture, args: string[], requireHealthyDatabases = false) {
  const topology = verifyContainers(f, requireHealthyDatabases);
  const output = compose(f, ['run', '--rm', '--no-deps', ...(f.pairedRestore || f.purpose === 'audit-retention' ? ['--pull', 'never'] : []), 'runner', 'node', ...args]);
  return { topology, output };
}

export async function runIsolated(args: string[]): Promise<string> {
  return runIsolatedFixture(await loadFixture(), args).output;
}

export async function requireOrdinaryFixtureDatabase(db: Client, id: string): Promise<void> {
  const ordinary = await db.query("SELECT 1 FROM public.fixture_identity WHERE id=$1 AND NOT restore_target"
    + " AND purpose='ordinary' AND current_database()='pilot_fixture' AND current_user='pilot_owner' FOR SHARE", [id]);
  if (ordinary.rowCount !== 1) throw new Error('Ordinary fixture database required');
}

export async function connectFixture(owner = false): Promise<Client> {
  if (process.env.PILOT_CONTAINER !== '1') throw new Error('Database access requires the isolated runner');
  const f = await loadFixture();
  const client = new Client(await databaseConfig(f, owner));
  await client.connect();
  try {
    if (owner) {
      const identity = await client.query('SELECT id FROM public.fixture_identity');
      if (identity.rowCount !== 1 || identity.rows[0].id !== f.id) throw new Error('Fixture database identity mismatch');
    }
    return client;
  } catch (error) { await client.end(); throw error; }
}
