import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer, request } from 'node:https';
import { createServer as createHttpServer } from 'node:http';
import { test } from 'node:test';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';
import { createCustomerApp } from '../../apps/web/src/server/customer.js';
import { tokenHash } from '../../apps/web/src/server/session.js';
import type { IdentityStatus } from '../../packages/contracts/pilot.js';

test('HTTPS customer boundary renders own context and protects switch/logout with CSRF', async () => {
  if (process.env.PILOT_CONTAINER !== '1') { console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/portal.test.js'])); return; }
  const db = await connectFixture(); const now = new Date();
  const status: IdentityStatus = { subject: randomUUID(), email: `${randomUUID()}@example.invalid`, generation: randomUUID(),
    verified: true, enabled: true, firstName: 'Invented', lastName: 'Customer', requiredActions: [], credentials: [] };
  const token = randomBytes(32).toString('hex'), csrf = randomBytes(32).toString('hex');
  let connections = 0, identityUnavailable = false;
  const app = createCustomerApp(async () => { connections++; return connectFixture(); }, async () => {
    if (identityUnavailable) throw new Error('Private provider canary');
    return status;
  });
  const ca = await readFile('work/pilot/customer.crt');
  const server = createServer({ cert: ca, key: await readFile('work/pilot/customer.key') }, app);
  const plaintext = createHttpServer(app);
  const listen = async (listener: typeof server | typeof plaintext) => { await new Promise<void>(r => listener.listen(0, '127.0.0.1', r)); const address = listener.address(); assert.ok(address && typeof address !== 'string'); return address.port; };
  const port = await listen(server), plainPort = await listen(plaintext);
  const send = async (path: string, method = 'GET', body?: Record<string, string>, cookie = `__Host-session=${token}; __Host-csrf=${csrf}`, origin = 'https://customer:8443') => new Promise<{ status: number; text: string; cookies: string[]; csp: string | undefined }>((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', servername: 'customer', port, path, method, ca, rejectUnauthorized: true,
      headers: { host: 'customer:8443', origin, cookie, 'content-type': 'application/x-www-form-urlencoded' } }, res => {
      let text = ''; res.setEncoding('utf8'); res.on('data', chunk => text += chunk); res.on('end', () => resolve({ status: res.statusCode!, text, cookies: res.headers['set-cookie'] ?? [], csp: res.headers['content-security-policy'] as string | undefined }));
    }); req.on('error', reject); if (body) req.write(new URLSearchParams(body).toString()); req.end();
  });
  try {
    const identity = (await db.query("INSERT INTO pilot.identities(subject,email,generation,verified,lifecycle) VALUES($1,$2,$3,true,'active') RETURNING id", [status.subject, status.email, status.generation])).rows[0].id;
    const tenant = (await db.query("INSERT INTO pilot.tenants(name) VALUES('Invented <script>window.canary=true</script>') RETURNING id")).rows[0].id;
    const membership = (await db.query("INSERT INTO pilot.memberships(tenant_id,identity_id,role) VALUES($1,$2,'Employee') RETURNING id", [tenant, identity])).rows[0].id;
    const foreign = (await db.query("INSERT INTO pilot.tenants(name) VALUES('Unrelated B canary') RETURNING id")).rows[0].id;
    await db.query(`INSERT INTO pilot.sessions(token_hash,csrf_hash,identity_id,identity_version,tenant_id,tenant_version,membership_id,membership_version,audience,created_at,last_seen_at,expires_at)
      VALUES($1,$2,$3,1,$4,1,$5,1,'customer',$6,$6,$7)`, [tokenHash(token), tokenHash(csrf), identity, tenant, membership, now, new Date(now.getTime() + 28_800_000)]);
    const page = await send('/customer'); assert.equal(page.status, 200); assert.match(page.text, /&lt;script&gt;/); assert.ok(!page.text.includes('<script>') && !page.text.includes('Unrelated B canary'));
    assert.match(page.text, /<main id="main"/); assert.match(page.csp!, /frame-ancestors 'none'/);
    assert.equal((await send('/customer', 'GET', undefined, '')).status, 403);
    assert.equal((await send('/customer', 'GET', undefined, `__Host-session=${token}; __Host-session=${token}; __Host-csrf=${csrf}`)).status, 403);
    identityUnavailable = true;
    const unavailable = await send('/customer'); assert.equal(unavailable.status, 503); assert.ok(!unavailable.text.includes('canary'));
    identityUnavailable = false;
    assert.equal((await send(`/customer?tenantId=${foreign}`)).text.includes('Unrelated B canary'), false);
    const before = Number((await db.query('SELECT count(*) AS n FROM pilot.sessions WHERE identity_id=$1', [identity])).rows[0].n);
    for (const [body, origin] of [[{ tenantId: tenant, csrf }, 'https://other.invalid'], [{ tenantId: tenant, csrf: randomBytes(32).toString('hex') }, 'https://customer:8443'], [{ tenantId: tenant, csrf, role: 'Manager' }, 'https://customer:8443'], [{ tenantId: foreign, csrf }, 'https://customer:8443']] as const) {
      assert.ok([400, 403].includes((await send('/customer/switch', 'POST', body, undefined, origin)).status));
    }
    assert.equal(Number((await db.query('SELECT count(*) AS n FROM pilot.sessions WHERE identity_id=$1', [identity])).rows[0].n), before);
    const switched = await send('/customer/switch', 'POST', { tenantId: tenant, csrf }); assert.equal(switched.status, 303); assert.equal(switched.cookies.length, 2);
    for (const cookie of switched.cookies) { assert.match(cookie, /Secure/); assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/); assert.match(cookie, /Path=\//); assert.ok(!cookie.includes('Domain=')); }
    assert.equal((await send('/customer')).status, 403);
    const rotatedCookie = switched.cookies.map(c => c.split(';')[0]).join('; ');
    const rotatedCsrf = switched.cookies.find(c => c.startsWith('__Host-csrf='))!.split(';')[0]!.slice('__Host-csrf='.length);
    assert.equal((await send('/customer', 'GET', undefined, rotatedCookie)).status, 200);
    assert.equal((await send('/customer/logout', 'POST', { csrf: rotatedCsrf }, rotatedCookie)).status, 303);
    assert.equal((await send('/customer', 'GET', undefined, rotatedCookie)).status, 403);
    const beforePlain = connections;
    const plain = await fetch(`http://127.0.0.1:${plainPort}/customer`, { headers: { cookie: rotatedCookie, 'x-forwarded-proto': 'https' } });
    assert.equal(plain.status, 400); assert.equal(connections, beforePlain);
  } finally { await new Promise<void>(r => server.close(() => r())); await new Promise<void>(r => plaintext.close(() => r())); await db.end(); }
});
