import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer, request } from 'node:https';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { createCustomerApp } from '../../apps/web/src/server/customer.js';
import { tokenHash } from '../../apps/web/src/server/session.js';
import { connectFixture } from '../../ops/local/fixture.js';
import { runPortalBrowserTest } from '../../ops/local/portal-browser.js';
import { seedManagementSession } from './fixtures.js';

const origin = 'https://customer:8443';
const previewPath = '/customer/invitations/preview';

async function https(port: number, ca: Buffer, path: string, cookie = '', method = 'GET') {
  return new Promise<{ status: number; body: string; headers: Record<string, string | string[] | undefined> }>((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port, servername: 'customer', ca, path, method,
      headers: { Host: 'customer:8443', Cookie: cookie }, timeout: 5000 }, response => {
      response.setEncoding('utf8');
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode!, body, headers: response.headers }));
      response.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Invitation preview request timed out')));
    req.end();
  });
}

test('private invitation preview binds the recipient and leaves invitations, access and mailbox unchanged', async t => {
  if (process.env.PILOT_CONTAINER !== '1') {
    console.log(await runPortalBrowserTest('invitation'));
    return;
  }
  const db = await connectFixture(true);
  t.after(() => db.end());
  const endpoint = process.env.PORTAL_BROWSER_ENDPOINT;
  assert.ok(endpoint, 'Run through the isolated portal browser harness');
  const browser = await chromium.connect(endpoint, { timeout: 5000 });
  t.after(() => browser.close());
  const cert = await readFile('work/pilot/customer.crt');
  const key = await readFile('work/pilot/customer.key');
  const mailbox = await readFile('work/pilot/mailbox.crt');
  const mailboxCounts = async (): Promise<unknown[]> => new Promise((resolve, reject) => {
    const req = request({ hostname: 'mailbox', port: 8025, ca: mailbox, path: '/api/v1/info', timeout: 5000 }, response => {
      response.setEncoding('utf8');
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => {
        try {
          assert.equal(response.statusCode, 200);
          const { Messages, Unread } = JSON.parse(body);
          assert.ok(Number.isInteger(Messages) && Number.isInteger(Unread), 'Mailbox reports message counts');
          resolve([Messages, Unread]);
        } catch (error) { reject(error); }
      });
      response.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Mailbox observation timed out')));
    req.end();
  });
  const tenantAName = 'North <Studio> & Co';
  const tenantBName = 'South workshop canary';
  const [tenantA, tenantB] = (await db.query('INSERT INTO pilot.tenants(name) VALUES ($1),($2) RETURNING id', [tenantAName, tenantBName])).rows.map(row => row.id as string);
  const identity = async () => {
    const subject = randomUUID();
    const id = (await db.query('INSERT INTO pilot.identities(subject,verified) VALUES ($1,true) RETURNING id', [subject])).rows[0].id as string;
    return { id, subject };
  };
  const manager = await identity();
  const issuer = (await db.query("INSERT INTO pilot.memberships(tenant_id,identity_id,role) VALUES ($1,$2,'Manager') RETURNING id",
    [tenantA, manager.id])).rows[0].id as string;
  const otherManager = await identity();
  const otherIssuer = (await db.query("INSERT INTO pilot.memberships(tenant_id,identity_id,role) VALUES ($1,$2,'Manager') RETURNING id",
    [tenantB, otherManager.id])).rows[0].id as string;
  const recipient = await identity(), unrelated = await identity();
  const recipientEmail = 'invited-preview@example.invalid', unrelatedEmail = 'unrelated-preview@example.invalid';
  const recipientBySubject = new Map([[recipient.subject, recipientEmail], [unrelated.subject, unrelatedEmail]]);
  const session = async (identityId: string) => {
    const membershipId = (await db.query("INSERT INTO pilot.memberships(tenant_id,identity_id,role) VALUES ($1,$2,'Employee') RETURNING id",
      [tenantB, identityId])).rows[0].id as string;
    const token = randomBytes(32).toString('hex'), csrf = randomBytes(32).toString('hex');
    await db.query(`INSERT INTO pilot.sessions(token_hash,csrf_hash,identity_id,identity_version,tenant_id,tenant_version,
      membership_id,membership_version,audience,created_at,last_seen_at,expires_at)
      VALUES ($1,$2,$3,1,$4,1,$5,1,'customer',now()-interval '1 minute',now()-interval '1 minute',now()+interval '7 hours')`,
    [tokenHash(token), tokenHash(csrf), identityId, tenantB, membershipId]);
    return { token, csrf, header: `__Host-session=${token}; __Host-csrf=${csrf}` };
  };
  const invited = await session(recipient.id), other = await session(unrelated.id);
  const seed = async (state: 'current' | 'expired' | 'revoked' | 'consumed' | 'stale',
    tenant = tenantA, issuerId = issuer, email = recipientEmail) => {
    const token = randomBytes(32).toString('hex');
    await db.query(`INSERT INTO pilot.invitations(tenant_id,email,role,purpose,issuer_membership_id,issuer_version,
      grant_version,token_hash,created_at,expires_at,revoked_at,consumed_at)
      VALUES ($1,$2,'Employee','membership',$3,CASE WHEN $4='stale' THEN 2 ELSE 1 END,1,$5,now()-interval '2 hours',
        CASE WHEN $4='expired' THEN now() ELSE now()+interval '22 hours' END,
        CASE WHEN $4='revoked' THEN now() END, CASE WHEN $4='consumed' THEN now() END)`,
    [tenant, email, issuerId, state, tokenHash(token)]);
    return token;
  };
  const active = await seed('current');
  const expired = await seed('expired'), revoked = await seed('revoked'), consumed = await seed('consumed'), stale = await seed('stale');
  const unrelatedInvite = await seed('current', tenantB, otherIssuer, unrelatedEmail);
  const when = new Date();
  const platform = await seedManagementSession(db, when, when);
  const managerInvite = randomBytes(32).toString('hex');
  await db.query(`INSERT INTO pilot.invitations(tenant_id,email,role,purpose,issuer_platform_grant_id,issuer_version,
    grant_version,token_hash,created_at,expires_at)
    VALUES ($1,$2,'Manager','membership',$3,1,1,$4,now(),now()+interval '24 hours')`,
  [tenantA, unrelatedEmail, platform.grantId, tokenHash(managerInvite)]);
  const snapshot = async () => ({
    memberships: (await db.query('SELECT tenant_id,id,identity_id,role,version,active FROM pilot.memberships WHERE tenant_id=ANY($1::uuid[]) ORDER BY id',
      [[tenantA, tenantB]])).rows,
    invitations: (await db.query('SELECT tenant_id,id,consumed_at,revoked_at,grant_version FROM pilot.invitations WHERE tenant_id=ANY($1::uuid[]) ORDER BY id',
      [[tenantA, tenantB]])).rows,
    sessions: (await db.query('SELECT id,last_seen_at,revoked_at FROM pilot.sessions WHERE identity_id=ANY($1::uuid[]) ORDER BY id',
      [[recipient.id, unrelated.id]])).rows,
    mailbox: await mailboxCounts()
  });
  const before = await snapshot();
  const diagnostics: string[] = [];
  for (const level of ['debug', 'info', 'log', 'warn', 'error'] as const) {
    t.mock.method(console, level, (...args: unknown[]) => { diagnostics.push(args.map(String).join(' ')); });
  }
  const inspect = async (subject: string) => ({ subject, verified: true, enabled: true, requiredActions: [], credentials: [] });
  const app = createCustomerApp(connectFixture, inspect, undefined, { recipientBySubject });
  const defaultServer = createServer({ cert, key }, createCustomerApp(connectFixture, inspect));
  const server = createServer({ cert, key }, app);
  t.after(async () => {
    for (const current of [server, defaultServer]) {
      current.closeAllConnections();
      if (current.listening) await new Promise<void>(resolve => current.close(() => resolve()));
    }
  });
  await new Promise<void>(resolve => defaultServer.listen(0, '127.0.0.1', resolve));
  await new Promise<void>(resolve => server.listen(8443, '0.0.0.0', resolve));
  const normal = defaultServer.address();
  assert.ok(normal && typeof normal !== 'string');
  const withInvite = (sessionHeader: string, token: string) => `${sessionHeader}; __Host-invitation=${token}`;
  assert.equal((await https(normal.port, cert, previewPath, withInvite(invited.header, active))).status, 404, 'Default app has no preview mount');
  const valid = await https(8443, cert, previewPath, withInvite(invited.header, active));
  assert.equal(valid.status, 200, 'A bound recipient in tenant B can preview the invitation to tenant A');
  assert.match(valid.body, /North &lt;Studio&gt; &amp; Co/);
  assert.match(valid.body, /<dt>Role<\/dt><dd>Employee<\/dd>/);
  assert.equal(valid.headers['cache-control'], 'no-store');
  assert.equal(valid.headers['referrer-policy'], 'no-referrer');
  assert.equal(valid.headers['set-cookie'], undefined);
  const secondTenant = await https(8443, cert, previewPath, withInvite(other.header, unrelatedInvite));
  assert.equal(secondTenant.status, 200);
  assert.ok(secondTenant.body.includes(tenantBName) && !secondTenant.body.includes('North'));
  const managerPreview = await https(8443, cert, previewPath, withInvite(other.header, managerInvite));
  assert.equal(managerPreview.status, 200);
  assert.match(managerPreview.body, /<dt>Role<\/dt><dd>Manager<\/dd>/);
  assert.match(managerPreview.body, /North &lt;Studio&gt; &amp; Co/);
  assert.equal(managerPreview.headers['set-cookie'], undefined);
  const unavailable = await https(8443, cert, previewPath, invited.header);
  assert.equal(unavailable.status, 404);
  assert.match(unavailable.body, /Invitation unavailable/);
  const expectUnavailable = async (cookie: string, path = previewPath) => {
    const result = await https(8443, cert, path, cookie);
    assert.equal(result.status, unavailable.status);
    assert.equal(result.body === unavailable.body, true, 'Every unavailable preview has the same document');
  };
  for (const cookie of [
    withInvite(invited.header, expired), withInvite(invited.header, revoked), withInvite(invited.header, consumed),
    withInvite(invited.header, stale), withInvite(invited.header, unrelatedInvite), withInvite(other.header, active),
    withInvite(invited.header, managerInvite),
    withInvite(invited.header, randomBytes(32).toString('hex')), withInvite(invited.header, 'invalid'),
    withInvite(withInvite(invited.header, active), active), `__Host-invitation=${active}`
  ]) await expectUnavailable(cookie);
  await expectUnavailable(withInvite(other.header, active), `${previewPath}?email=${encodeURIComponent(recipientEmail)}`);
  assert.equal((await https(8443, cert, previewPath, withInvite(invited.header, active), 'POST')).status, 404);

  const context = await browser.newContext();
  t.after(() => context.close());
  await context.addCookies([['__Host-session', invited.token], ['__Host-csrf', invited.csrf], ['__Host-invitation', active]]
    .map(([name, value]) => ({ name: name!, value: value!, url: origin, secure: true, httpOnly: true, sameSite: 'Lax' as const })));
  const page = await context.newPage();
  const requested: string[] = [];
  page.on('request', req => requested.push(`${req.method()} ${req.url()}`));
  page.on('console', message => diagnostics.push(message.text()));
  page.on('pageerror', error => diagnostics.push(error.message));
  const url = origin + previewPath;
  assert.equal((await page.goto(url))?.status(), 200);
  assert.equal((await page.reload())?.status(), 200);
  assert.equal(await page.getByRole('heading', { name: 'Employee invitation' }).count(), 1);
  assert.equal(await page.getByText(tenantAName, { exact: true }).count(), 1);
  assert.equal(await page.getByText(tenantBName, { exact: true }).count(), 0);
  assert.equal(await page.locator('form, button').count(), 0);
  const renderedDocument = await page.content();
  await page.keyboard.press('Tab');
  assert.equal(await page.locator(':focus').textContent(), 'Back to workspace');
  assert.ok(await page.locator(':focus').evaluate(node => getComputedStyle(node).outlineStyle !== 'none'));
  assert.deepEqual(await snapshot(), before);
  await page.keyboard.press('Enter');
  await page.waitForURL(origin + '/customer', { timeout: 5000 });
  assert.deepEqual(requested, [`GET ${url}`, `GET ${url}`, `GET ${origin}/customer`]);
  await db.query("UPDATE pilot.tenants SET active=false,version=version+1 WHERE id=$1", [tenantA]);
  await expectUnavailable(withInvite(invited.header, active));
  await db.query("UPDATE pilot.tenants SET active=true,version=version+1 WHERE id=$1", [tenantA]);
  assert.equal((await https(8443, cert, previewPath, withInvite(invited.header, active))).status, 200);
  await db.query("UPDATE pilot.memberships SET role='Employee',version=version+1 WHERE tenant_id=$1 AND id=$2", [tenantA, issuer]);
  await expectUnavailable(withInvite(invited.header, active));
  await db.query("UPDATE pilot.memberships SET role='Manager',version=version+1 WHERE tenant_id=$1 AND id=$2", [tenantA, issuer]);
  await expectUnavailable(withInvite(invited.header, active));

  const tokens = [active, expired, revoked, consumed, stale, unrelatedInvite, managerInvite];
  for (const sensitive of [recipientEmail, unrelatedEmail, ...tokens, ...tokens.map(tokenHash)]) {
    assert.ok([valid.body, managerPreview.body, unavailable.body, renderedDocument, ...diagnostics].every(value => !value.includes(sensitive)),
      'Rendered messages and application/browser logs exclude invitation credentials and recipient addresses');
  }
});
