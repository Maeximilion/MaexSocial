import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:https';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';
import express from 'express';
import { Client } from 'pg';
import { chromium, type Browser, type Page, type Response } from 'playwright';
import { connectFixture, loadFixture } from '../../ops/local/fixture.js';
import { runPortalBrowserTest } from '../../ops/local/portal-browser.js';
import { createOidcVerifier, type OidcStepUpEvidence } from '../../apps/web/src/server/oidc.js';
import { createCustomerApp } from '../../apps/web/src/server/customer.js';

test('isolated Keycloak requires a new enrolled OTP execution even after high-ACR SSO', async () => {
  if (process.env.PILOT_CONTAINER !== '1') { console.log(await runPortalBrowserTest('oidc-step-up')); return; }
  const endpoint = process.env.PORTAL_BROWSER_ENDPOINT; assert.ok(endpoint);
  const fixture = await loadFixture();
  const identity = new Client({ host: 'identity-db', database: 'identity_fixture', user: 'identity_owner', password: fixture.identityPassword,
    ssl: { ca: await readFile('work/pilot/identity-db.crt', 'utf8'), rejectUnauthorized: true },
    connectionTimeoutMillis: 5000, options: '-c statement_timeout=5000 -c default_transaction_read_only=on' });
  const config = { issuer: 'https://keycloak:8443/realms/pilot', clientId: 'pilot-step-up-test',
    clientSecret: await readFile('work/pilot/step-up-secret', 'utf8'), ca: await readFile('work/pilot/keycloak.crt', 'utf8'),
    callback: 'https://customer:8443/oidc/callback',
    stepUp: { expectedSubject: '14300000-0000-4000-8000-000000000001', policy: 'keycloak-26.8.2-enrolled-otp-v1' } };
  const verifier = createOidcVerifier(config, connectFixture), receipts: OidcStepUpEvidence[] = [];
  const pending: { state: string; browserToken: string }[] = [];
  const app = express(); app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'same-origin', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; form-action 'self' https://keycloak:8443; frame-ancestors 'none'; base-uri 'none'" });
    if (!req.secure || req.headers.host !== 'customer:8443') { res.sendStatus(400); return; } next();
  });
  app.get('/test-step-up', (_req, res) => res.type('html').send('<title>Private factor test</title><form method="post" action="/test-start"><button>Verify factor</button></form>'));
  app.post('/test-start', async (req, res) => {
    if (req.headers.origin !== 'https://customer:8443') { res.sendStatus(403); return; }
    const attempt = await verifier.start();
    pending.push({ state: new URL(attempt.authorizationUrl).searchParams.get('state')!, browserToken: attempt.browserToken });
    res.cookie('__Host-oidc', attempt.browserToken, { secure: true, httpOnly: true, sameSite: 'lax', path: '/', maxAge: 300000 });
    res.redirect(303, attempt.authorizationUrl);
  });
  app.get('/oidc/callback', async (req, res) => {
    const cookies = (req.headers.cookie ?? '').split(';').map(c => c.trim()).filter(c => c.startsWith('__Host-oidc='));
    if (cookies.length !== 1) { res.sendStatus(403); return; }
    try {
      const result = await verifier.complete(`https://customer:8443${req.originalUrl}`, cookies[0]!.slice('__Host-oidc='.length));
      assert.ok('validUntil' in result); receipts.push(result);
      res.clearCookie('__Host-oidc', { secure: true, httpOnly: true, sameSite: 'lax', path: '/' });
      res.redirect(303, '/verified');
    } catch { res.status(403).type('text').send('Factor verification failed.'); }
  });
  app.get('/verified', (_req, res) => res.type('html').send('<title>Factor verified</title><h1>Private evidence only</h1>'));
  app.use(createCustomerApp(connectFixture, async () => { throw new Error('No authority in this test'); }));
  const server = createServer({ cert: await readFile('work/pilot/customer.crt'), key: await readFile('work/pilot/customer.key') }, app);
  const db = await connectFixture(); let browser: Browser | undefined, stage = 'imported policy';
  try {
    await identity.connect();
    const realm = (await identity.query("SELECT id,registration_allowed,reset_password_allowed,otp_policy_type,otp_policy_alg,otp_policy_digits,otp_policy_period FROM realm WHERE name='pilot'")).rows[0];
    assert.ok(realm); assert.equal(realm.registration_allowed, false); assert.equal(realm.reset_password_allowed, false);
    assert.equal(realm.otp_policy_type, 'totp'); assert.equal(realm.otp_policy_alg, 'HmacSHA1');
    assert.equal(realm.otp_policy_digits, 6); assert.equal(realm.otp_policy_period, 30);
    const levels = (await identity.query(`SELECT c.alias,e.name,e.value FROM authenticator_config c
      JOIN authenticator_config_entry e ON e.authenticator_id=c.id WHERE c.realm_id=$1 AND e.name LIKE 'loa-%' ORDER BY c.alias,e.name`, [realm.id])).rows;
    assert.deepEqual(levels, [
      { alias: 'step-up-otp-level', name: 'loa-condition-level', value: '2' },
      { alias: 'step-up-otp-level', name: 'loa-max-age', value: '0' },
      { alias: 'step-up-password-level', name: 'loa-condition-level', value: '1' },
      { alias: 'step-up-password-level', name: 'loa-max-age', value: '36000' }
    ], 'No other imported flow can retain a high LoA');
    const executions = (await identity.query(`SELECT f.alias AS parent,e.authenticator,e.requirement,child.alias AS child,c.alias AS config
      FROM authentication_execution e JOIN authentication_flow f ON f.id=e.flow_id
      LEFT JOIN authentication_flow child ON child.id=e.auth_flow_id LEFT JOIN authenticator_config c ON c.id=e.auth_config
      WHERE f.realm_id=$1 AND f.alias LIKE 'private-step-up%' ORDER BY f.alias,e.priority`, [realm.id])).rows;
    // Keycloak 26.8.2 stores REQUIRED=0, CONDITIONAL=1, ALTERNATIVE=2.
    assert.deepEqual(executions, [
      { parent: 'private-step-up', authenticator: 'auth-cookie', requirement: 2, child: null, config: null },
      { parent: 'private-step-up', authenticator: null, requirement: 2, child: 'private-step-up-auth', config: null },
      { parent: 'private-step-up-auth', authenticator: null, requirement: 1, child: 'private-step-up-password', config: null },
      { parent: 'private-step-up-auth', authenticator: null, requirement: 1, child: 'private-step-up-otp', config: null },
      { parent: 'private-step-up-otp', authenticator: 'conditional-level-of-authentication', requirement: 0, child: null, config: 'step-up-otp-level' },
      { parent: 'private-step-up-otp', authenticator: 'auth-otp-form', requirement: 0, child: null, config: null },
      { parent: 'private-step-up-password', authenticator: 'conditional-level-of-authentication', requirement: 0, child: null, config: 'step-up-password-level' },
      { parent: 'private-step-up-password', authenticator: 'auth-username-password-form', requirement: 0, child: null, config: null }
    ]);
    const actions = (await identity.query("SELECT enabled,default_action FROM required_action_provider WHERE realm_id=$1 AND alias='CONFIGURE_TOTP'", [realm.id])).rows;
    assert.deepEqual(actions, [{ enabled: false, default_action: false }]);
    const bindings = (await identity.query(`SELECT c.client_id,b.binding_name,f.alias FROM client c
      JOIN client_auth_flow_bindings b ON b.client_id=c.id JOIN authentication_flow f ON f.id=b.flow_id WHERE c.realm_id=$1`, [realm.id])).rows;
    assert.deepEqual(bindings, [{ client_id: 'pilot-step-up-test', binding_name: 'browser', alias: 'private-step-up' }]);
    const policies = (await identity.query("SELECT name,value FROM realm_attribute WHERE realm_id=$1 AND (lower(name) LIKE '%client%polic%' OR lower(name) LIKE '%client%profile%')", [realm.id])).rows;
    for (const policy of policies) {
      const value = JSON.parse(policy.value);
      assert.equal((value.policies ?? []).filter((p: { enabled?: boolean }) => p.enabled).length, 0);
      assert.equal((value.profiles ?? []).length, 0);
    }
    const factorCount = async () => (await identity.query("SELECT user_id,count(*)::int AS n FROM credential WHERE user_id IN ($1,$2) AND type='otp' GROUP BY user_id ORDER BY user_id",
      [config.stepUp.expectedSubject, '14300000-0000-4000-8000-000000000002'])).rows;
    assert.deepEqual(await factorCount(), [{ user_id: config.stepUp.expectedSubject, n: 1 }]);
    const before = (await db.query('SELECT count(*)::int AS n FROM pilot.sessions')).rows[0].n;
    await new Promise<void>(r => server.listen(8443, '0.0.0.0', r));
    browser = await chromium.connect(endpoint, { timeout: 5000 });
    const context = await browser.newContext(), unenrolled = await browser.newContext();
    const page = await context.newPage(), other = await unenrolled.newPage(); page.setDefaultTimeout(5000); other.setDefaultTimeout(5000);
    const hosts: string[] = []; page.on('request', req => hosts.push(new URL(req.url()).hostname));
    const begin = async (p: Page) => {
      const initial = await p.goto('https://customer:8443/test-step-up'); assert.equal(initial?.status(), 200);
      await p.getByRole('button', { name: 'Verify factor' }).click(); await p.waitForURL('https://keycloak:8443/**');
    };
    const password = await readFile('work/pilot/step-up-password', 'utf8'), secret = await readFile('work/pilot/step-up-otp', 'utf8');
    const login = async (p: Page, username: string) => {
      await p.getByLabel('Username or email').fill(username); await p.getByLabel('Password', { exact: true }).fill(password);
      await p.getByRole('button', { name: 'Sign In', exact: true }).click();
    };
    let previousPeriod: number | undefined;
    const submitOtp = async (phase: 'initial OTP' | 'high-ACR SSO') => {
      stage = `${phase}: submit challenge`;
      // A retained fixture may have consumed this period's code in a prior run. Never retry a rejected code.
      await delay(30000 - Date.now() % 30000 + 250);
      const generatedAt = Date.now();
      const period = Math.floor(generatedAt / 30000);
      const periodsAdvanced = previousPeriod === undefined ? 'first' : period - previousPeriod;
      previousPeriod = period;
      const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(period));
      const mac = createHmac('sha1', secret).update(counter).digest(), offset = mac[19]! & 15;
      const otp = String((mac.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0');
      let otpStatus: number | undefined, callbackStatus: number | undefined;
      const observe = (response: Response) => {
        const { origin, pathname } = new URL(response.url());
        if (origin === 'https://keycloak:8443' && pathname === '/realms/pilot/login-actions/authenticate'
          && response.request().method() === 'POST') otpStatus = response.status();
        if (origin === 'https://customer:8443' && pathname === '/oidc/callback') callbackStatus = response.status();
      };
      page.on('response', observe);
      try {
        await page.getByLabel('One-time code').fill(otp);
        await page.getByRole('button', { name: 'Sign In', exact: true }).click();
        stage = `${phase}: wait for verified page`;
        await page.waitForURL('https://customer:8443/verified', { timeout: 10000 });
        stage = `${phase}: verify page title`;
        assert.equal(await page.title(), 'Factor verified');
      } catch (error) {
        const challengeRepeated = otpStatus === 200 && await page.getByLabel('One-time code').isVisible().catch(() => false);
        stage += ` (OTP POST ${otpStatus ?? 'unobserved'}, challenge repeated ${challengeRepeated}, callback ${callbackStatus ?? 'unobserved'}, periods advanced ${periodsAdvanced}, generated ${generatedAt % 30000} ms into period)`;
        throw error;
      } finally { page.off('response', observe); }
    };
    stage = 'initial OTP: start and sign in'; await begin(page); await login(page, 'step-up-enrolled');
    stage = 'initial OTP: require visible challenge';
    await page.getByLabel('One-time code').waitFor({ state: 'visible' }); assert.equal(receipts.length, 0);
    await submitOtp('initial OTP');
    stage = 'initial OTP: verify receipt';
    assert.equal(receipts.length, 1); assert.equal(receipts[0]!.acr, '2');
    stage = 'high-ACR SSO: start'; await begin(page);
    stage = 'high-ACR SSO: require visible challenge';
    await page.getByLabel('One-time code').waitFor({ state: 'visible' });
    stage = 'high-ACR SSO: verify challenge before receipt';
    assert.equal(await page.getByLabel('Password', { exact: true }).count(), 0);
    assert.equal(receipts.length, 1, 'Prior high ACR cannot produce a second receipt without a new OTP execution');
    await submitOtp('high-ACR SSO');
    stage = 'high-ACR SSO: verify fresh receipt';
    assert.equal(receipts.length, 2);
    assert.ok(receipts[1]!.factorTimeLowerBound > receipts[0]!.factorTimeLowerBound);
    stage = 'unenrolled fails without setup'; await begin(other); await login(other, 'step-up-unenrolled');
    await other.getByText('Cannot login, credential setup required.', { exact: true }).waitFor({ state: 'visible' });
    assert.equal(await other.locator('input[name="totp"],input[name="otp"],#kc-totp-secret-key').count(), 0);
    assert.equal(receipts.length, 2); assert.deepEqual(await factorCount(), [{ user_id: config.stepUp.expectedSubject, n: 1 }]);
    stage = 'first factor cannot satisfy step-up';
    const lowContext = await browser.newContext(), low = await lowContext.newPage(); low.setDefaultTimeout(5000);
    await begin(low);
    const lowUrl = new URL(low.url()); lowUrl.searchParams.set('claims', JSON.stringify({ id_token: { acr: { essential: true, values: ['1'] } } }));
    await low.goto(lowUrl.href); await login(low, 'step-up-enrolled');
    await low.waitForURL('https://customer:8443/oidc/callback?**');
    assert.equal(await low.locator('body').innerText(), 'Factor verification failed.');
    assert.equal(receipts.length, 2); await lowContext.close();
    stage = 'no application authority';
    assert.ok(!(await context.cookies('https://customer:8443')).some(c => c.name === '__Host-session'));
    assert.equal((await db.query('SELECT count(*)::int AS n FROM pilot.sessions')).rows[0].n, before);
    for (const path of ['/auth/login', '/auth/callback', '/signup', '/recovery', '/mfa']) assert.equal((await page.goto(`https://customer:8443${path}`))?.status(), 404);
    assert.equal((await page.goto('https://customer:8443/customer'))?.status(), 403);
    assert.ok(hosts.every(host => ['customer', 'keycloak'].includes(host)));
    await context.close(); await unenrolled.close();
  } catch { throw new Error(`Step-up browser failed at ${stage}`); }
  finally {
    for (const attempt of pending) await assert.rejects(verifier.complete(`${config.callback}?state=${attempt.state}&error=access_denied&iss=${encodeURIComponent(config.issuer)}`, attempt.browserToken));
    await identity.end(); await db.end(); await verifier.cleanup(); await browser?.close(); server.closeAllConnections();
    if (server.listening) await new Promise<void>(r => server.close(() => r())); }
});
