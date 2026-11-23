import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer, request, type Server } from 'node:https';
import { join } from 'node:path';
import { test } from 'node:test';
import { chromium } from 'playwright';
import { createCustomerApp } from '../../apps/web/src/server/customer.js';
import { customerOrigin } from '../../apps/web/src/server/request.js';
import { tokenHash } from '../../apps/web/src/server/session.js';
import { FakeGbp } from '../../apps/worker/src/fake-gbp.js';
import { connectFixture } from '../../ops/local/fixture.js';
import { runPortalBrowserTest } from '../../ops/local/portal-browser.js';
import { occurrence, seedTenant } from './fixtures.js';

const occurrencePath = (id: string) => `/customer/occurrences/${id}`;
const downloadPath = (id: string) => `${occurrencePath(id)}/export`;
const formType = 'application/x-www-form-urlencoded';
const approvedText = '\n  Invented <script>literal</script> & text\nCafé 🌱  \n';

async function listen(server: Server, port: number, host: string): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve());
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  return address.port;
}

test('private HTTPS export downloads the approved bytes for both roles and rechecks every request', async t => {
  if (process.env.PILOT_CONTAINER !== '1') {
    console.log(await runPortalBrowserTest('export'));
    return;
  }
  const endpoint = process.env.PORTAL_BROWSER_ENDPOINT;
  assert.ok(endpoint, 'Run through the isolated portal browser harness');
  const db = await connectFixture(true);
  t.after(() => db.end());
  const providerDirectory = await mkdtemp(join('/dev/shm', 'maex-289-provider-'));
  let fake: FakeGbp;
  t.after(async () => {
    fake?.close();
    await rm(providerDirectory, { recursive: true, force: true });
  });
  fake = new FakeGbp(providerDirectory);
  const a = await seedTenant(db, approvedText), b = await seedTenant(db);

  const session = async (tenant: string, role: 'Employee' | 'Manager') => {
    const token = randomBytes(32).toString('hex'), csrf = randomBytes(32).toString('hex');
    await db.query(`UPDATE pilot.identities i SET verified=true,version=i.version+1 FROM pilot.memberships m
      WHERE m.tenant_id=$1 AND m.role=$2 AND m.identity_id=i.id AND NOT i.verified`, [tenant, role]);
    const seeded = await db.query<{ membership_id: string }>(`INSERT INTO pilot.sessions
      (token_hash,csrf_hash,identity_id,identity_version,tenant_id,tenant_version,membership_id,membership_version,
      audience,created_at,last_seen_at,expires_at)
      SELECT $1,$2,i.id,i.version,t.id,t.version,m.id,m.version,'customer',now(),now(),now()+interval '15 minutes'
      FROM pilot.memberships m JOIN pilot.identities i ON i.id=m.identity_id JOIN pilot.tenants t ON t.id=m.tenant_id
      WHERE t.id=$3 AND m.role=$4 RETURNING membership_id`, [tokenHash(token), tokenHash(csrf), tenant, role]);
    assert.equal(seeded.rowCount, 1);
    return { token, csrf, membership: seeded.rows[0]!.membership_id, role };
  };
  const employee = await session(a.tenant, 'Employee'), manager = await session(a.tenant, 'Manager');
  const outside = await session(b.tenant, 'Manager');
  const approved = async (fixture: typeof a) => {
    const id = await occurrence(db, fixture);
    // Prepare the historical approval before the fixture is exposed to either customer session.
    const approval = (await db.query<{ id: string }>(`INSERT INTO pilot.approvals
      (tenant_id,occurrence_id,draft_id,revision_id,location_id,provider_location,membership_id,membership_version,
      grant_version,grant_active_at_approval,due_at,timezone,mfa_at,tenant_version)
      SELECT o.tenant_id,o.id,o.draft_id,$2,l.id,l.provider_location,m.id,m.version,l.version,l.grant_active,
        o.due_at,o.timezone,now(),t.version
      FROM pilot.occurrences o JOIN pilot.locations l ON l.tenant_id=o.tenant_id AND l.id=o.location_id
      JOIN pilot.tenants t ON t.id=o.tenant_id JOIN pilot.memberships m ON m.tenant_id=t.id AND m.id=$3
      WHERE o.id=$1 RETURNING id`, [id, fixture.revision, fixture.membership])).rows[0]!.id;
    await db.query("UPDATE pilot.occurrences SET state='approved',approval_id=$2 WHERE id=$1", [id, approval]);
    return { id, approval, tenant: fixture.tenant };
  };
  const first = await approved(a), second = await approved(a);
  const held = await approved(a), attempted = await approved(a), control = await approved(b);
  await db.query("UPDATE pilot.occurrences SET state='held' WHERE id=$1", [held.id]);
  await db.query('INSERT INTO pilot.attempts(tenant_id,occurrence_id,approval_id) VALUES($1,$2,$3)',
    [a.tenant, attempted.id, attempted.approval]);

  const store = async ({ tenant, id }: typeof first) => (await db.query(`SELECT state,approval_id,
    (SELECT count(*)::int FROM pilot.approvals WHERE tenant_id=$1 AND occurrence_id=$2) AS approvals,
    (SELECT count(*)::int FROM pilot.attempts WHERE tenant_id=$1 AND occurrence_id=$2) AS attempts,
    (SELECT count(*)::int FROM pilot.audit WHERE tenant_id=$1 AND occurrence_id=$2 AND action='occurrence_export') AS exports,
    (SELECT count(*)::int FROM pilot.budget_reservations WHERE tenant_id=$1) AS reservations
    FROM pilot.occurrences WHERE tenant_id=$1 AND id=$2`, [tenant, id])).rows[0];
  const counts = async (target: typeof first) => ({ ...await store(target), creates: fake.createCount(target.tenant, target.id) });
  const controlBefore = await counts(control);
  const sessionTimes = async () => (await db.query('SELECT id,last_seen_at FROM pilot.sessions WHERE tenant_id=ANY($1::uuid[]) ORDER BY id',
    [[a.tenant, b.tenant]])).rows;
  const timesBefore = await sessionTimes();
  const ca = await readFile('work/pilot/customer.crt');
  const tls = { cert: ca, key: await readFile('work/pilot/customer.key') };
  const inspect = async (subject: string) => ({ subject, verified: true, enabled: true, requiredActions: [], credentials: [] });
  const enabled = createServer(tls, createCustomerApp(connectFixture, inspect, undefined, { occurrenceExport: true }));
  const disabled = createServer(tls, createCustomerApp(connectFixture, inspect));
  t.after(async () => {
    for (const server of [enabled, disabled]) {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  });
  const port = await listen(enabled, 8443, '0.0.0.0');
  const disabledPort = await listen(disabled, 0, '127.0.0.1');

  const cookieFor = (actor: typeof employee) => `__Host-session=${actor.token}; __Host-csrf=${actor.csrf}`;
  const send = (path: string, options: { method?: 'GET' | 'POST'; port?: number; cookie?: string; origin?: string;
    type?: string; body?: string } = {}) => {
    const { method = 'POST', port: target = port, cookie = cookieFor(employee),
      origin = customerOrigin, type = formType, body = method === 'POST' ? `csrf=${employee.csrf}` : '' } = options;
    return new Promise<{ status: number; headers: import('node:http').IncomingHttpHeaders; bytes: Buffer }>((resolve, reject) => {
      const req = request({ hostname: '127.0.0.1', servername: 'customer', port: target, path, method, ca,
        signal: AbortSignal.timeout(5000), headers: { host: 'customer:8443', cookie, origin,
          'content-type': type, 'content-length': Buffer.byteLength(body) } }, res => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('error', reject);
        res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, bytes: Buffer.concat(chunks) }));
      });
      req.on('error', reject);
      req.end(body);
    });
  };
  const denied = async (target: typeof first, status: number, options?: Parameters<typeof send>[1], path = downloadPath(target.id)) => {
    const before = await counts(target);
    const response = await send(path, options);
    assert.equal(response.status, status);
    assert.equal(response.headers['content-disposition'], undefined);
    assert.equal(response.bytes.toString(), status === 404 ? 'Not found.' : 'Request could not be completed.');
    assert.deepEqual(await counts(target), before);
  };

  await t.test('protected HTTP boundary denies malformed, foreign, held and attempted requests with zero release', async () => {
    const standard = await send(occurrencePath(first.id), { method: 'GET', port: disabledPort });
    assert.equal(standard.status, 200);
    assert.doesNotMatch(standard.bytes.toString(), /Download approved text/);
    await denied(first, 404, { port: disabledPort });
    await denied(first, 404, { method: 'GET' });
    await denied(first, 403, { cookie: '' });
    await denied(first, 403, { origin: 'https://foreign.invalid' });
    await denied(first, 403, { body: `csrf=${manager.csrf}` });
    await denied(first, 403, { cookie: `__Host-session=${employee.token}; __Host-csrf=${manager.csrf}`, body: `csrf=${manager.csrf}` });
    await denied(first, 400, { type: 'text/plain' });
    await denied(first, 400, { body: `csrf=${employee.csrf}&csrf=${employee.csrf}` });
    await denied(first, 400, { body: `csrf=${employee.csrf}&tenantId=${b.tenant}` });
    await denied(first, 400, undefined, `${downloadPath(first.id)}?text=ignored`);
    await denied(control, 403);
    await denied(held, 403);
    await denied(attempted, 403);
  });

  await t.test('keyboard download for each role ends with a single durable export', async () => {
    const browser = await chromium.connect(endpoint, { timeout: 5000 });
    try {
      for (const [actor, target] of [[employee, first], [manager, second]] as const) {
        const context = await browser.newContext();
        try {
          await context.addCookies([{ name: '__Host-session', value: actor.token, url: customerOrigin, secure: true, httpOnly: true, sameSite: 'Lax' },
            { name: '__Host-csrf', value: actor.csrf, url: customerOrigin, secure: true, httpOnly: true, sameSite: 'Lax' }]);
          const page = await context.newPage();
          const hosts: string[] = [];
          page.on('request', req => hosts.push(new URL(req.url()).host));
          assert.equal((await page.goto(`${customerOrigin}${occurrencePath(target.id)}`))?.status(), 200);
          assert.equal(await page.getByText('Approved', { exact: true }).count(), 1);
          assert.ok(!(await page.locator('main').textContent())!.includes('Invented <script>literal'));
          assert.equal(await page.locator('script').count(), 0);
          await page.keyboard.press('Tab');
          assert.equal(await page.locator(':focus').textContent(), 'Back to workspace');
          await page.keyboard.press('Tab');
          assert.equal(await page.locator(':focus').textContent(), 'Download approved text');
          const downloadStarted = page.waitForEvent('download', { timeout: 5000 });
          await page.keyboard.press('Enter');
          const download = await downloadStarted;
          assert.equal(new URL(download.url()).pathname, downloadPath(target.id));
          assert.equal(download.suggestedFilename(), 'approved-post.txt');
          const chunks: Buffer[] = [];
          for await (const chunk of await download.createReadStream()) chunks.push(chunk);
          assert.deepEqual(Buffer.concat(chunks), Buffer.from(approvedText));
          assert.deepEqual(await counts(target), { state: 'exported', approval_id: target.approval,
            approvals: 1, attempts: 0, exports: 1, reservations: 0, creates: 0 });
          assert.equal((await page.reload())?.status(), 200);
          assert.equal(await page.getByText('Exported', { exact: true }).count(), 1);
          assert.equal(await page.getByText(/Automatic submission is closed/).count(), 1);
          assert.equal(await page.getByRole('button', { name: 'Download approved text' }).count(), 1);
          assert.ok(hosts.every(host => host === 'customer:8443'));
          console.log(`${actor.role}: HTTPS GET 200 and byte-exact keyboard download; terminal export, 1 audit, 0 attempts, 0 creates.`);
        } finally { await context.close(); }
      }
    } finally { await browser.close(); }
  });

  await t.test('repeat returns private plain text once authorized and releases nothing after access changes', async () => {
    const before = await counts(first);
    const repeat = await send(downloadPath(first.id));
    assert.equal(repeat.status, 200);
    assert.deepEqual(repeat.bytes, Buffer.from(approvedText));
    assert.equal(repeat.headers['content-type'], 'text/plain; charset=utf-8');
    assert.match(repeat.headers['content-disposition'] ?? '', /^attachment; filename=(?:approved-post\.txt|"approved-post\.txt")$/);
    assert.equal(repeat.headers['cache-control'], 'private, no-store');
    assert.equal(repeat.headers['x-content-type-options'], 'nosniff');
    assert.deepEqual(await counts(first), before);
    await db.query('UPDATE pilot.memberships SET active=false,version=version+1 WHERE tenant_id=$1 AND id=$2', [a.tenant, employee.membership]);
    await denied(first, 403);
    await db.query('UPDATE pilot.locations SET grant_active=true,version=version+1 WHERE tenant_id=$1 AND id=$2', [a.tenant, a.location]);
    await denied(second, 403, { cookie: cookieFor(manager), body: `csrf=${manager.csrf}` });
    const exportedPage = await send(occurrencePath(second.id), { method: 'GET', cookie: cookieFor(manager) });
    assert.equal(exportedPage.status, 200);
    assert.match(exportedPage.bytes.toString(), /<strong>Exported<\/strong>/);
    assert.doesNotMatch(exportedPage.bytes.toString(), /Download approved text/);
    const controlPage = await send(occurrencePath(control.id), { method: 'GET', cookie: cookieFor(outside) });
    assert.equal(controlPage.status, 200);
    assert.match(controlPage.bytes.toString(), /<strong>Approved<\/strong>/);
    assert.deepEqual(await counts(control), controlBefore);
    assert.deepEqual(await sessionTimes(), timesBefore);
    console.log('HTTPS repeat 200; malformed 400, forbidden 403, disabled 404; denied responses release zero approved bytes. Tenant control unchanged.');
  });
});
