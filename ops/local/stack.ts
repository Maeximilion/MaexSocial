import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { get } from 'node:https';
import { resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { compose, docker, loadFixture, runIsolated, safeDiagnostics, type Fixture } from './fixture.js';

const postgresImage = 'postgres:17.11-bookworm@sha256:665dc7b37ac52a17e298511414c21d23ffa4e6a6ef6225b3e5d59c7afb35e994';
const secret = () => randomBytes(32).toString('hex');

async function initialize(): Promise<Fixture> {
  await mkdir('work', { recursive: true });
  // Exclusive directory creation preserves existing credentials and database volumes on failure.
  await mkdir('work/pilot', { mode: 0o700 });
  const f: Fixture = { schema: 1, id: randomBytes(16).toString('hex'), project: '', expiresAt: Date.now() + 86_400_000,
    ownerPassword: secret(), appPassword: secret(), identityPassword: secret(), keycloakPassword: secret() };
  f.project = `maex-pilot-${f.id}`;
  const save = (name: string, value: string) => writeFile(`work/pilot/${name}`, value, { mode: 0o600, flag: 'wx' });
  const expiry = new Date(f.expiresAt).toISOString();
  await save('fixture.json', JSON.stringify(f));
  await save('owner-password', f.ownerPassword);
  await save('identity-password', f.identityPassword);
  await save('compose.env', `FIXTURE_ID=${f.id}\n`);
  docker(['pull', postgresImage]);
  for (const name of ['postgres', 'identity-db', 'keycloak', 'mailbox']) {
    docker(['run', '--rm', '--network', 'none', '-v', `${resolve('work/pilot')}:/fixture`, '--entrypoint', 'openssl', postgresImage,
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', `/CN=${name}`,
      '-addext', `subjectAltName=DNS:${name},DNS:localhost,IP:127.0.0.1`,
      '-keyout', `/fixture/${name}.key`, '-out', `/fixture/${name}.crt`]);
  }
  docker(['run', '--rm', '--network', 'none', '-v', `${resolve('work/pilot')}:/fixture`, '--entrypoint', 'chown',
    postgresImage, '1000:1000', '/fixture/keycloak.key']);
  // Only generated hex values enter bootstrap SQL. No supplied SQL or connection URI is accepted.
  await save('init-app.sql', `CREATE ROLE pilot_app LOGIN PASSWORD '${f.appPassword}' VALID UNTIL '${expiry}';
ALTER ROLE pilot_owner VALID UNTIL '${expiry}';
REVOKE ALL ON DATABASE pilot_fixture FROM PUBLIC;
GRANT CONNECT ON DATABASE pilot_fixture TO pilot_app;
REVOKE ALL ON DATABASE postgres, template1 FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE TABLE public.fixture_identity (id text PRIMARY KEY);
INSERT INTO public.fixture_identity VALUES ('${f.id}');\n`);
  await save('init-identity.sql', `CREATE ROLE keycloak LOGIN PASSWORD '${f.keycloakPassword}' VALID UNTIL '${expiry}';
ALTER ROLE identity_owner VALID UNTIL '${expiry}';
ALTER DATABASE identity_fixture OWNER TO keycloak;
REVOKE ALL ON DATABASE identity_fixture, postgres, template1 FROM PUBLIC;
GRANT CONNECT ON DATABASE identity_fixture TO keycloak;
ALTER SCHEMA public OWNER TO keycloak;\n`);
  await save('keycloak.conf', `db=postgres
db-url=jdbc:postgresql://identity-db:5432/identity_fixture?sslmode=verify-full&sslrootcert=/fixture/db.crt
db-username=keycloak
db-password=${f.keycloakPassword}
hostname=https://keycloak:8443
http-enabled=false
https-certificate-file=/fixture/server.crt
https-certificate-key-file=/fixture/server.key
truststore-paths=/fixture/mail.crt
health-enabled=true
`);
  docker(['run', '--rm', '--network', 'none', '-v', `${resolve('work/pilot')}:/fixture`, '--entrypoint', 'sh', postgresImage,
    '-c', 'chown 1000:1000 /fixture/keycloak.conf; chown 999:999 /fixture/init-app.sql /fixture/init-identity.sql /fixture/owner-password /fixture/identity-password']);
  await mkdir('work/pilot/provider-state');
  return f;
}

async function ready(hostname: string, port: number, certificate: string, path: string): Promise<void> {
  const ca = await readFile(`work/pilot/${certificate}.crt`, 'utf8');
  for (let i = 0; i < 60; i++) {
    const ok = await new Promise<boolean>(done => {
      const request = get({ hostname, port, path, ca, rejectUnauthorized: true, timeout: 2000 }, response => {
        response.resume(); done(response.statusCode === 200);
      });
      request.on('error', () => done(false)); request.on('timeout', () => request.destroy());
    });
    if (ok) return;
    await setTimeout(1000);
  }
  throw new Error('Fixture HTTPS readiness failed');
}

async function main(): Promise<void> {
  const action = process.argv[2];
  if (action === 'check' && process.env.PILOT_CONTAINER === '1') {
    await ready('keycloak', 8443, 'keycloak', '/realms/pilot/.well-known/openid-configuration');
    await ready('mailbox', 8025, 'mailbox', '/api/v1/info');
    console.log('Identity and mailbox TLS readiness verified.');
    return;
  }
  if (!['up', 'down'].includes(action ?? '') || process.argv.length !== 3) throw new Error('Usage: pilot:up or pilot:down');
  let f: Fixture;
  try { f = await loadFixture(action === 'down'); }
  catch (error) {
    if (action !== 'up' || (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    f = await initialize();
  }
  if (action === 'down') {
    compose(f, ['down']);
    console.log('Isolated fixture stopped; database, mailbox and provider state retained.');
    return;
  }
  compose(f, ['up', '-d', '--wait', '--wait-timeout', '120']);
  console.log(await runIsolated(['dist/pilot/ops/local/stack.js', 'check']));
  console.log('Isolated fixture ready; no host ports or external runtime route.');
}
main().catch(async error => {
  console.error(error instanceof SyntaxError ? 'Invalid fixture manifest.' : safeDiagnostics(String(error)));
  try { console.error(safeDiagnostics(compose(await loadFixture(true), ['logs', '--no-color', '--tail', '15']))); }
  catch { console.error('Fixture service diagnostics unavailable.'); }
  process.exitCode = 1;
});
