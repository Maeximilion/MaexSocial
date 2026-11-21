import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:https';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { createCustomerApp } from '../../apps/web/src/server/customer.js';
import { runPortalBrowserTest } from '../../ops/local/portal-browser.js';

test('the customer entry previews an invented draft at desktop and mobile widths', async () => {
  if (process.env.PILOT_CONTAINER !== '1') { console.log(await runPortalBrowserTest('entry')); return; }
  const endpoint = process.env.PORTAL_BROWSER_ENDPOINT;
  assert.ok(endpoint, 'Run through the isolated portal browser harness');
  const entryUrl = 'https://customer:8443/';
  const privateCalls: string[] = [];
  const app = createCustomerApp(async () => {
    privateCalls.push('database');
    throw new Error('The public entry must not connect to storage');
  }, async () => {
    privateCalls.push('identity');
    throw new Error('The public entry must not look up an identity');
  });
  const server = createServer({ cert: await readFile('work/pilot/customer.crt'), key: await readFile('work/pilot/customer.key') }, app);
  const browser = await chromium.connect(endpoint, { timeout: 5000 });
  try {
    await once(server.listen(8443, '0.0.0.0'), 'listening');
    for (const { name, width, height } of [{ name: 'desktop', width: 1440, height: 960 }, { name: 'mobile', width: 360, height: 800 }]) {
      const context = await browser.newContext({ viewport: { width, height }, isMobile: name === 'mobile' });
      try {
        const page = await context.newPage();
        const requests: string[] = [];
        page.on('request', request => requests.push(`${request.method()} ${request.url()}`));
        const navigation = await page.goto(entryUrl);
        assert.ok(navigation);
        assert.equal(navigation.status(), 200);
        assert.equal(await navigation.headerValue('set-cookie'), null);
        assert.equal(await page.title(), 'Signed out · MaexSocial');
        assert.ok(await page.getByRole('heading', { name: 'Good local posts start with a draft.' }).isVisible());
        assert.ok(await page.getByRole('heading', { name: 'You are signed out' }).isVisible());
        assert.ok(await page.getByText('Customer sign-in is unavailable in this local preview.').isVisible());
        const disclosure = page.locator('details');
        const summary = disclosure.locator('summary');
        const post = disclosure.getByText(/Our repair bench is open on Saturday/);
        assert.equal((await summary.textContent())?.trim(), 'Inspect sample draft');
        assert.ok(await summary.isVisible());
        assert.ok(!(await post.isVisible()), 'The example starts collapsed');
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));

        await page.keyboard.press('Tab');
        assert.equal(await page.locator(':focus').textContent(), 'Skip to content');
        await page.keyboard.press('Enter');
        assert.equal(await page.locator(':focus').getAttribute('id'), 'main');
        await page.keyboard.press('Tab');
        assert.ok(await summary.evaluate(node => node === document.activeElement));
        assert.ok(await summary.evaluate(node => {
          const style = getComputedStyle(node);
          return style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2;
        }), 'The keyboard-focused disclosure has a visible outline');

        await page.keyboard.press('Enter');
        assert.ok(await post.isVisible());
        assert.ok(await disclosure.getByText('Harbor & Spoke · Riverside', { exact: true }).isVisible());
        assert.ok(await disclosure.getByText('Google Business Profile', { exact: true }).isVisible());
        assert.ok(await disclosure.getByText('Awaiting review', { exact: true }).isVisible());
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
        await page.screenshot({ path: `/artifacts/entry-${name}.png`, fullPage: true });
        await page.keyboard.press('Space');
        assert.ok(!(await post.isVisible()), 'Space closes the disclosure');
        assert.deepEqual(await context.cookies(), []);
        assert.deepEqual(requests, [`GET ${entryUrl}`], 'The example makes no network requests');
      } finally {
        await context.close();
      }
    }
    assert.deepEqual(privateCalls, []);
  } finally {
    server.closeAllConnections();
    try { await browser.close(); } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  }
});
