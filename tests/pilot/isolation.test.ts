import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { get } from 'node:https';
import { test } from 'node:test';
import { Client } from 'pg';
import { databaseConfig, loadFixture, runIsolated } from '../../ops/local/fixture.js';

test('isolated services require TLS and the app role cannot access identity storage', async () => {
  const f = await loadFixture();
  if (process.env.PILOT_CONTAINER !== '1') {
    console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/isolation.test.js']));
    return;
  }
  const appConfig = await databaseConfig(f);
  const app = new Client(appConfig);
  await app.connect();
  try {
    assert.equal((await app.query('SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()')).rows[0].ssl, true);
    const role = (await app.query('SELECT rolsuper,rolcreatedb,rolcreaterole,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0];
    assert.deepEqual(Object.values(role), [false, false, false, false]);
    await assert.rejects(app.query('CREATE ROLE forbidden'), { code: '42501' });
  } finally { await app.end(); }
  const plain = new Client({ ...appConfig, ssl: false });
  try { await assert.rejects(plain.connect(), { code: '28000' }); } finally { await plain.end(); }
  const identityConfig = { ...appConfig, host: 'identity-db', database: 'identity_fixture',
    ssl: { ca: await readFile('work/pilot/identity-db.crt', 'utf8'), rejectUnauthorized: true } };
  const forbidden = new Client(identityConfig);
  try { await assert.rejects(forbidden.connect(), { code: '28P01' }); } finally { await forbidden.end(); }
  const allowed = new Client({ ...identityConfig, user: 'keycloak', password: f.keycloakPassword });
  await allowed.connect();
  try { assert.equal((await allowed.query('SELECT current_database() AS db')).rows[0].db, 'identity_fixture'); }
  finally { await allowed.end(); }
  for (const [host, port, path] of [['keycloak', 8443, '/realms/pilot/.well-known/openid-configuration'], ['mailbox', 8025, '/api/v1/info']] as const) {
    const ca = await readFile(`work/pilot/${host}.crt`, 'utf8');
    const body = await new Promise<string>((ok, fail) => {
      const request = get({ hostname: host, port, path, ca, rejectUnauthorized: true, timeout: 3000 }, response => {
        let data = ''; response.on('data', chunk => { data += chunk; });
        response.on('end', () => response.statusCode === 200 ? ok(data) : fail(new Error('HTTPS status')));
      });
      request.on('error', fail); request.on('timeout', () => request.destroy(new Error('HTTPS timeout')));
    });
    assert.doesNotThrow(() => JSON.parse(body));
    if (host === 'keycloak') assert.equal(JSON.parse(body).issuer, 'https://keycloak:8443/realms/pilot');
  }
  console.log('Internal-only topology, PostgreSQL TLS, identity-role denial/positive control and identity/mailbox HTTPS verified.');
});
