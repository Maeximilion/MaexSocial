import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer, request } from 'node:https';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';
import { createCustomerApp } from '../../apps/web/src/server/customer.js';
import { tokenHash } from '../../apps/web/src/server/session.js';

const config = { issuer: 'https://keycloak:8443/realms/pilot', clientId: 'pilot-oidc-test',
  postLogoutRedirectUri: 'https://customer:8443/' };

test('private logout rejects untrusted destinations and clients before opening a connection', () => {
  const unused = async (): Promise<never> => { throw new Error('Must not connect'); };
  for (const changed of [
    { issuer: 'http://keycloak:8443/realms/pilot' }, { issuer: 'https://other.invalid/realms/pilot' },
    { issuer: 'https://keycloak:8443/realms/pilot?next=evil' }, { issuer: 'https://keycloak:8443/realms/pilot#fragment' },
    { issuer: 'https://user@keycloak:8443/realms/pilot' }, { clientId: 'other-client' },
    { postLogoutRedirectUri: 'https://customer:8443/customer' }, { postLogoutRedirectUri: 'https://other.invalid/' },
    { postLogoutRedirectUri: 'https://customer:8443/?success=true' }, { postLogoutRedirectUri: 'https://customer:8443/#x' }
  ]) {
    assert.throws(() => createCustomerApp(unused, unused, { ...config, ...changed }),
      { message: 'Invalid private logout configuration' });
  }
});

test('private logout commits revocation before redirect; rejects CSRF, input overrides and failed commits', async () => {
  if (process.env.PILOT_CONTAINER !== '1') { console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/logout.test.js'])); return; }
  const db = await connectFixture();
  const token = randomBytes(32).toString('hex'), csrf = randomBytes(32).toString('hex');
  const status = { subject: randomUUID(), verified: true, enabled: true, requiredActions: [], credentials: [] };
  let failCommit = false;
  const copied = { ...config };
  const app = createCustomerApp(async () => {
    const connection = await connectFixture();
    // Inject only a failed commit; all transaction/locking/revocation SQL still runs on PostgreSQL.
    return new Proxy(connection, { get(target, property) {
      if (property === 'query') return (sql: string, ...args: unknown[]) => {
        if (sql === 'COMMIT' && failCommit) throw new Error('Injected commit failure');
        return Reflect.apply(target.query, target, [sql, ...args]);
      };
      const value = Reflect.get(target, property); return typeof value === 'function' ? value.bind(target) : value;
    } });
  }, async () => status, copied);
  copied.issuer = 'https://other.invalid'; copied.clientId = 'other'; copied.postLogoutRedirectUri = 'https://other.invalid';
  const ca = await readFile('work/pilot/customer.crt');
  const server = createServer({ cert: ca, key: await readFile('work/pilot/customer.key') }, app);
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const send = (path: string, body?: Record<string, string>, origin = 'https://customer:8443', cookie = `__Host-session=${token}; __Host-csrf=${csrf}`) =>
    new Promise<{ status: number; location: string | undefined; cookies: string[]; text: string }>((resolve, reject) => {
      const req = request({ hostname: '127.0.0.1', servername: 'customer', port: address.port, path, ca,
        method: body ? 'POST' : 'GET', headers: { host: 'customer:8443', origin, cookie, 'content-type': 'application/x-www-form-urlencoded' } }, res => {
        let text = ''; res.setEncoding('utf8'); res.on('data', chunk => text += chunk);
        res.on('end', () => resolve({ status: res.statusCode!, location: res.headers.location, cookies: res.headers['set-cookie'] ?? [], text }));
      }); req.on('error', reject); req.end(body ? new URLSearchParams(body).toString() : undefined);
    });
  try {
    const identity = (await db.query('INSERT INTO pilot.identities(subject,verified) VALUES($1,true) RETURNING id', [status.subject])).rows[0].id;
    const tenant = (await db.query("INSERT INTO pilot.tenants(name) VALUES('Invented logout test') RETURNING id")).rows[0].id;
    const member = (await db.query("INSERT INTO pilot.memberships(tenant_id,identity_id,role) VALUES($1,$2,'Employee') RETURNING id", [tenant, identity])).rows[0].id;
    await db.query(`INSERT INTO pilot.sessions(token_hash,csrf_hash,identity_id,identity_version,tenant_id,tenant_version,membership_id,membership_version,audience,created_at,last_seen_at,expires_at)
      VALUES($1,$2,$3,1,$4,1,$5,1,'customer',now(),now(),now()+interval '1 hour')`, [tokenHash(token), tokenHash(csrf), identity, tenant, member]);
    assert.equal((await send('/customer')).status, 200);
    for (const [body, origin] of [[{ csrf }, 'https://other.invalid'], [{ csrf: randomBytes(32).toString('hex') }, 'https://customer:8443'],
      ...['issuer', 'client_id', 'post_logout_redirect_uri', 'id_token_hint', 'subject'].map(key => [{ csrf, [key]: 'untrusted' }, 'https://customer:8443'] as const)] as const) {
      const rejected = await send('/customer/logout', body, origin);
      assert.ok([400, 403].includes(rejected.status)); assert.equal(rejected.location, undefined); assert.deepEqual(rejected.cookies, []);
    }
    const wrong = randomBytes(32).toString('hex');
    assert.equal((await send('/customer/logout', { csrf: wrong }, undefined, `__Host-session=${token}; __Host-csrf=${wrong}`)).status, 403);
    failCommit = true;
    const failed = await send('/customer/logout', { csrf });
    assert.equal(failed.status, 503); assert.equal(failed.location, undefined); assert.deepEqual(failed.cookies, []);
    assert.equal((await db.query('SELECT revoked_at FROM pilot.sessions WHERE token_hash=$1', [tokenHash(token)])).rows[0].revoked_at, null);
    failCommit = false; assert.equal((await send('/customer')).status, 200);
    const loggedOut = await send('/customer/logout?client_id=evil&post_logout_redirect_uri=https://other.invalid', { csrf });
    assert.equal(loggedOut.status, 303);
    assert.equal(loggedOut.location, 'https://keycloak:8443/realms/pilot/protocol/openid-connect/logout?client_id=pilot-oidc-test&post_logout_redirect_uri=https%3A%2F%2Fcustomer%3A8443%2F');
    assert.equal(loggedOut.cookies.length, 2);
    for (const cookie of loggedOut.cookies) {
      assert.match(cookie, /^__Host-(session|csrf)=;/); assert.match(cookie, /Expires=Thu, 01 Jan 1970/);
      assert.match(cookie, /Secure/); assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/); assert.ok(!cookie.includes('Domain='));
    }
    assert.ok((await db.query('SELECT revoked_at FROM pilot.sessions WHERE token_hash=$1', [tokenHash(token)])).rows[0].revoked_at instanceof Date);
    assert.equal((await send('/customer')).status, 403, 'Replay denied without visiting the provider');
    const returned = await send('/?state=forged&success=true&code=forged&error=cancelled', undefined, undefined, '');
    assert.equal(returned.status, 200); assert.match(returned.text, /You are signed out/); assert.deepEqual(returned.cookies, []);
    assert.equal((await send('/customer')).status, 403);
  } finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); await db.end(); }
});
