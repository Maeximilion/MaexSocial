import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:https';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { chromium, type Browser } from 'playwright';
import { connectFixture } from '../../ops/local/fixture.js';
import { runPortalBrowserTest } from '../../ops/local/portal-browser.js';
import { createCustomerApp } from '../../apps/web/src/server/customer.js';
import { approveOccurrence, readApprovalProposal } from '../../apps/web/src/routes/content.js';
import { requireCustomerRequest } from '../../apps/web/src/server/request.js';
import { tokenHash } from '../../apps/web/src/server/session.js';
import { claimDispatch } from '../../apps/worker/src/dispatch.js';
import { reconcileOccurrence } from '../../apps/worker/src/reconcile.js';
import type { IdentityStatus } from '../../packages/contracts/pilot.js';
import { FakeGbp } from './fake-gbp.js';
import { occurrence as seedOccurrence, seedTenant } from './fixtures.js';

test('dashboard keyboard navigation, session rotation and edited publication in an isolated browser', async () => {
  if (process.env.PILOT_CONTAINER !== '1') { console.log(await runPortalBrowserTest()); return; }
  const endpoint = process.env.PORTAL_BROWSER_ENDPOINT; assert.ok(endpoint, 'Run through the isolated portal browser harness');
  const db = await connectFixture(); const now = new Date();
  const status: IdentityStatus = { subject: randomUUID(),
    verified: true, enabled: true, requiredActions: [], credentials: [{ id: 'synthetic-otp', type: 'otp' }] };
  const otherStatus: IdentityStatus = { ...status, subject: randomUUID(), credentials: [] };
  const clock = () => new Date();
  const inspect = async (subject: string) => subject === otherStatus.subject ? otherStatus : status;
  const app = createCustomerApp(connectFixture, inspect);
  const server = createServer({ cert: await readFile('work/pilot/customer.crt'), key: await readFile('work/pilot/customer.key') }, app);
  let browser: Browser | undefined;
  try {
    const connected = await chromium.connect(endpoint, { timeout: 5000 });
    browser = connected;
    const openEditorSession = async (identityId: string, tenantId: string, membershipId: string, mfa = false) => {
      const token = randomBytes(32).toString('hex'), csrf = randomBytes(32).toString('hex');
      await db.query(`INSERT INTO pilot.sessions(token_hash,csrf_hash,identity_id,identity_version,tenant_id,tenant_version,membership_id,membership_version,
        audience,created_at,last_seen_at,expires_at,mfa_at,mfa_credential_id)
        VALUES($1,$2,$3,1,$4,1,$5,1,'customer',$6,$6,$7,$8,$9)`, [tokenHash(token), tokenHash(csrf), identityId, tenantId, membershipId,
        now, new Date(now.getTime() + 28_800_000), mfa ? now : null, mfa ? 'synthetic-otp' : null]);
      const context = await connected.newContext();
      await context.addCookies([{ name: '__Host-session', value: token, url: 'https://customer:8443', secure: true, httpOnly: true, sameSite: 'Lax' },
        { name: '__Host-csrf', value: csrf, url: 'https://customer:8443', secure: true, httpOnly: true, sameSite: 'Lax' }]);
      return { context, token };
    };
    const identity = (await db.query("INSERT INTO pilot.identities(subject,verified) VALUES($1,true) RETURNING id", [status.subject])).rows[0].id;
    const tenants: string[] = []; const memberships: string[] = [];
    for (const name of ['Keyboard entry', 'Keyboard tenant A']) {
      const tenant = (await db.query('INSERT INTO pilot.tenants(name) VALUES($1) RETURNING id', [name])).rows[0].id; tenants.push(tenant);
      const role = name === 'Keyboard entry' ? 'Employee' : 'Manager';
      memberships.push((await db.query('INSERT INTO pilot.memberships(tenant_id,identity_id,role) VALUES($1,$2,$3) RETURNING id', [tenant, identity, role])).rows[0].id);
    }
    await new Promise<void>(r => server.listen(8443, '0.0.0.0', r));
    const tenantA = tenants[1]!;
    const tenantB = await seedTenant(db);
    const control = await seedOccurrence(db, tenantB);
    const controlSnapshot = async () => (await db.query(`SELECT to_jsonb(o) AS occurrence,
      (SELECT count(*)::int FROM pilot.approvals WHERE tenant_id=o.tenant_id AND occurrence_id=o.id) AS approvals,
      (SELECT count(*)::int FROM pilot.attempts WHERE tenant_id=o.tenant_id AND occurrence_id=o.id) AS attempts,
      (SELECT count(*)::int FROM pilot.audit WHERE tenant_id=o.tenant_id AND occurrence_id=o.id) AS audit
      FROM pilot.occurrences o WHERE o.tenant_id=$1 AND o.id=$2`, [tenantB.tenant, control])).rows;
    const controlBefore = await controlSnapshot();
    assert.equal(controlBefore.length, 1);
    const { context, token } = await openEditorSession(identity, tenants[0]!, memberships[0]!, true);
    const page = await context.newPage();
    const requests: string[] = []; page.on('request', request => requests.push(new URL(request.url()).hostname));
    const navigation = await page.goto('https://customer:8443/customer');
    assert.equal(navigation?.status(), 200, 'The customer document must load before keyboard assertions');
    assert.equal(await page.title(), 'Keyboard entry · MaexSocial');
    await page.keyboard.press('Tab'); assert.equal(await page.locator(':focus').textContent(), 'Skip to workspace');
    await page.keyboard.press('Enter'); assert.equal(await page.locator(':focus').getAttribute('id'), 'main');
    await page.keyboard.press('Tab'); assert.equal(await page.locator(':focus').getAttribute('id'), 'tenant');
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Tab'); assert.equal(await page.locator(':focus').textContent(), 'Switch workspace');
    assert.equal(await page.locator('#tenant option:checked').textContent(), 'Keyboard tenant A');
    const submitted = page.waitForResponse(response => new URL(response.url()).pathname === '/customer/switch', { timeout: 5000 });
    await page.keyboard.press('Enter'); const response = await submitted;
    assert.equal(await response.request().headerValue('origin'), 'https://customer:8443');
    assert.equal(response.status(), 303);
    await page.waitForFunction(() => document.title === 'Keyboard tenant A · MaexSocial', undefined, { timeout: 5000 });
    assert.notEqual((await context.cookies()).find(cookie => cookie.name === '__Host-session')!.value, token);
    await page.getByRole('link', { name: 'Text drafts', exact: true }).focus(); await page.keyboard.press('Enter');
    await page.waitForURL('https://customer:8443/customer/drafts', { timeout: 5000 });
    await page.getByRole('link', { name: 'New draft', exact: true }).focus(); await page.keyboard.press('Enter');
    await page.waitForURL('https://customer:8443/customer/drafts/new', { timeout: 5000 });
    assert.ok((await page.locator('main').textContent())!.includes('No locations are available'));
    assert.equal(await page.locator('form').count(), 0); assert.equal(await page.getByRole('button').count(), 0);
    await db.query("INSERT INTO pilot.locations(tenant_id,provider_location) VALUES($1,'Alternate workspace location')", [tenants[1]]);
    const destination = 'Keyboard <location> & context';
    const location = (await db.query<{ id: string }>(`INSERT INTO pilot.locations(tenant_id,provider_location,grant_active)
      VALUES($1,$2,true) RETURNING id`, [tenantA, destination])).rows[0]!.id;
    await db.query("INSERT INTO pilot.locations(tenant_id,provider_location) VALUES($1,'Foreign location canary')", [tenants[0]]);
    await page.reload();
    assert.deepEqual(await page.locator('#location option').allTextContents(), ['Alternate workspace location', 'Keyboard <location> & context']);
    await page.keyboard.press('Tab'); assert.equal(await page.locator(':focus').textContent(), 'Back to workspace');
    await page.keyboard.press('Tab'); assert.equal(await page.locator(':focus').getAttribute('id'), 'location');
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('#location').inputValue(), location);
    await page.keyboard.press('Tab'); assert.equal(await page.locator(':focus').getAttribute('id'), 'text');
    const originalText = '\n</textarea><script>literal</script>'.padEnd(1499, 'x') + '😀';
    const correctText = async (rejected: Awaited<ReturnType<typeof page.waitForResponse>>) => {
      assert.equal(rejected.status(), 400);
      assert.match((await rejected.headerValue('content-type'))!, /^text\/html\b/i);
      await page.waitForFunction(() => document.activeElement?.matches('#text[aria-invalid="true"]'), undefined, { timeout: 5000 });
      assert.equal(await page.locator('#text').inputValue(), originalText + 'x');
      assert.match((await page.locator('#text').getAttribute('aria-describedby'))!, /\btext-error\b/);
      assert.match((await page.locator('#text-error').textContent())!, /1–1,500 Unicode code points/);
      assert.equal(await page.locator('script').count(), 0);
      await page.keyboard.press('ControlOrMeta+End'); await page.keyboard.press('Backspace');
      assert.equal(await page.locator('#text').inputValue(), originalText);
    };
    await page.keyboard.insertText(originalText + 'x');
    await page.keyboard.press('Tab'); assert.equal(await page.locator(':focus').textContent(), 'Create draft');
    const rejected = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/customer/drafts', { timeout: 5000 });
    await page.keyboard.press('Enter'); await correctText(await rejected);
    assert.equal(await page.locator('#location').inputValue(), location);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM pilot.drafts WHERE tenant_id=$1', [tenants[1]])).rows[0].n, 0);
    await page.keyboard.press('Tab');
    assert.equal(await page.locator(':focus').textContent(), 'Create draft');
    const created = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === '/customer/drafts', { timeout: 5000 });
    await page.keyboard.press('Enter'); const creation = await created; assert.equal(creation.status(), 303);
    const draftPath = (await creation.allHeaders()).location!;
    await page.waitForURL(`https://customer:8443${draftPath}`, { timeout: 5000 });
    const draft = draftPath.split('/').at(-1)!;
    assert.equal((await db.query('SELECT initial_location_id FROM pilot.drafts WHERE tenant_id=$1 AND id=$2', [tenants[1], draft])).rows[0].initial_location_id, location);
    assert.ok((await page.locator('main').textContent())!.includes('Initial location: Keyboard <location> & context'));
    assert.equal(await page.locator('script').count(), 0);
    await page.reload();
    assert.equal(await page.locator('#text').inputValue(), originalText);
    await page.keyboard.press('Tab'); assert.equal(await page.locator(':focus').textContent(), 'Back to workspace');
    await page.keyboard.press('Tab'); assert.equal(await page.locator(':focus').getAttribute('id'), 'text');
    assert.equal(await page.locator('#text').getAttribute('aria-describedby'), 'text-help');
    await page.keyboard.press('ControlOrMeta+End'); await page.keyboard.insertText('x');
    await page.keyboard.press('Tab'); assert.equal(await page.locator(':focus').textContent(), 'Save text');
    const invalidEdit = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === draftPath, { timeout: 5000 });
    await page.keyboard.press('Enter'); await correctText(await invalidEdit);
    assert.deepEqual((await db.query('SELECT revision,text FROM pilot.draft_revisions WHERE tenant_id=$1 AND draft_id=$2', [tenants[1], draft])).rows,
      [{ revision: 1, text: originalText }]);
    await page.keyboard.press('Tab'); assert.equal(await page.locator(':focus').textContent(), 'Save text');
    const unchanged = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === `/customer/drafts/${draft}`, { timeout: 5000 });
    await page.keyboard.press('Enter'); assert.equal((await unchanged).status(), 303);
    await page.waitForFunction(() => document.body.textContent?.includes('Revision 2.'), undefined, { timeout: 5000 });
    assert.equal(await page.locator('#text').inputValue(), originalText);
    assert.equal((await db.query('SELECT length(text) AS size FROM pilot.draft_revisions WHERE tenant_id=$1 AND draft_id=$2 AND revision=2', [tenants[1], draft])).rows[0].size, 1500);
    const hours = 'Monday 09:00–17:00';
    const factsText = `Invented hours: ${hours}\n<script>literal</script> https://media.invalid/photo.jpg 😀`;
    const factOwner = await connectFixture(true);
    try {
      for (const [revision, text] of [[1, 'Old invented facts'], [2, factsText]] as const) {
        await factOwner.query(`INSERT INTO pilot.business_fact_revisions(tenant_id,location_id,revision,text,source_note,evidence_kind,membership_id,membership_version,confirmed_at)
          VALUES($1,$2,$3,$4,'Invented fixture source','synthetic_fixture',$5,1,'2020-01-01T12:00:00Z')`, [tenantA, location, revision, text, memberships[1]]);
      }
    } finally { await factOwner.end(); }
    assert.equal((await page.goto(`https://customer:8443/customer/facts/${location}`))?.status(), 200);
    assert.ok((await page.locator('main').textContent())!.includes(factsText));
    assert.equal((await page.goto(`https://customer:8443${draftPath}`))?.status(), 200);
    const otherIdentity = (await db.query('INSERT INTO pilot.identities(subject,verified) VALUES($1,true) RETURNING id', [otherStatus.subject])).rows[0].id;
    const otherMembership = (await db.query("INSERT INTO pilot.memberships(tenant_id,identity_id,role) VALUES($1,$2,'Employee') RETURNING id", [tenants[1], otherIdentity])).rows[0].id;
    const { context: otherContext } = await openEditorSession(otherIdentity, tenants[1]!, otherMembership);
    const otherPage = await otherContext.newPage();
    otherPage.on('request', request => requests.push(new URL(request.url()).hostname));
    const draftUrl = `https://customer:8443${draftPath}`;
    assert.equal((await otherPage.goto(draftUrl))?.status(), 200);
    assert.equal(await otherPage.locator('[name="revisionId"]').inputValue(), await page.locator('[name="revisionId"]').inputValue());
    const submittedText = '\n</textarea><script>literal</script>\nSecond editor 😀';
    await otherPage.locator('#text').focus(); await otherPage.keyboard.press('ControlOrMeta+A'); await otherPage.keyboard.insertText(submittedText);
    await otherPage.keyboard.press('Tab'); assert.equal(await otherPage.locator(':focus').textContent(), 'Save text');
    const savedText = `Our opening hours are ${hours}.\nSee you at the <orchard>.`;
    await page.locator('#text').focus(); await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.insertText(savedText);
    await page.keyboard.press('Tab'); assert.equal(await page.locator(':focus').textContent(), 'Save text');
    const edited = page.waitForResponse(response => response.request().method() === 'POST' && new URL(response.url()).pathname === `/customer/drafts/${draft}`, { timeout: 5000 });
    await page.keyboard.press('Enter'); assert.equal((await edited).status(), 303);
    await page.waitForFunction(() => document.body.textContent?.includes('Revision 3.'), undefined, { timeout: 5000 });
    assert.equal(await page.locator('#text').inputValue(), savedText);

    const conflict = otherPage.waitForResponse(response => response.request().method() === 'POST' && response.url() === draftUrl, { timeout: 5000 });
    await otherPage.keyboard.press('Enter'); const conflictResponse = await conflict;
    assert.equal(conflictResponse.status(), 409);
    assert.match((await conflictResponse.headerValue('content-type'))!, /^text\/html\b/i);
    await otherPage.getByRole('heading', { name: 'This draft changed', exact: true }).waitFor({ timeout: 5000 });
    const saved = otherPage.getByRole('textbox', { name: 'Saved text · Revision 3' });
    const unsaved = otherPage.getByRole('textbox', { name: 'Your unsaved text' });
    assert.equal(await saved.inputValue(), savedText);
    assert.equal(await unsaved.inputValue(), submittedText);
    assert.equal(await saved.isEditable(), false);
    assert.equal(await unsaved.isEditable(), false);
    assert.equal(await otherPage.locator('script, form').count(), 0);
    await otherPage.keyboard.press('Tab'); assert.equal(await otherPage.locator(':focus').textContent(), 'Back to workspace');
    await otherPage.keyboard.press('Tab'); assert.equal(await saved.evaluate(element => element === document.activeElement), true);
    await otherPage.keyboard.press('Tab'); assert.equal(await unsaved.evaluate(element => element === document.activeElement), true);
    await otherPage.keyboard.press('ControlOrMeta+A');
    assert.equal(await unsaved.evaluate(element => element instanceof HTMLTextAreaElement
      ? element.value.slice(element.selectionStart, element.selectionEnd) : null), submittedText);
    await otherPage.keyboard.press('Tab'); assert.equal(await otherPage.locator(':focus').textContent(), 'Open current draft');
    const reopened = otherPage.waitForResponse(response => response.request().method() === 'GET' && response.url() === draftUrl, { timeout: 5000 });
    await otherPage.keyboard.press('Enter'); assert.equal((await reopened).status(), 200);
    await otherPage.getByRole('heading', { name: 'Edit text draft', exact: true }).waitFor({ timeout: 5000 });
    assert.equal(await otherPage.locator('#text').inputValue(), savedText);
    assert.equal(await otherPage.locator('[name="revisionId"]').inputValue(), await page.locator('[name="revisionId"]').inputValue());
    await otherContext.close();
    assert.deepEqual((await db.query('SELECT revision,text FROM pilot.draft_revisions WHERE tenant_id=$1 AND draft_id=$2 ORDER BY revision', [tenants[1], draft])).rows,
      [{ revision: 1, text: originalText }, { revision: 2, text: originalText }, { revision: 3, text: savedText }]);
    await page.screenshot({ path: '/artifacts/draft.png', fullPage: true });
    const revisionId = await page.locator('[name="revisionId"]').inputValue();
    const occurrence = (await db.query<{ id: string }>(`INSERT INTO pilot.occurrences(tenant_id,draft_id,location_id,creation_key,due_at,timezone)
      VALUES($1,$2,$3,$4,'2020-01-01T12:00:00Z','Europe/Berlin') RETURNING id`, [tenantA, draft, location, randomUUID()])).rows[0]!.id;
    const occurrenceUrl = `https://customer:8443/customer/occurrences/${occurrence}`;
    await page.reload();
    await page.getByRole('button', { name: 'Save text' }).focus(); await page.keyboard.press('Tab');
    assert.equal(await page.locator(':focus').getAttribute('href'), `/customer/occurrences/${occurrence}`);
    await page.keyboard.press('Enter');
    await page.waitForURL(occurrenceUrl, { timeout: 5000 });
    assert.equal(await page.getByRole('heading', { name: 'Post occurrence details', exact: true }).count(), 1);
    const proposal = page.getByRole('region', { name: 'Proposed text · Revision 3' });
    assert.ok((await proposal.textContent())!.includes(savedText));
    assert.ok((await proposal.textContent())!.includes(destination));
    assert.ok((await proposal.textContent())!.includes('1 January 2020 at 13:00:00'));
    assert.equal(await proposal.locator('time').getAttribute('datetime'), '2020-01-01T12:00:00.000Z');
    assert.equal(await page.locator('form').count(), 0);
    await page.screenshot({ path: '/artifacts/occurrence.png', fullPage: true });
    await page.keyboard.press('Tab'); assert.equal(await page.locator(':focus').textContent(), 'Back to workspace');
    await page.keyboard.press('Tab'); assert.equal(await page.locator(':focus').textContent(), 'Back to draft');
    await page.keyboard.press('Enter');
    await page.waitForURL(`https://customer:8443${draftPath}`, { timeout: 5000 });

    // The rotated browser binding authorizes the private proposal and approval.
    const cookies = await context.cookies(occurrenceUrl);
    const session = cookies.find(cookie => cookie.name === '__Host-session');
    const csrf = cookies.find(cookie => cookie.name === '__Host-csrf');
    assert.ok(session && csrf);
    const binding = { token: session.value, csrf: csrf.value };
    await db.query('BEGIN');
    const approvalProposal = await (async () => {
      try {
        return await readApprovalProposal(db, await requireCustomerRequest(db, binding, clock, inspect, 'read-only'), occurrence);
      } finally { await db.query('ROLLBACK'); }
    })();
    assert.deepEqual([approvalProposal.tenantId, approvalProposal.membershipId, approvalProposal.occurrenceId,
      approvalProposal.draftId, approvalProposal.revisionId, approvalProposal.locationId, approvalProposal.providerLocation],
    [tenantA, memberships[1], occurrence, draft, revisionId, location, destination]);
    const approvalId = await approveOccurrence(connectFixture, binding, approvalProposal, clock, inspect);

    const providerDirectory = await mkdtemp(join('/dev/shm', 'maex-portal-'));
    let providerTime: number | undefined;
    const providerClock = () => providerTime ??= Date.now();
    try {
      const { stopped } = (await db.query<{ stopped: boolean }>('SELECT stopped FROM pilot.dispatch_control')).rows[0]!;
      const sending = new FakeGbp(providerDirectory, { clock: providerClock, frames: [
        { afterMs: 0, candidates: ['PROCESSING'] }, { afterMs: 1000, candidates: ['LIVE'] },
      ] });
      const claim = await (async () => {
        try {
          await db.query('UPDATE pilot.dispatch_control SET stopped=false WHERE singleton');
          return await claimDispatch(connectFixture, occurrence, sending);
        } finally {
          sending.close();
          await db.query('UPDATE pilot.dispatch_control SET stopped=$1 WHERE singleton', [stopped]);
        }
      })();
      assert.equal(claim.state, 'in_flight');
      const { attemptId } = claim;
      const sqlite = new DatabaseSync(join(providerDirectory, 'fake-gbp.sqlite'), { readOnly: true });
      let resourceName: string;
      try {
        assert.equal(sqlite.prepare('SELECT count(*) AS total FROM calls').get()?.total, 1);
        const [stored] = sqlite.prepare('SELECT calls.id, intent FROM call_intents JOIN calls ON id=call_id').all();
        assert.ok(stored);
        const intent = JSON.parse(String(stored.intent));
        assert.deepEqual([intent.tenantId, intent.occurrenceId, intent.approvalId, intent.attemptId, intent.revisionId,
          intent.locationId, intent.location, intent.text], [tenantA, occurrence, approvalId, attemptId, revisionId, location, destination, savedText]);
        resourceName = `${destination}/localPosts/fake-${stored.id}-0`;
      } finally { sqlite.close(); }

      const fake = new FakeGbp(providerDirectory, { clock: providerClock });
      try {
        const assertStored = async (state: 'pending' | 'confirmed', resource: string | null) => {
          const observedAt = new Date(providerClock());
          assert.deepEqual((await db.query(`SELECT o.state,o.approval_id,a.id,a.outcome,a.resource_name,a.observed_at
            FROM pilot.occurrences o JOIN pilot.attempts a ON a.tenant_id=o.tenant_id AND a.occurrence_id=o.id
            WHERE o.tenant_id=$1 AND o.id=$2 AND a.approval_id=o.approval_id`, [tenantA, occurrence])).rows,
          [{ state, approval_id: approvalId, id: attemptId, outcome: state, resource_name: resource, observed_at: observedAt }]);
          return observedAt.toISOString();
        };
        assert.equal(await reconcileOccurrence(connectFixture, occurrence, fake), 'pending');
        const processingAt = await assertStored('pending', null);
        await page.getByRole('button', { name: 'Save text' }).focus(); await page.keyboard.press('Tab');
        assert.equal(await page.locator(':focus').getAttribute('href'), `/customer/occurrences/${occurrence}`);
        const observed = page.waitForResponse(response => response.request().method() === 'GET' && response.url() === occurrenceUrl, { timeout: 5000 });
        await page.keyboard.press('Enter');
        assert.equal((await observed).status(), 200);
        await page.waitForURL(occurrenceUrl, { timeout: 5000 });
        assert.equal(await page.getByText('Processing', { exact: true }).count(), 1);
        assert.equal(await page.locator(`dt:text-is("Last observation (UTC)") + dd time[datetime="${processingAt}"]`).count(), 1);

        providerTime = providerClock() + 1000;
        assert.equal(await reconcileOccurrence(connectFixture, occurrence, fake), 'confirmed');
        const liveAt = await assertStored('confirmed', resourceName);
        assert.equal((await page.reload())?.status(), 200);
        assert.equal(await page.getByText('Publication confirmed', { exact: true }).count(), 1);
        assert.equal(await page.locator(`dt:text-is("Last observation (UTC)") + dd time[datetime="${liveAt}"]`).count(), 1);
        assert.equal(await page.getByRole('button').count(), 0);
        await page.screenshot({ path: '/artifacts/occurrence-outcome.png', fullPage: true });
        assert.equal(fake.createCount(tenantA, occurrence), 1);
        assert.equal(fake.createCount(tenantB.tenant, control), 0);
        assert.deepEqual(await controlSnapshot(), controlBefore);
        assert.deepEqual((await db.query(`SELECT
          (SELECT count(*)::int FROM pilot.approvals WHERE tenant_id=$1 AND occurrence_id=$2) AS approvals,
          (SELECT count(*)::int FROM pilot.attempts WHERE tenant_id=$1 AND occurrence_id=$2) AS attempts,
          (SELECT count(*)::int FROM pilot.audit WHERE tenant_id=$1 AND occurrence_id=$2 AND action='occurrence_export') AS exports`,
        [tenantA, occurrence])).rows, [{ approvals: 1, attempts: 1, exports: 0 }]);
        console.log('PLAN-01/03: HTTPS editor 303; protected result GETs 200 / 200; one approval, one attempt, one fake create, zero exports; tenant B unchanged.');
      } finally { fake.close(); }
    } finally { await rm(providerDirectory, { recursive: true, force: true }); }
    await page.keyboard.press('Tab'); assert.equal(await page.locator(':focus').textContent(), 'Back to workspace');
    await page.keyboard.press('Tab'); assert.equal(await page.locator(':focus').textContent(), 'Back to draft');
    await page.keyboard.press('Enter');
    await page.waitForURL(`https://customer:8443${draftPath}`, { timeout: 5000 });
    await page.getByRole('link', { name: 'Back to workspace' }).focus(); await page.keyboard.press('Enter');
    await page.waitForURL('https://customer:8443/customer', { timeout: 5000 });
    const emptyLocation = (await db.query("INSERT INTO pilot.locations(tenant_id,provider_location) VALUES($1,'Empty facts location') RETURNING id", [tenants[1]])).rows[0].id;
    await page.getByRole('link', { name: 'Business facts', exact: true }).focus(); await page.keyboard.press('Enter');
    await page.waitForURL('https://customer:8443/customer/facts', { timeout: 5000 });
    assert.equal(await page.getByRole('heading', { name: 'Business facts', exact: true }).count(), 1);
    assert.ok((await page.locator('main').textContent())!.includes(factsText));
    assert.ok((await page.locator('main').textContent())!.includes('Revision 2'));
    assert.ok((await page.locator('main').textContent())!.includes('Simulated fixture confirmation'));
    assert.ok(!(await page.locator('main').textContent())!.includes('Old invented facts'));
    assert.equal(await page.locator('script, img, video, audio, form, a[href^="https:"]').count(), 0);
    await page.getByRole('link', { name: 'Keyboard <location> & context', exact: true }).focus(); await page.keyboard.press('Enter');
    await page.waitForURL(`https://customer:8443/customer/facts/${location}`, { timeout: 5000 });
    await page.screenshot({ path: '/artifacts/facts.png', fullPage: true });
    await page.getByRole('link', { name: 'All business facts' }).focus(); await page.keyboard.press('Enter');
    await page.waitForURL('https://customer:8443/customer/facts', { timeout: 5000 });
    await page.getByRole('link', { name: 'Empty facts location', exact: true }).focus(); await page.keyboard.press('Enter');
    await page.waitForURL(`https://customer:8443/customer/facts/${emptyLocation}`, { timeout: 5000 });
    assert.ok((await page.locator('main').textContent())!.includes('No business facts yet'));
    await page.getByRole('link', { name: 'Text drafts', exact: true }).focus(); await page.keyboard.press('Enter');
    await page.waitForURL('https://customer:8443/customer/drafts', { timeout: 5000 });
    await page.getByRole('link', { name: 'Back to workspace' }).focus(); await page.keyboard.press('Enter');
    await page.waitForURL('https://customer:8443/customer', { timeout: 5000 });
    assert.ok(requests.every(host => host === 'customer'), 'No IdP or external request belongs to this dashboard-only test');
    await page.screenshot({ path: '/artifacts/dashboard.png', fullPage: true });
    await page.getByRole('button', { name: 'Sign out' }).focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.title === 'Signed out · MaexSocial', undefined, { timeout: 5000 });
    assert.equal(await page.getByRole('heading', { name: 'You are signed out' }).count(), 1);
    assert.ok(!(await context.cookies()).some(cookie => ['__Host-session', '__Host-csrf'].includes(cookie.name)));
    await context.close();
  } finally { await db.end(); await browser?.close(); server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); }
});
