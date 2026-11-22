import { randomBytes } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { get } from 'node:https';
import { resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { compose, docker, loadFixture, runIsolated, safeDiagnostics, type Fixture } from './fixture.js';

export const postgresImage = 'postgres:17.11-bookworm@sha256:665dc7b37ac52a17e298511414c21d23ffa4e6a6ef6225b3e5d59c7afb35e994';
const secret = () => randomBytes(32).toString('hex');

export async function initialize(purpose: 'ordinary' | 'backup' | 'restore-target' = 'ordinary'): Promise<Fixture> {
  const forBackup = purpose === 'backup';
  const restoreTarget = purpose === 'restore-target';
  await mkdir('work', { recursive: true });
  // Exclusive directory creation preserves existing credentials and database volumes on failure.
  await mkdir('work/pilot', { mode: 0o700 });
  const f: Fixture = { schema: 1, id: randomBytes(16).toString('hex'), project: '', expiresAt: Date.now() + 86_400_000,
    ownerPassword: secret(), appPassword: secret(), identityPassword: secret(), keycloakPassword: secret() };
  if (restoreTarget) f.restoreTarget = true;
  f.project = `maex-pilot-${f.id}`;
  const save = (name: string, value: string) => writeFile(`work/pilot/${name}`, value, { mode: 0o600, flag: 'wx' });
  const expiry = new Date(f.expiresAt).toISOString();
  await save('fixture.json', JSON.stringify(f));
  await save('throttle-key', secret());
  const statusSecret = secret(), deniedSecret = secret();
  await save('status-secret', statusSecret);
  await save('status-denied-secret', deniedSecret);
  const realm = JSON.parse(await readFile('ops/local/keycloak-realm.json', 'utf8'));
  for (const [clientId, clientSecret] of [['pilot-status', statusSecret], ['pilot-status-denied', deniedSecret]]) {
    realm.clients.push({ clientId, secret: clientSecret, enabled: true, publicClient: false,
      clientAuthenticatorType: 'client-secret', serviceAccountsEnabled: true, standardFlowEnabled: false,
      directAccessGrantsEnabled: false, fullScopeAllowed: false, defaultClientScopes: ['roles', 'kc-admin-api'],
      redirectUris: [], webOrigins: [] });
  }
  realm.clientScopeMappings = { 'realm-management': [{ client: 'pilot-status', roles: ['view-users'] }] };
  realm.users = [
    { username: 'service-account-pilot-status', enabled: true, serviceAccountClientId: 'pilot-status',
      clientRoles: { 'realm-management': ['view-users'] } },
    { username: 'service-account-pilot-status-denied', enabled: true, serviceAccountClientId: 'pilot-status-denied' },
    { id: '13600000-0000-4000-8000-000000000001', username: 'status-enabled', enabled: true,
      email: 'status-enabled@example.invalid', emailVerified: true, requiredActions: [] },
    { id: '13600000-0000-4000-8000-000000000002', username: 'status-disabled', enabled: false,
      email: 'status-disabled@example.invalid', emailVerified: true, requiredActions: [] }
  ];
  if (forBackup) realm.users.push({ username: `cold-backup-${f.id}`, enabled: false });
  // Only the first import of a fresh isolated fixture creates these test credentials.
  const oidcSecret = secret(), oidcPassword = secret();
  await save('oidc-secret', oidcSecret); await save('oidc-password', oidcPassword);
  realm.clients.push({ clientId: 'pilot-oidc-test', secret: oidcSecret, enabled: true, publicClient: false,
    clientAuthenticatorType: 'client-secret', standardFlowEnabled: true, serviceAccountsEnabled: false,
    directAccessGrantsEnabled: false, implicitFlowEnabled: false, fullScopeAllowed: false,
    defaultClientScopes: [], optionalClientScopes: [],
    attributes: { 'pkce.code.challenge.method': 'S256', 'id.token.signed.response.alg': 'RS256', 'use.refresh.tokens': 'false',
      'post.logout.redirect.uris': 'https://customer:8443/' },
    redirectUris: ['https://customer:8443/oidc/callback'], webOrigins: [] });
  realm.users.push({ id: '13900000-0000-4000-8000-000000000001', username: 'oidc-user', enabled: true,
    email: 'oidc-user@example.invalid', emailVerified: true, firstName: 'Invented', lastName: 'User', requiredActions: [],
    credentials: [{ type: 'password', value: oidcPassword, temporary: false }] });
  Object.assign(realm, JSON.parse(await readFile('ops/local/keycloak-step-up.json', 'utf8')));
  const stepSecret = secret(), stepPassword = secret(), stepOtp = secret();
  await save('step-up-secret', stepSecret); await save('step-up-password', stepPassword); await save('step-up-otp', stepOtp);
  realm.clients.push({ clientId: 'pilot-step-up-test', secret: stepSecret, enabled: true, publicClient: false,
    clientAuthenticatorType: 'client-secret', standardFlowEnabled: true, serviceAccountsEnabled: false,
    directAccessGrantsEnabled: false, implicitFlowEnabled: false, fullScopeAllowed: false,
    defaultClientScopes: [], optionalClientScopes: [],
    attributes: { 'pkce.code.challenge.method': 'S256', 'id.token.signed.response.alg': 'RS256', 'use.refresh.tokens': 'false' },
    authenticationFlowBindingOverrides: { browser: '14300000-0000-4000-8000-000000000010' },
    protocolMappers: [{ name: 'acr', protocol: 'openid-connect', protocolMapper: 'oidc-acr-mapper', config: { 'id.token.claim': 'true' } }],
    redirectUris: ['https://customer:8443/oidc/callback'], webOrigins: [] });
  for (const [suffix, username, enrolled] of [['1', 'step-up-enrolled', true], ['2', 'step-up-unenrolled', false]] as const) {
    realm.users.push({ id: `14300000-0000-4000-8000-00000000000${suffix}`, username, enabled: true,
      email: `${username}@example.invalid`, emailVerified: true, firstName: 'Invented', lastName: 'Factor', requiredActions: [],
      credentials: [{ type: 'password', value: stepPassword, temporary: false }, ...(enrolled ? [{ type: 'otp',
        secretData: JSON.stringify({ value: stepOtp }),
        credentialData: JSON.stringify({ subType: 'totp', digits: 6, counter: 0, period: 30, algorithm: 'HmacSHA1' }) }] : [])] });
  }
  await save('keycloak-realm.json', JSON.stringify(realm));
  await save('owner-password', f.ownerPassword);
  await save('identity-password', f.identityPassword);
  await save('compose.env', `FIXTURE_ID=${f.id}\nFIXTURE_UID=${process.getuid?.() ?? 0}\nFIXTURE_GID=${process.getgid?.() ?? 0}\n`);
  if (!forBackup) docker(['pull', postgresImage]);
  const runLocal = ['run', '--rm', '--network', 'none', ...(forBackup ? ['--pull', 'never'] : [])];
  for (const name of ['postgres', 'identity-db', 'keycloak', 'mailbox', 'customer']) {
    docker([...runLocal, '-v', `${resolve('work/pilot')}:/fixture`, '--entrypoint', 'openssl', postgresImage,
      'req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-subj', `/CN=${name}`,
      '-addext', `subjectAltName=DNS:${name},DNS:localhost,IP:127.0.0.1`,
      '-keyout', `/fixture/${name}.key`, '-out', `/fixture/${name}.crt`]);
  }
  docker([...runLocal, '-v', `${resolve('work/pilot')}:/fixture`, '--entrypoint', 'chown',
    postgresImage, '1000:1000', '/fixture/keycloak.key']);
  docker([...runLocal, '-v', `${resolve('work/pilot')}:/fixture`, '--entrypoint', 'chown',
    postgresImage, `${process.getuid?.() ?? 0}:${process.getgid?.() ?? 0}`, '/fixture/customer.key']);
  // Only generated hex values enter bootstrap SQL. No supplied SQL or connection URI is accepted.
  const appRole = restoreTarget ? 'NOLOGIN' : `LOGIN PASSWORD '${f.appPassword}' VALID UNTIL '${expiry}'`;
  await save('init-app.sql', `CREATE ROLE pilot_app ${appRole};
ALTER ROLE pilot_owner VALID UNTIL '${expiry}';
REVOKE ALL ON DATABASE pilot_fixture FROM PUBLIC;
${restoreTarget ? '' : 'GRANT CONNECT ON DATABASE pilot_fixture TO pilot_app;'}
REVOKE ALL ON DATABASE postgres, template1 FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE TABLE public.fixture_identity (id text PRIMARY KEY, restore_target boolean NOT NULL);
INSERT INTO public.fixture_identity VALUES ('${f.id}', ${restoreTarget});\n`);
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
  docker([...runLocal, '-v', `${resolve('work/pilot')}:/fixture`, '--entrypoint', 'sh', postgresImage,
    '-c', 'chown 1000:1000 /fixture/keycloak.conf /fixture/keycloak-realm.json; chown 999:999 /fixture/init-app.sql /fixture/init-identity.sql /fixture/owner-password /fixture/identity-password']);
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
  const restoreTarget = action === 'up' && process.argv.length === 4 && process.argv[3] === 'restore-target';
  if (!restoreTarget && (process.argv.length !== 3 || (action !== 'up' && action !== 'down'))) {
    throw new Error('Usage: pilot:up [-- restore-target] or pilot:down');
  }
  let f: Fixture;
  try { f = await loadFixture(action === 'down'); }
  catch (error) {
    if (action !== 'up' || (error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    f = await initialize(restoreTarget ? 'restore-target' : 'ordinary');
  }
  if (action === 'down') {
    compose(f, ['down']);
    console.log('Isolated fixture stopped; database, mailbox and provider state retained.');
    return;
  }
  if ((f.restoreTarget === true) !== restoreTarget) throw new Error('Existing fixture has a different purpose.');
  try {
    if (!(await stat('work/pilot/keycloak-realm.json')).isFile()) throw new Error('Not a file');
  } catch {
    console.error('Fixture realm import file is missing or invalid. Preserve the old work/pilot directory and volumes, then initialize a fresh fixture.');
    process.exitCode = 1;
    return;
  }
  compose(f, ['up', '-d', '--wait', '--wait-timeout', '120']);
  console.log(await runIsolated(['dist/pilot/ops/local/stack.js', 'check']));
  console.log(restoreTarget ? 'Restore fixture services ready; use pilot:restore-quarantine to verify the target.'
    : 'Isolated fixture ready; no host ports or external runtime route.');
}
if (require.main === module) main().catch(async error => {
  console.error(error instanceof SyntaxError ? 'Invalid fixture manifest.' : safeDiagnostics(String(error)));
  try { console.error(safeDiagnostics(compose(await loadFixture(true), ['logs', '--no-color', '--tail', '15']))); }
  catch { console.error('Fixture service diagnostics unavailable.'); }
  process.exitCode = 1;
});
