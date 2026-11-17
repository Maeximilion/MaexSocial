import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:https';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { createOidcVerifier } from '../../apps/web/src/server/oidc.js';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';

test('OIDC protocol and durable claims against controlled HTTPS, not real provider evidence', async t => {
  if (process.env.PILOT_CONTAINER !== '1') {
    console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/oidc.test.js'])); return;
  }
  const owner = await connectFixture(true);
  const ca = await readFile('work/pilot/customer.crt', 'utf8');
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' };
  const hash = (s: string) => createHash('sha256').update(s).digest('hex');
  const calls: string[] = [];
  const serverErrors: unknown[] = [];
  let expectedNonce = '', expectedChallenge = '', expectedState = '';
  let claimsChange: Record<string, unknown> = {}, headerChange: Record<string, unknown> = {};
  let badSignature = false;
  let tokenDelay = 0, keyDelay = 0, keyResponse: unknown, responseLimit = false;
  let respond: ((req: IncomingMessage, res: ServerResponse) => void) | undefined;
  const server = createServer({ cert: ca, key: await readFile('work/pilot/customer.key') }, async (req, res) => {
    try {
    calls.push(req.url!);
    if (respond) { req.resume(); respond(req, res); return; }
    if (req.url?.endsWith('/certs')) {
      if (keyDelay) await delay(keyDelay);
      assert.equal(req.method, 'GET'); assert.equal(req.headers.authorization, undefined);
      res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(keyResponse ?? { keys: [jwk] })); return;
    }
    if (tokenDelay) await delay(tokenDelay);
    assert.equal(req.method, 'POST');
    const basic = Buffer.from(req.headers.authorization!.slice(6), 'base64').toString().split(':').map(decodeURIComponent);
    assert.deepEqual(basic, ['pilot-oidc-test', 'synthetic-secret']);
    let body = ''; for await (const chunk of req) body += chunk;
    const form = new URLSearchParams(body);
    assert.equal(form.get('grant_type'), 'authorization_code');
    assert.equal(form.get('redirect_uri'), config.callback);
    assert.equal(form.get('code'), 'synthetic-code');
    assert.equal(createHash('sha256').update(form.get('code_verifier')!).digest('base64url'), expectedChallenge);
    assert.equal((await owner.query('SELECT count(*)::int AS n FROM pilot.oidc_attempts WHERE state_hash=$1', [hash(expectedState)])).rows[0].n, 0,
      'Consumption must be committed before the token endpoint is contacted');
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-key', ...headerChange })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ iss: config.issuer, sub: 'immutable-subject', aud: config.clientId,
      azp: config.clientId, iat: now, exp: now + 60, nonce: expectedNonce, ...claimsChange })).toString('base64url');
    const input = `${header}.${payload}`;
    const signature = badSignature ? randomBytes(256).toString('base64url') : sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url');
    res.setHeader('content-type', 'application/json');
    const json = JSON.stringify({ access_token: 'discard-access-canary', refresh_token: 'discard-refresh-canary', token_type: 'Bearer', id_token: `${input}.${signature}` });
    res.end(responseLimit ? json.padEnd(65536, ' ') : json);
    } catch (error) { serverErrors.push(error); res.destroy(); }
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const config = { issuer: `https://127.0.0.1:${address.port}/realms/pilot`, clientId: 'pilot-oidc-test',
    clientSecret: 'synthetic-secret', callback: 'https://customer:8443/oidc/callback', ca };
  const client = createOidcVerifier(config, connectFixture);
  const begin = async () => {
    const attempt = await client.start(); const url = new URL(attempt.authorizationUrl);
    expectedNonce = url.searchParams.get('nonce')!; expectedChallenge = url.searchParams.get('code_challenge')!;
    expectedState = url.searchParams.get('state')!;
    return { ...attempt, callback: `${config.callback}?state=${expectedState}&code=synthetic-code&iss=${encodeURIComponent(config.issuer)}` };
  };
  const denied = async (action: Promise<unknown>) => {
    await assert.rejects(action, error => error instanceof Error && error.message === 'OIDC unavailable' && error.cause === undefined);
  };
  try {
    await t.test('start persists hashed bindings, nonce and S256 across new verifier instances', async () => {
      const attempt = await begin(), url = new URL(attempt.authorizationUrl);
      assert.equal(url.origin + url.pathname, `${config.issuer}/protocol/openid-connect/auth`);
      assert.equal(url.searchParams.get('scope'), 'openid'); assert.equal(url.searchParams.get('response_type'), 'code');
      assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
      assert.equal(url.searchParams.get('redirect_uri'), config.callback);
      assert.match(expectedState, /^[a-f0-9]{64}$/); assert.match(expectedNonce, /^[a-f0-9]{64}$/);
      const row = (await owner.query('SELECT * FROM pilot.oidc_attempts WHERE state_hash=$1', [hash(expectedState)])).rows[0];
      assert.equal(row.browser_hash, hash(attempt.browserToken)); assert.equal(row.nonce, expectedNonce);
      assert.equal(row.expires_at - row.created_at, 300000);
      const fresh = createOidcVerifier(config, connectFixture);
      assert.deepEqual(await fresh.complete(attempt.callback, attempt.browserToken), { issuer: config.issuer, subject: 'immutable-subject' });
      assert.deepEqual(calls.splice(0), ['/realms/pilot/protocol/openid-connect/token', '/realms/pilot/protocol/openid-connect/certs']);
      await denied(client.complete(attempt.callback, attempt.browserToken)); assert.equal(calls.length, 0);
    });
    await t.test('wrong browser, state, config, duplicate parameters and callback do not steal a valid attempt', async () => {
      const a = await begin();
      await denied(client.complete(a.callback, randomBytes(32).toString('hex')));
      await denied(client.complete(a.callback.replace(expectedState, 'f'.repeat(64)), a.browserToken));
      await denied(client.complete(`${a.callback}&state=${expectedState}`, a.browserToken));
      await denied(client.complete(`${a.callback}&redirect_uri=https://attacker.invalid`, a.browserToken));
      await denied(client.complete(a.callback.replace('customer:8443', 'attacker.invalid'), a.browserToken));
      await denied(createOidcVerifier({ ...config, clientId: 'other-client' }, connectFixture).complete(a.callback, a.browserToken));
      assert.equal(calls.length, 0);
      assert.equal((await client.complete(a.callback, a.browserToken)).subject, 'immutable-subject'); calls.length = 0;
    });
    await t.test('parallel callbacks use separate real connections, exactly one exchanges and survives replay', async () => {
      const a = await begin();
      const results = await Promise.allSettled(Array.from({ length: 6 }, () => client.complete(a.callback, a.browserToken)));
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      assert.equal(calls.filter(p => p.endsWith('/token')).length, 1); calls.length = 0;
    });
    await t.test('signature, algorithm and identity claims fail closed with consumed attempts', async () => {
      const variants = [
        { iss: 'https://attacker.invalid' }, { aud: 'other-client' }, { aud: [config.clientId, 'other'], azp: undefined },
        { azp: 'other-client' }, { nonce: 'wrong' }, { exp: 1 }, { exp: undefined }, { exp: '9999999999' },
        { sub: '' }, { sub: undefined }, { sub: 1 }, { sub: 'x'.repeat(256) }, { iat: 'bad' }, { iat: undefined },
        { iat: Math.floor(Date.now() / 1000) + 600 }, { nbf: Math.floor(Date.now() / 1000) + 600 }
      ];
      for (const claims of variants) {
        claimsChange = claims; const a = await begin(); await denied(client.complete(a.callback, a.browserToken));
        const n = calls.length; await denied(client.complete(a.callback, a.browserToken)); assert.equal(calls.length, n);
      }
      claimsChange = {}; badSignature = true; let a = await begin(); await denied(client.complete(a.callback, a.browserToken));
      badSignature = false; headerChange = { alg: 'HS256' }; a = await begin(); await denied(client.complete(a.callback, a.browserToken));
      headerChange = {}; a = await begin(); assert.equal((await client.complete(a.callback, a.browserToken)).subject, 'immutable-subject'); calls.length = 0;
    });
    await t.test('expiry is rechecked after a real row-lock wait and cleanup physically deletes stale rows', async () => {
      const a = await begin();
      await owner.query("UPDATE pilot.oidc_attempts SET created_at=statement_timestamp()-interval '299 seconds', expires_at=statement_timestamp()+interval '250 milliseconds'");
      await owner.query('BEGIN'); await owner.query('SELECT slot FROM pilot.oidc_attempts FOR UPDATE');
      const result = denied(client.complete(a.callback, a.browserToken));
      await delay(350); await owner.query('COMMIT'); await result; assert.equal(calls.length, 0);
      const b = await begin();
      await owner.query("UPDATE pilot.oidc_attempts SET created_at=statement_timestamp()-interval '6 minutes', expires_at=statement_timestamp()-interval '1 minute'");
      await client.cleanup(); assert.equal((await owner.query('SELECT count(*)::int AS n FROM pilot.oidc_attempts')).rows[0].n, 0);
      await denied(client.complete(b.callback, b.browserToken));
    });
    await t.test('256 slots bound storage; expired capacity is reclaimed and app cannot extend expiry', async () => {
      await owner.query('DELETE FROM pilot.oidc_attempts');
      for (let i = 0; i < 255; i++) await client.start();
      const fill = await Promise.allSettled([client.start(), client.start()]);
      assert.equal(fill.filter(r => r.status === 'fulfilled').length, 1);
      await denied(client.start());
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM pilot.oidc_attempts')).rows[0].n, 256);
      const app = await connectFixture();
      try { await assert.rejects(app.query("UPDATE pilot.oidc_attempts SET expires_at=clock_timestamp()+interval '1 hour'"), { code: '42501' }); }
      finally { await app.end(); }
      await owner.query("UPDATE pilot.oidc_attempts SET created_at=statement_timestamp()-interval '6 minutes', expires_at=statement_timestamp()-interval '1 minute'");
      await begin(); assert.equal((await owner.query('SELECT count(*)::int AS n FROM pilot.oidc_attempts')).rows[0].n, 1);
      await owner.query('DELETE FROM pilot.oidc_attempts');
    });
    await t.test('fixed TLS/configuration and trusted JWKS are required; budget spans token plus keys', async () => {
      for (const change of [{ issuer: 'http://keycloak:8443/realms/pilot' }, { issuer: `${config.issuer}?url=attacker` },
        { callback: 'https://customer:8443/oidc/callback?return=https://attacker.invalid' }, { clientId: '' }, { ca: '' }]) {
        assert.throws(() => createOidcVerifier({ ...config, ...change }, connectFixture), { message: 'OIDC unavailable' });
      }
      let a = await begin();
      await denied(createOidcVerifier({ ...config, ca: await readFile('work/pilot/keycloak.crt', 'utf8') }, connectFixture).complete(a.callback, a.browserToken));
      for (const keys of [{ keys: [] }, { keys: [{ kty: 'RSA', kid: 'test-key', n: 'invalid', e: 'AQAB' }] },
        { keys: [jwk], padding: 'x'.repeat(65536) }]) {
        keyResponse = keys; a = await begin();
        await denied(createOidcVerifier(config, connectFixture).complete(a.callback, a.browserToken));
      }
      keyResponse = undefined; responseLimit = true; a = await begin();
      assert.equal((await createOidcVerifier(config, connectFixture).complete(a.callback, a.browserToken)).subject, 'immutable-subject');
      responseLimit = false; tokenDelay = 2700; keyDelay = 2700; a = await begin(); const before = Date.now();
      await denied(createOidcVerifier(config, connectFixture).complete(a.callback, a.browserToken));
      assert.ok(Date.now() - before < 6500); tokenDelay = 0; keyDelay = 0;
      await delay(500); calls.length = 0;
    });
    await t.test('provider errors, redirects, malformed/oversized/partial responses and deadlines never retry', async () => {
      const cases = [
        (_req: IncomingMessage, res: ServerResponse) => { res.writeHead(400, { 'content-type': 'application/json' }); res.end('{"error":"invalid_grant"}'); },
        (_req: IncomingMessage, res: ServerResponse) => { res.writeHead(302, { location: 'https://attacker.invalid' }); res.end(); },
        (_req: IncomingMessage, res: ServerResponse) => { res.setHeader('content-type', 'application/json'); res.end('{'); },
        (_req: IncomingMessage, res: ServerResponse) => { res.setHeader('content-type', 'text/html'); res.end('{}'); },
        (_req: IncomingMessage, res: ServerResponse) => { res.setHeader('content-type', 'application/json'); res.setHeader('content-encoding', 'gzip'); res.end('{}'); },
        (_req: IncomingMessage, res: ServerResponse) => { res.setHeader('content-type', 'application/json'); res.end(Buffer.from([0xff])); },
        (_req: IncomingMessage, res: ServerResponse) => { res.setHeader('content-type', 'application/json'); res.end('x'.repeat(65537)); },
        (_req: IncomingMessage, res: ServerResponse) => { res.setHeader('content-type', 'application/json'); res.setHeader('content-length', '100'); res.flushHeaders(); res.write('{'); res.destroy(); },
        (_req: IncomingMessage, res: ServerResponse) => { res.setHeader('content-type', 'application/json'); res.flushHeaders(); res.write('{'); }
      ];
      for (const handler of cases) {
        respond = handler; calls.length = 0; const a = await begin(); const before = Date.now();
        await denied(client.complete(a.callback, a.browserToken)); assert.ok(Date.now() - before < 6500);
        await denied(client.complete(a.callback, a.browserToken)); assert.equal(calls.length, 1);
      }
      respond = undefined; calls.length = 0;
      const a = await begin(); await denied(client.complete(a.callback.replace('code=synthetic-code', 'error=access_denied'), a.browserToken));
      await denied(client.complete(a.callback, a.browserToken)); assert.equal(calls.length, 0);
    });
    assert.deepEqual(serverErrors, [], 'Controlled provider assertions must also pass');
  } finally { await owner.query('ROLLBACK'); await owner.query('DELETE FROM pilot.oidc_attempts'); await owner.end(); server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); }
});
