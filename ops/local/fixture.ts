import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { Client, type ClientConfig } from 'pg';

export interface Fixture {
  schema: 1;
  id: string;
  project: string;
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

export function safeDiagnostics(text: string): string {
  // This fixture generates only 64-hex credentials; never use this as a general log sanitizer.
  return text.replace(/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]*?(?:-----END (?:RSA |EC )?PRIVATE KEY-----|$)/g, '[private key]')
    .replace(/[a-f0-9]{64}/gi, '[fixture secret]').slice(-12000);
}

export function compose(f: Fixture, args: string[]): string {
  return docker(['compose', '--project-name', f.project, '--env-file', 'work/pilot/compose.env',
    '-f', 'ops/local/compose.yaml', ...args], { ...process.env,
    FIXTURE_ID: f.id });
}

export async function databaseConfig(f: Fixture, owner = false): Promise<ClientConfig> {
  return { host: 'postgres', port: 5432, database: 'pilot_fixture',
    user: owner ? 'pilot_owner' : 'pilot_app', password: owner ? f.ownerPassword : f.appPassword,
    ssl: { ca: await readFile('work/pilot/postgres.crt', 'utf8'), rejectUnauthorized: true },
    options: '-c statement_timeout=10000 -c lock_timeout=5000', connectionTimeoutMillis: 5000 };
}

export function verifyContainers(f: Fixture): void {
  const ids = compose(f, ['ps', '-q', 'postgres']).split(/\s+/).filter(Boolean);
  if (ids.length !== 1) throw new Error('Fixture PostgreSQL is not running');
  const inspected = JSON.parse(docker(['inspect', ids[0]!]))[0];
  const labels = inspected.Config.Labels;
  if (labels['org.maexsocial.fixture'] !== f.id || labels['com.docker.compose.project'] !== f.project
      || Object.values(inspected.NetworkSettings.Ports).some(value => Array.isArray(value) && value.length)) {
    throw new Error('Fixture container identity mismatch');
  }
  for (const network of ['application', 'identity']) {
    const inspectedNetwork = JSON.parse(docker(['network', 'inspect', `${f.project}_${network}`]))[0];
    if (!inspectedNetwork.Internal || inspectedNetwork.Labels['com.docker.compose.project'] !== f.project) {
      throw new Error('Fixture network is not isolated');
    }
  }
}

export async function runIsolated(args: string[]): Promise<string> {
  const f = await loadFixture();
  verifyContainers(f);
  return compose(f, ['run', '--rm', '--no-deps', 'runner', 'node', ...args]);
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
