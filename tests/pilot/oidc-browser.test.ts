import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:https';
import { test } from 'node:test';
import { subscribe, unsubscribe } from 'node:diagnostics_channel';
import express from 'express';
import { chromium, type Browser } from 'playwright';
import { connectFixture } from '../../ops/local/fixture.js';
import { runPortalBrowserTest } from '../../ops/local/portal-browser.js';
import { createOidcVerifier } from '../../apps/web/src/server/oidc.js';
import { createCustomerApp } from '../../apps/web/src/server/customer.js';

test('fresh Keycloak 26.8.2 browser sign-in yields only issuer/subject, never an application session', async () => {
  if (process.env.PILOT_CONTAINER !== '1') { console.log(await runPortalBrowserTest('oidc')); return; }
  const endpoint = process.env.PORTAL_BROWSER_ENDPOINT; assert.ok(endpoint, 'Use the isolated browser harness');
  const config = { issuer: 'https://keycloak:8443/realms/pilot', clientId: 'pilot-oidc-test',
    clientSecret: await readFile('work/pilot/oidc-secret', 'utf8'), ca: await readFile('work/pilot/keycloak.crt', 'utf8'),
    callback: 'https://customer:8443/oidc/callback' };
  const verifier = createOidcVerifier(config, connectFixture);
  const app = express(); app.disable('x-powered-by');
  let result: { issuer: string; subject: string } | undefined;
  let capture!: (url: string) => void, release!: () => void;
  const captured = new Promise<string>(resolve => { capture = resolve; });
  const released = new Promise<void>(resolve => { release = resolve; });
  let firstCallback = true;
  let exchanges = 0;
  const observe = (message: unknown) => {
    if ((message as { request: { path: string } }).request.path === '/realms/pilot/protocol/openid-connect/token') exchanges++;
  };
  app.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'same-origin', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; form-action 'self' https://keycloak:8443; frame-ancestors 'none'; base-uri 'none'" });
    if (!req.secure || req.headers.host !== 'customer:8443') { res.sendStatus(400); return; } next();
  });
  app.get('/test-sign-in', (_req, res) => { res.type('html').send('<title>OIDC test</title><form method="post" action="/test-start"><button>Test sign in</button></form>'); });
  app.post('/test-start', async (req, res) => {
    if (req.headers.origin !== 'https://customer:8443') { res.sendStatus(403); return; }
    const attempt = await verifier.start();
    res.cookie('__Host-oidc', attempt.browserToken, { secure: true, httpOnly: true, sameSite: 'lax', path: '/', maxAge: 300000 });
    res.redirect(303, attempt.authorizationUrl);
  });
  app.get('/oidc/callback', async (req, res) => {
    const cookies = (req.headers.cookie ?? '').split(';').map(c => c.trim()).filter(c => c.startsWith('__Host-oidc='));
    if (cookies.length !== 1) { res.sendStatus(403); return; }
    try {
      if (firstCallback) { firstCallback = false; capture(`https://customer:8443${req.originalUrl}`); await released; }
      result = await verifier.complete(`https://customer:8443${req.originalUrl}`, cookies[0]!.slice('__Host-oidc='.length));
      res.clearCookie('__Host-oidc', { secure: true, httpOnly: true, sameSite: 'lax', path: '/' });
      res.redirect(303, '/verified');
    } catch { res.status(403).type('text').send('Sign-in failed.'); }
  });
  app.get('/verified', (_req, res) => { res.type('html').send('<title>OIDC verified</title><h1>Identity verified</h1>'); });
  app.use(createCustomerApp(connectFixture, async () => { throw new Error('No identity authority in this harness'); }));
  const server = createServer({ cert: await readFile('work/pilot/customer.crt'), key: await readFile('work/pilot/customer.key') }, app);
  let browser: Browser | undefined;
  let stage = 'setup';
  const db = await connectFixture();
  try {
    subscribe('http.client.request.start', observe);
    const before = (await db.query('SELECT count(*)::int AS n FROM pilot.sessions')).rows[0].n;
    await new Promise<void>(r => server.listen(8443, '0.0.0.0', r));
    browser = await chromium.connect(endpoint, { timeout: 5000 });
    const context = await browser.newContext(), stranger = await browser.newContext();
    const page = await context.newPage(), otherPage = await stranger.newPage();
    page.setDefaultTimeout(5000); otherPage.setDefaultTimeout(5000);
    const hosts: string[] = []; page.on('request', req => { hosts.push(new URL(req.url()).hostname); });
    stage = 'start page'; const initial = await page.goto('https://customer:8443/test-sign-in');
    assert.equal(initial?.status(), 200); assert.equal(await page.title(), 'OIDC test');
    stage = 'provider redirect'; await page.getByRole('button', { name: 'Test sign in' }).click();
    await page.waitForURL('https://keycloak:8443/**', { timeout: 5000 });
    assert.equal(new URL(page.url()).origin, 'https://keycloak:8443');
    const cookie = (await context.cookies('https://customer:8443')).find(c => c.name === '__Host-oidc');
    assert.ok(cookie?.secure && cookie.httpOnly && cookie.sameSite === 'Lax' && cookie.path === '/' && cookie.domain === 'customer');
    stage = 'provider form'; await page.getByLabel('Username or email').fill('oidc-user');
    await page.getByLabel('Password', { exact: true }).fill(await readFile('work/pilot/oidc-password', 'utf8'));
    stage = 'provider callback';
    const submitted = page.getByRole('button', { name: 'Sign In', exact: true }).click({ noWaitAfter: true }).then(() => true, () => false);
    let timeout: NodeJS.Timeout | undefined;
    const callback = await Promise.race([captured, new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => reject(new Error('Provider callback timeout')), 10000);
    })]).finally(() => clearTimeout(timeout));
    stage = 'wrong browser';
    await otherPage.goto('https://customer:8443/test-sign-in');
    await otherPage.getByRole('button', { name: 'Test sign in' }).click();
    await otherPage.waitForURL('https://keycloak:8443/**', { timeout: 5000 });
    const otherCookie = (await stranger.cookies('https://customer:8443')).find(c => c.name === '__Host-oidc');
    assert.ok(otherCookie && otherCookie.value !== cookie!.value);
    const otherState = new URL(otherPage.url()).searchParams.get('state')!;
    const stolen = await otherPage.goto(callback); assert.equal(stolen?.status(), 403);
    assert.equal(exchanges, 0);
    assert.equal(result, undefined, 'A different browser cannot consume the legitimate attempt');
    stage = 'verified return'; release(); assert.equal(await submitted, true);
    await page.waitForURL('https://customer:8443/verified', { timeout: 10000 });
    assert.equal(await page.title(), 'OIDC verified');
    assert.deepEqual(result, { issuer: config.issuer, subject: '13900000-0000-4000-8000-000000000001' });
    assert.equal(exchanges, 1);
    assert.ok(!(await context.cookies('https://customer:8443')).some(c => ['__Host-session', '__Host-oidc'].includes(c.name)));
    // Reinsert only the test attempt cookie to prove durable one-use denial, not merely cookie clearing.
    await context.addCookies([{ name: '__Host-oidc', value: cookie!.value, url: 'https://customer:8443', secure: true, httpOnly: true, sameSite: 'Lax' }]);
    stage = 'replay'; assert.equal((await page.goto(callback))?.status(), 403);
    assert.equal(exchanges, 1);
    await assert.rejects(verifier.complete(`${config.callback}?state=${otherState}&error=access_denied&iss=${encodeURIComponent(config.issuer)}`, otherCookie!.value), { message: 'OIDC unavailable' });
    stage = 'closed product routes'; for (const path of ['/auth/login', '/auth/callback', '/signup', '/recovery', '/mfa']) {
      assert.equal((await page.goto(`https://customer:8443${path}`))?.status(), 404);
    }
    assert.equal((await page.goto('https://customer:8443/customer'))?.status(), 403);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM pilot.sessions')).rows[0].n, before);
    assert.ok(hosts.every(host => ['customer', 'keycloak'].includes(host)));
    await context.close(); await stranger.close();
  } catch { throw new Error(`OIDC browser failed at ${stage}`); }
  finally { unsubscribe('http.client.request.start', observe); release(); await verifier.cleanup(); await db.end(); await browser?.close(); server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); }
});
