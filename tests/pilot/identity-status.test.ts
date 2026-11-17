import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { subscribe, unsubscribe } from 'node:diagnostics_channel';
import { readFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'node:https';
import { performance } from 'node:perf_hooks';
import { test } from 'node:test';
import { createIdentityInspector } from '../../apps/web/src/server/identity.js';
import { requireCustomer, requireManagerMfa, tokenHash } from '../../apps/web/src/server/session.js';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';
import type { InspectIdentity } from '../../packages/contracts/pilot.js';

const subject = '13600000-0000-4000-8000-000000000001';
const disabledSubject = '13600000-0000-4000-8000-000000000002';
const failure = { message: 'Identity status unavailable' };

async function guard(inspect: InspectIdentity, id = subject) {
  const db = await connectFixture(), now = new Date();
  const token = randomBytes(32).toString('hex');
  try {
    await db.query('BEGIN');
    const identity = (await db.query('INSERT INTO pilot.identities(subject,verified) VALUES($1,true) RETURNING id', [id])).rows[0].id;
    const tenant = (await db.query("INSERT INTO pilot.tenants(name) VALUES('Status test') RETURNING id")).rows[0].id;
    const membership = (await db.query("INSERT INTO pilot.memberships(tenant_id,identity_id,role) VALUES($1,$2,'Manager') RETURNING id", [tenant, identity])).rows[0].id;
    await db.query(`INSERT INTO pilot.sessions(token_hash,csrf_hash,identity_id,identity_version,tenant_id,tenant_version,
      membership_id,membership_version,audience,created_at,last_seen_at,expires_at)
      VALUES($1,$1,$2,1,$3,1,$4,1,'customer',$5,$5,$6)`, [tokenHash(token), identity, tenant, membership, now, new Date(now.getTime() + 28_800_000)]);
    return await requireCustomer(db, token, () => new Date(), inspect);
  } finally { await db.query('ROLLBACK'); await db.end(); }
}

test('bounded status adapter: controlled HTTPS responses and real local provider are distinct evidence', async t => {
  if (process.env.PILOT_CONTAINER !== '1') {
    console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/identity-status.test.js'])); return;
  }
  const ca = await readFile('work/pilot/keycloak.crt', 'utf8');
  const config = { issuer: 'https://keycloak:8443/realms/pilot', ca, clientId: 'pilot-status',
    clientSecret: await readFile('work/pilot/status-secret', 'utf8') };
  const live = createIdentityInspector(config);
  await t.test('real Keycloak 26.8.2 view-users read, disabled user and roleless denial at the existing guard', async () => {
    assert.deepEqual(await live(subject), { subject, enabled: true, verified: true, requiredActions: [], credentials: [] });
    const context = await guard(live);
    assert.equal(context.subject, subject); assert.equal(context.mfaEnrolled, false); assert.equal(context.mfaAt, null);
    assert.throws(() => requireManagerMfa(context, () => new Date()), /Denied/);
    assert.equal((await live(disabledSubject)).enabled, false);
    await assert.rejects(guard(live, disabledSubject), /Denied/);
    const denied = createIdentityInspector({ ...config, clientId: 'pilot-status-denied',
      clientSecret: await readFile('work/pilot/status-denied-secret', 'utf8') });
    const statuses: (number | undefined)[] = [];
    const observe = (message: unknown) => { statuses.push((message as { response: IncomingMessage }).response.statusCode); };
    subscribe('http.client.response.finish', observe);
    try { await assert.rejects(guard(denied), failure); }
    finally { unsubscribe('http.client.response.finish', observe); }
    assert.deepEqual(statuses, [200, 403], 'The roleless client authenticates, then user viewing is forbidden');
    await assert.rejects(live('13600000-0000-4000-8000-000000000099'), failure);
    assert.equal((await guard(live)).subject, subject);
  });

  const paths: string[] = [];
  const token = { access_token: 'synthetic-token-canary', token_type: 'Bearer', expires_in: 60 };
  const user = { id: subject, enabled: true, emailVerified: true, requiredActions: [], email: 'discard@example.invalid' };
  const credentials = [{ id: 'synthetic-factor', type: 'otp', credentialData: 'discard-credential-canary', secretData: 'discard-secret-canary' }];
  const bodies: unknown[] = [token, user, credentials];
  let respond: (req: IncomingMessage, res: ServerResponse, step: number) => void;
  const fakeCa = await readFile('work/pilot/customer.crt', 'utf8');
  const server = createServer({ cert: fakeCa, key: await readFile('work/pilot/customer.key') }, (req, res) => {
    paths.push(req.url!); req.resume(); respond(req, res, paths.length - 1);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const local = { ...config, ca: fakeCa, issuer: `https://127.0.0.1:${address.port}/realms/pilot`, clientSecret: 'synthetic-secret-canary' };
  const inspect = createIdentityInspector(local);
  const normal = (_req: IncomingMessage, res: ServerResponse, step: number) => {
    res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(bodies[step]));
  };
  const reset = () => { paths.length = 0; bodies.splice(0, 3, token, user, credentials); respond = normal; };
  try {
    await t.test('minimal projection, exact routes, no token cache and no enrollment-to-MFA conversion', async () => {
      reset();
      respond = (req, res, step) => {
        assert.equal(req.method, step === 0 ? 'POST' : 'GET');
        assert.equal(req.headers.authorization, step === 0
          ? `Basic ${Buffer.from('pilot-status:synthetic-secret-canary').toString('base64')}` : `Bearer ${token.access_token}`);
        normal(req, res, step);
      };
      assert.deepEqual(await inspect(subject), { subject, enabled: true, verified: true, requiredActions: [],
        credentials: [{ id: 'synthetic-factor', type: 'otp' }] });
      assert.deepEqual(paths, ['/realms/pilot/protocol/openid-connect/token', `/admin/realms/pilot/users/${subject}`, `/admin/realms/pilot/users/${subject}/credentials`]);
      reset(); const context = await guard(inspect);
      assert.equal(context.mfaEnrolled, false); assert.equal(context.mfaAt, null);
      assert.throws(() => requireManagerMfa(context, () => new Date()), /Denied/);
    });
    await t.test('subject, mandatory types, list bounds and duplicate credential IDs fail closed', async () => {
      const invalid: [number, unknown][] = [
        [0, { ...token, access_token: '' }], [0, { ...token, token_type: 'MAC' }], [0, { ...token, expires_in: 0 }],
        [0, { ...token, access_token: 'x'.repeat(16385) }], [0, { ...token, expires_in: '60' }],
        [1, { ...user, id: disabledSubject }], [1, { ...user, id: undefined }],
        [1, { ...user, enabled: 'true' }], [1, { ...user, enabled: undefined }],
        [1, { ...user, emailVerified: undefined }], [1, { ...user, emailVerified: 1 }],
        [1, { ...user, requiredActions: undefined }], [1, { ...user, requiredActions: null }],
        [1, { ...user, requiredActions: [1] }], [1, { ...user, requiredActions: ['x'.repeat(129)] }],
        [1, { ...user, requiredActions: Array(33).fill('UPDATE_PASSWORD') }],
        [2, {}], [2, [null]], [2, [{ type: 'otp' }]], [2, [{ id: 'factor' }]],
        [2, [{ id: 'x'.repeat(256), type: 'otp' }]], [2, [{ id: 'factor', type: 1 }]],
        [2, [{ id: 'factor', type: 'x'.repeat(129) }]], [2, [credentials[0], credentials[0]]],
        [2, Array.from({ length: 33 }, (_, i) => ({ id: `factor-${i}`, type: 'otp' }))]
      ];
      for (const [step, value] of invalid) {
        reset(); bodies[step] = value; await assert.rejects(inspect(subject), failure);
        assert.equal(paths.length, step + 1, 'No request follows malformed partial authority');
      }
      for (const id of ['', '..', 'x/y', 'x?y', 'x'.repeat(256)]) {
        reset(); await assert.rejects(inspect(id), failure); assert.equal(paths.length, 0);
      }
      for (const patch of [{ issuer: 'http://localhost/realms/pilot' }, { issuer: `${local.issuer}?url=elsewhere` },
        { issuer: 'https://localhost/realms/other' }, { issuer: 'https://user:pass@localhost/realms/pilot' }]) {
        assert.throws(() => createIdentityInspector({ ...local, ...patch }), failure);
      }
    });
    await t.test('disabled, unverified and outstanding actions are denied by A1, including unfamiliar actions', async () => {
      for (const patch of [{ enabled: false }, { emailVerified: false }, { requiredActions: ['UNFAMILIAR_ACTION'] }]) {
        reset(); bodies[1] = { ...user, ...patch }; await assert.rejects(guard(inspect), /Denied/);
      }
    });
    await t.test('HTTP denial, redirect, malformed, oversize and partial failures disclose no provider body', async () => {
      for (const step of [0, 1, 2]) {
        for (const mode of ['401', '403', '404', '429', '500', '302', 'json', 'utf8', 'type', 'size', 'chunked', 'partial', 'encoding']) {
          reset();
          respond = (req, res, index) => {
            if (index !== step) { normal(req, res, index); return; }
            res.setHeader('content-type', mode === 'type' ? 'text/html' : 'application/json');
            if (/^\d+$/.test(mode)) { res.writeHead(Number(mode), { location: '/unexpected-redirect' }); res.end('private-provider-canary'); }
            else if (mode === 'size') { res.setHeader('content-length', '65537'); res.end(); }
            else if (mode === 'chunked') { res.write(' '.repeat(32768)); res.end(' '.repeat(32769)); }
            else if (mode === 'partial') { res.setHeader('content-length', '100'); res.flushHeaders(); res.write('{'); res.destroy(); }
            else if (mode === 'utf8') res.end(Buffer.from([0xff]));
            else if (mode === 'encoding') { res.setHeader('content-encoding', 'gzip'); res.end('{}'); }
            else res.end('private-provider-canary');
          };
          await assert.rejects(inspect(subject), failure); assert.equal(paths.length, step + 1, 'No retry or redirect');
        }
      }
      reset(); bodies[2] = null; await assert.rejects(guard(inspect), failure);
      reset(); assert.equal((await guard(inspect)).subject, subject);
    });
    await t.test('exact response/list limits succeed; TLS must validate; shared deadline closes a trickling body', async () => {
      reset(); bodies[2] = Array.from({ length: 32 }, (_, i) => ({ id: `factor-${i}`, type: 'otp' }));
      respond = (req, res, step) => {
        if (step !== 1) { normal(req, res, step); return; }
        const json = JSON.stringify(user); res.setHeader('content-type', 'application/json');
        res.end(json + ' '.repeat(65536 - Buffer.byteLength(json)));
      };
      assert.equal((await inspect(subject)).credentials.length, 32);
      await assert.rejects(createIdentityInspector({ ...local, ca: await readFile('work/pilot/mailbox.crt', 'utf8') })(subject), failure);
      reset(); let closed!: () => void;
      const connectionClosed = new Promise<void>(resolve => { closed = resolve; });
      respond = (req, res, step) => {
        const timer = setTimeout(() => {
          if (step < 2) { normal(req, res, step); return; }
          res.setHeader('content-type', 'application/json'); res.write('[');
          const trickle = setInterval(() => res.write(' '), 100);
          res.on('close', () => clearInterval(trickle));
        }, step < 2 ? 1700 : 0);
        res.on('close', () => { clearTimeout(timer); if (step === 2) closed(); });
      };
      const start = performance.now(); await assert.rejects(inspect(subject), failure);
      assert.ok(performance.now() - start < 6500, 'The budget is shared across all requests');
      assert.equal(paths.length, 3); await connectionClosed;
    });
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
