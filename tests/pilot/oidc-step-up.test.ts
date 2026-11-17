import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOidcVerifier } from '../../apps/web/src/server/oidc.js';
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:https';
import { setTimeout as delay } from 'node:timers/promises';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';

test('step-up rejects an unknown policy before creating an attempt', () => {
  const config = { issuer: 'https://keycloak:8443/realms/pilot', clientId: 'pilot-step-up-test',
    clientSecret: 'synthetic-secret', callback: 'https://customer:8443/oidc/callback', ca: 'synthetic-ca',
    stepUp: { expectedSubject: 'invented-user', policy: 'untrusted-policy' } };
  assert.throws(() => createOidcVerifier(config, async () => { throw new Error('Must not connect'); }),
    { message: 'OIDC unavailable' });
});

test('private step-up evidence binds identity, policy and freshness with real SQL and controlled HTTPS', async t => {
  if (process.env.PILOT_CONTAINER !== '1') {
    console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/oidc-step-up.test.js'])); return;
  }
  const owner = await connectFixture(true), ca = await readFile('work/pilot/customer.crt', 'utf8');
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'step-key', alg: 'RS256', use: 'sig' };
  const hash = (s: string) => createHash('sha256').update(s).digest('hex');
  let state = '', nonce = '', challenge = '', exchanges = 0, keyDelay = 0, badSignature = false;
  let changes: Record<string, unknown> = {};
  const serverErrors: unknown[] = [];
  const server = createServer({ cert: ca, key: await readFile('work/pilot/customer.key') }, async (req, res) => {
    try {
      res.setHeader('content-type', 'application/json');
      if (req.url?.endsWith('/certs')) { await delay(keyDelay); res.end(JSON.stringify({ keys: [jwk] })); return; }
      exchanges++;
      assert.equal(req.method, 'POST');
      let body = ''; for await (const chunk of req) body += chunk;
      const form = new URLSearchParams(body);
      assert.equal(createHash('sha256').update(form.get('code_verifier')!).digest('base64url'), challenge);
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM pilot.oidc_attempts WHERE state_hash=$1', [hash(state)])).rows[0].n, 0);
      const now = Math.floor(Date.now() / 1000);
      const payload = { iss: config.issuer, sub: 'enrolled-subject', aud: config.clientId, azp: config.clientId,
        nonce, iat: now, exp: now + 60, acr: '2', ...changes };
      const input = `${Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'step-key' })).toString('base64url')}.${Buffer.from(JSON.stringify(payload)).toString('base64url')}`;
      const signature = badSignature ? randomBytes(256) : sign('RSA-SHA256', Buffer.from(input), privateKey);
      res.end(JSON.stringify({ access_token: 'discarded', token_type: 'Bearer', id_token: `${input}.${signature.toString('base64url')}` }));
    } catch (error) { serverErrors.push(error); res.destroy(); }
  });
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const config = { issuer: `https://127.0.0.1:${address.port}/realms/pilot`, clientId: 'pilot-step-up-test',
    clientSecret: 'synthetic-secret', callback: 'https://customer:8443/oidc/callback', ca,
    stepUp: { expectedSubject: 'enrolled-subject', policy: 'keycloak-26.8.2-enrolled-otp-v1' } };
  const client = createOidcVerifier(config, connectFixture);
  const begin = async (verifier = client) => {
    const a = await verifier.start(), url = new URL(a.authorizationUrl);
    state = url.searchParams.get('state')!; nonce = url.searchParams.get('nonce')!; challenge = url.searchParams.get('code_challenge')!;
    return { ...a, url, callback: `${config.callback}?state=${state}&code=synthetic-code&iss=${encodeURIComponent(config.issuer)}` };
  };
  const denied = (p: Promise<unknown>) => assert.rejects(p, { message: 'OIDC unavailable' });
  try {
    await t.test('receipt keeps original DB expiry and forces exact essential ACR', async () => {
      const a = await begin();
      assert.deepEqual(JSON.parse(a.url.searchParams.get('claims')!), { id_token: { acr: { essential: true, values: ['2'] } } });
      assert.equal(a.url.searchParams.has('prompt'), false);
      const row = (await owner.query('SELECT created_at,expires_at FROM pilot.oidc_attempts WHERE state_hash=$1', [hash(state)])).rows[0];
      const receipt = await createOidcVerifier(config, connectFixture).complete(a.callback, a.browserToken);
      assert.ok('validUntil' in receipt);
      assert.deepEqual(Object.keys(receipt).sort(), ['acr', 'clientId', 'factorTimeLowerBound', 'issuer', 'policy', 'subject', 'validUntil', 'verifiedAt']);
      assert.equal(receipt.acr, '2'); assert.equal(receipt.subject, 'enrolled-subject'); assert.equal(receipt.clientId, config.clientId);
      assert.equal(receipt.policy, config.stepUp.policy); assert.equal(receipt.issuer, config.issuer);
      assert.deepEqual(receipt.factorTimeLowerBound, row.created_at); assert.deepEqual(receipt.validUntil, row.expires_at);
      assert.ok(receipt.verifiedAt >= receipt.factorTimeLowerBound && receipt.verifiedAt < receipt.validUntil);
      const before = exchanges; await denied(client.complete(a.callback, a.browserToken)); assert.equal(exchanges, before);
    });
    await t.test('ordinary, different subject/client/policy and browser cannot consume a step-up attempt', async () => {
      const { stepUp: _stepUp, ...ordinaryConfig } = config;
      const ordinary = createOidcVerifier(ordinaryConfig, connectFixture);
      const a = await begin(), before = exchanges;
      await denied(ordinary.complete(a.callback, a.browserToken));
      await denied(createOidcVerifier({ ...config, clientId: 'other-client' }, connectFixture).complete(a.callback, a.browserToken));
      await denied(createOidcVerifier({ ...config, stepUp: { ...config.stepUp, expectedSubject: 'other-subject' } }, connectFixture).complete(a.callback, a.browserToken));
      await denied(client.complete(a.callback, randomBytes(32).toString('hex')));
      assert.throws(() => createOidcVerifier({ ...config, stepUp: { ...config.stepUp, policy: 'other-policy' } }, connectFixture), { message: 'OIDC unavailable' });
      assert.equal(exchanges, before); assert.ok('validUntil' in await client.complete(a.callback, a.browserToken));
      const b = await begin(ordinary); await denied(client.complete(b.callback, b.browserToken));
      assert.deepEqual(await ordinary.complete(b.callback, b.browserToken), { issuer: config.issuer, subject: 'enrolled-subject' });
    });
    await t.test('copied configuration cannot change an in-flight identity or policy', async () => {
      const mutable = { ...config, stepUp: { ...config.stepUp } }, verifier = createOidcVerifier(mutable, connectFixture);
      const a = await begin(verifier); mutable.stepUp.expectedSubject = 'other'; mutable.stepUp.policy = 'other'; mutable.clientId = 'other';
      assert.ok('validUntil' in await verifier.complete(a.callback, a.browserToken));
    });
    await t.test('signed claim mismatches and invalid signature never produce evidence', async () => {
      for (const change of [{ acr: undefined }, { acr: '1' }, { acr: 2 }, { acr: ['2'] }, { sub: 'other-subject' },
        { iss: 'https://other.invalid' }, { aud: 'other-client' }, { azp: 'other-client' }, { nonce: 'other-nonce' }, { exp: 1 }]) {
        changes = change; const a = await begin(); await denied(client.complete(a.callback, a.browserToken));
      }
      changes = {}; badSignature = true; const a = await begin(); await denied(client.complete(a.callback, a.browserToken)); badSignature = false;
    });
    await t.test('expiry during key/signature work fails after an already-committed claim', async () => {
      const a = await begin();
      await owner.query("UPDATE pilot.oidc_attempts SET created_at=clock_timestamp()-interval '299 seconds',expires_at=clock_timestamp()+interval '250 milliseconds'");
      keyDelay = 400;
      await denied(createOidcVerifier(config, connectFixture).complete(a.callback, a.browserToken)); keyDelay = 0;
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM pilot.oidc_attempts WHERE state_hash=$1', [hash(state)])).rows[0].n, 0);
    });
    await t.test('post-lock expiry, stale attempts and cancellation stay consumed or expired', async () => {
      const a = await begin(), before = exchanges;
      await owner.query("UPDATE pilot.oidc_attempts SET created_at=clock_timestamp()-interval '299 seconds',expires_at=clock_timestamp()+interval '200 milliseconds'");
      await owner.query('BEGIN'); await owner.query('SELECT slot FROM pilot.oidc_attempts FOR UPDATE');
      const blocked = denied(client.complete(a.callback, a.browserToken)); await delay(300); await owner.query('COMMIT'); await blocked;
      assert.equal(exchanges, before);
      const b = await begin();
      await owner.query("UPDATE pilot.oidc_attempts SET created_at=statement_timestamp()-interval '6 minutes',expires_at=statement_timestamp()-interval '1 minute'");
      assert.equal((await owner.query("SELECT expires_at-created_at=interval '5 minutes' AS exact_lifetime FROM pilot.oidc_attempts WHERE state_hash=$1", [hash(state)])).rows[0].exact_lifetime, true);
      await denied(client.complete(b.callback, b.browserToken)); assert.equal(exchanges, before);
      const c = await begin(); await denied(client.complete(c.callback.replace('code=synthetic-code', 'error=access_denied'), c.browserToken));
      await denied(client.complete(c.callback, c.browserToken)); assert.equal(exchanges, before);
    });
    await t.test('six concurrent consumers produce exactly one bounded receipt and exchange', async () => {
      const a = await begin(), before = exchanges;
      const results = await Promise.allSettled(Array.from({ length: 6 }, () => createOidcVerifier(config, connectFixture).complete(a.callback, a.browserToken)));
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1); assert.equal(exchanges - before, 1);
    });
    assert.deepEqual(serverErrors, []);
  } finally {
    await owner.query('ROLLBACK'); await owner.query('DELETE FROM pilot.oidc_attempts'); await owner.end();
    server.closeAllConnections(); await new Promise<void>(r => server.close(() => r()));
  }
});

