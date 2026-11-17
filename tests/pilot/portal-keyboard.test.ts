import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:https';
import { test } from 'node:test';
import { chromium, type Browser } from 'playwright';
import { connectFixture } from '../../ops/local/fixture.js';
import { runPortalBrowserTest } from '../../ops/local/portal-browser.js';
import { createCustomerApp } from '../../apps/web/src/server/customer.js';
import { tokenHash } from '../../apps/web/src/server/session.js';
import type { IdentityStatus } from '../../packages/contracts/pilot.js';

test('dashboard keyboard navigation and session rotation in an isolated browser', async () => {
  if (process.env.PILOT_CONTAINER !== '1') { console.log(await runPortalBrowserTest()); return; }
  const endpoint = process.env.PORTAL_BROWSER_ENDPOINT; assert.ok(endpoint, 'Run through the isolated portal browser harness');
  const db = await connectFixture(); const now = new Date();
  const status: IdentityStatus = { subject: randomUUID(),
    verified: true, enabled: true, requiredActions: [], credentials: [] };
  const app = createCustomerApp(connectFixture, async () => status);
  const server = createServer({ cert: await readFile('work/pilot/customer.crt'), key: await readFile('work/pilot/customer.key') }, app);
  let browser: Browser | undefined;
  try {
    browser = await chromium.connect(endpoint, { timeout: 5000 });
    const identity = (await db.query("INSERT INTO pilot.identities(subject,verified) VALUES($1,true) RETURNING id", [status.subject])).rows[0].id;
    const tenants: string[] = []; const memberships: string[] = [];
    for (const name of ['Keyboard A', 'Keyboard B']) {
      const tenant = (await db.query('INSERT INTO pilot.tenants(name) VALUES($1) RETURNING id', [name])).rows[0].id; tenants.push(tenant);
      memberships.push((await db.query("INSERT INTO pilot.memberships(tenant_id,identity_id,role) VALUES($1,$2,'Employee') RETURNING id", [tenant, identity])).rows[0].id);
    }
    const token = randomBytes(32).toString('hex'), csrf = randomBytes(32).toString('hex');
    await db.query(`INSERT INTO pilot.sessions(token_hash,csrf_hash,identity_id,identity_version,tenant_id,tenant_version,membership_id,membership_version,audience,created_at,last_seen_at,expires_at)
      VALUES($1,$2,$3,1,$4,1,$5,1,'customer',$6,$6,$7)`, [tokenHash(token), tokenHash(csrf), identity, tenants[0], memberships[0], now, new Date(now.getTime() + 28_800_000)]);
    await new Promise<void>(r => server.listen(8443, '0.0.0.0', r));
    const context = await browser.newContext();
    await context.addCookies([{ name: '__Host-session', value: token, url: 'https://customer:8443', secure: true, httpOnly: true, sameSite: 'Lax' },
      { name: '__Host-csrf', value: csrf, url: 'https://customer:8443', secure: true, httpOnly: true, sameSite: 'Lax' }]);
    const page = await context.newPage();
    const requests: string[] = []; page.on('request', request => requests.push(new URL(request.url()).hostname));
    const navigation = await page.goto('https://customer:8443/customer');
    assert.equal(navigation?.status(), 200, 'The customer document must load before keyboard assertions');
    assert.equal(await page.title(), 'Keyboard A · MaexSocial');
    await page.keyboard.press('Tab'); assert.equal(await page.locator(':focus').textContent(), 'Skip to workspace');
    await page.keyboard.press('Enter'); assert.equal(await page.locator(':focus').getAttribute('id'), 'main');
    await page.keyboard.press('Tab'); assert.equal(await page.locator(':focus').getAttribute('id'), 'tenant');
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Tab'); assert.equal(await page.locator(':focus').textContent(), 'Switch workspace');
    assert.equal(await page.locator('#tenant option:checked').textContent(), 'Keyboard B');
    const submitted = page.waitForResponse(response => new URL(response.url()).pathname === '/customer/switch', { timeout: 5000 });
    await page.keyboard.press('Enter'); const response = await submitted;
    assert.equal(await response.request().headerValue('origin'), 'https://customer:8443');
    assert.equal(response.status(), 303);
    await page.waitForFunction(() => document.title === 'Keyboard B · MaexSocial', undefined, { timeout: 5000 });
    assert.notEqual((await context.cookies()).find(cookie => cookie.name === '__Host-session')!.value, token);
    assert.ok(requests.every(host => host === 'customer'), 'No IdP or external request belongs to this dashboard-only test');
    await page.screenshot({ path: '/artifacts/dashboard.png', fullPage: true });
    await page.getByRole('button', { name: 'Sign out' }).focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.title === 'Signed out · MaexSocial', undefined, { timeout: 5000 });
    assert.equal(await page.getByRole('heading', { name: 'You are signed out' }).count(), 1);
    assert.ok(!(await context.cookies()).some(cookie => ['__Host-session', '__Host-csrf'].includes(cookie.name)));
    await context.close();
  } finally { await db.end(); await browser?.close(); server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); }
});
