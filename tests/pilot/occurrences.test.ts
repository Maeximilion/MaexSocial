import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer, request } from 'node:https';
import { test } from 'node:test';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';
import { createCustomerApp } from '../../apps/web/src/server/customer.js';
import { tokenHash } from '../../apps/web/src/server/session.js';
import { occurrence, seedTenant } from './fixtures.js';

test('stored occurrence details preserve active-tenant authority and domain records', async t => {
  if (process.env.PILOT_CONTAINER !== '1') { console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/occurrences.test.js'])); return; }
  const db = await connectFixture();
  const a = await seedTenant(db), b = await seedTenant(db);
  const winter = await occurrence(db, a), summer = await occurrence(db, a), foreign = await occurrence(db, b);
  const destination = 'Stored destination <script>alert("x")</script> & branch';
  const target = (await db.query('INSERT INTO pilot.locations(tenant_id,provider_location) VALUES($1,$2) RETURNING id', [a.tenant, destination])).rows[0].id;
  await db.query('UPDATE pilot.drafts SET initial_location_id=$1 WHERE tenant_id=$2 AND id=$3', [a.location, a.tenant, a.draft]);
  await db.query("UPDATE pilot.occurrences SET location_id=$1,state='held' WHERE tenant_id=$2 AND id=$3", [target, a.tenant, winter]);
  await db.query("UPDATE pilot.occurrences SET due_at='2030-07-01T12:00:00Z' WHERE tenant_id=$1 AND id=$2", [a.tenant, summer]);
  let status: 'active' | 'disabled' | 'unverified' | 'required' | 'mismatch' | 'unavailable' = 'active';
  let inspections = 0;
  const app = createCustomerApp(connectFixture, async subject => {
    inspections++;
    if (status === 'unavailable') throw new Error('Synthetic outage');
    return { subject: status === 'mismatch' ? randomUUID() : subject, enabled: status !== 'disabled',
      verified: status !== 'unverified', requiredActions: status === 'required' ? ['UPDATE_PASSWORD'] : [], credentials: [] };
  });
  const ca = await readFile('work/pilot/customer.crt');
  const server = createServer({ cert: ca, key: await readFile('work/pilot/customer.key') }, app);
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const actor = async (role: string) => {
    const subject = randomUUID(), token = randomBytes(32).toString('hex'), csrf = randomBytes(32).toString('hex');
    const identity = (await db.query('INSERT INTO pilot.identities(subject,verified) VALUES($1,true) RETURNING id', [subject])).rows[0].id;
    const membership = (await db.query('INSERT INTO pilot.memberships(tenant_id,identity_id,role) VALUES($1,$2,$3) RETURNING id', [a.tenant, identity, role])).rows[0].id;
    await db.query("INSERT INTO pilot.memberships(tenant_id,identity_id,role) VALUES($1,$2,'Manager')", [b.tenant, identity]);
    await db.query(`INSERT INTO pilot.sessions(token_hash,csrf_hash,identity_id,identity_version,tenant_id,tenant_version,membership_id,membership_version,audience,created_at,last_seen_at,expires_at)
      VALUES($1,$2,$3,1,$4,1,$5,1,'customer',now(),now(),now()+interval '8 hours')`, [tokenHash(token), tokenHash(csrf), identity, a.tenant, membership]);
    return { token, csrf, membership };
  };
  const employee = await actor('Employee'), manager = await actor('Manager');
  const send = async (who: typeof employee, path: string, cookie = `__Host-session=${who.token}; __Host-csrf=${who.csrf}`, body?: string, method = 'GET') =>
    new Promise<{ status: number; text: string }>((resolve, reject) => {
      const req = request({ hostname: '127.0.0.1', servername: 'customer', port: address.port, path, method, ca,
        headers: { host: 'customer:8443', cookie, origin: 'https://customer:8443', 'content-type': 'application/x-www-form-urlencoded', ...(body ? { 'content-length': Buffer.byteLength(body) } : {}) } }, res => {
        let text = ''; res.setEncoding('utf8'); res.on('data', chunk => text += chunk);
        res.on('end', () => resolve({ status: res.statusCode!, text }));
      }); req.on('error', reject); req.end(body);
    });
  const path = `/customer/occurrences/${winter}`;
  const snapshot = async () => {
    const result: Record<string, unknown> = {};
    for (const table of ['drafts', 'draft_revisions', 'occurrences', 'approvals', 'attempts', 'locations', 'audit', 'budget_reservations']) {
      result[table] = (await db.query(`SELECT to_jsonb(t) AS row FROM pilot.${table} t WHERE tenant_id=ANY($1::uuid[]) ORDER BY to_jsonb(t)::text`, [[a.tenant, b.tenant]])).rows;
    }
    return result;
  };
  try {
    await t.test('both roles follow destination links and return to the draft; stored values are escaped', async () => {
      const before = await snapshot();
      for (const who of [employee, manager]) {
        const draft = await send(who, `/customer/drafts/${a.draft}`); assert.equal(draft.status, 200);
        assert.ok(draft.text.includes(`href="${path}"`));
        const page = await send(who, path); assert.equal(page.status, 200);
        assert.match(page.text, /<h1>Post occurrence details<\/h1>/);
        assert.match(page.text, /<strong>Held<\/strong>/);
        assert.ok(page.text.includes('Stored destination &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; branch'));
        assert.ok(!page.text.includes('<script>')); assert.ok(!page.text.includes('fake-location'));
        assert.ok(!page.text.includes('Invented plain text')); assert.ok(!page.text.includes('<form'));
        assert.ok(page.text.includes('2030-01-01T12:00:00.000Z'));
        assert.ok(page.text.includes('Europe/Berlin')); assert.ok(page.text.includes('1 January 2030 at 13:00:00'));
        const back = page.text.match(/href="([^\"]+)">Back to draft/); assert.equal(back?.[1], `/customer/drafts/${a.draft}`);
        assert.equal((await send(who, back![1]!)).status, 200);
        const july = await send(who, `/customer/occurrences/${summer}`); assert.equal(july.status, 200);
        assert.ok(july.text.includes('2030-07-01T12:00:00.000Z')); assert.ok(july.text.includes('1 July 2030 at 14:00:00'));
      }
      assert.deepEqual(await snapshot(), before);
    });
    await t.test('only a current Manager sees the latest proposed revision with the actual destination and times', async () => {
      const previewPath = `/customer/occurrences/${summer}`;
      await db.query('UPDATE pilot.occurrences SET location_id=$1 WHERE tenant_id=$2 AND id=$3', [target, a.tenant, summer]);
      const beforeEdit = await snapshot();
      const original = await send(manager, previewPath);
      assert.equal(original.status, 200);
      assert.ok(original.text.includes('Proposed text · Revision 1'));
      assert.ok(original.text.includes('Invented plain text'));
      assert.equal((await send(manager, `${previewPath}/approval`, undefined,
        new URLSearchParams({ csrf: manager.csrf, revisionId: a.revision }).toString(), 'POST')).status, 404);
      assert.deepEqual(await snapshot(), beforeEdit);

      const revision = { revisionId: a.revision, csrf: employee.csrf, text: 'Updated <b>literal</b> & text\nSecond line' };
      assert.equal((await send(employee, `/customer/drafts/${a.draft}`, undefined, new URLSearchParams(revision).toString(), 'POST')).status, 303);
      const beforeReads = await snapshot();
      const preview = await send(manager, previewPath);
      assert.equal(preview.status, 200);
      assert.ok(preview.text.includes('Proposed text · Revision 2'));
      assert.ok(preview.text.includes('Updated &lt;b&gt;literal&lt;/b&gt; &amp; text\nSecond line'));
      assert.ok(preview.text.includes('Stored destination &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; branch'));
      assert.ok(preview.text.includes('Europe/Berlin') && preview.text.includes('1 July 2030 at 14:00:00'));
      assert.ok(preview.text.includes('2030-07-01T12:00:00.000Z'));
      assert.doesNotMatch(preview.text, /Invented plain text|fake-location|<b>literal|<form|<button/);
      const employeeView = await send(employee, `${previewPath}?role=Manager`);
      assert.equal(employeeView.status, 200);
      assert.doesNotMatch(employeeView.text, /Proposed text|Updated/);
      assert.ok(employeeView.text.includes('2030-07-01T12:00:00.000Z'));
      assert.equal((await send(manager, `/customer/occurrences/${foreign}`)).status, 403);
      assert.deepEqual(await snapshot(), beforeReads);
    });
    await t.test('only an unapproved draft with no attempt has a proposal', async () => {
      const unavailable = await occurrence(db, a), claimed = await occurrence(db, a);
      const approve = async (id: string) => (await db.query(`INSERT INTO pilot.approvals
        (tenant_id,occurrence_id,draft_id,revision_id,location_id,membership_id,membership_version,grant_version,due_at,timezone,mfa_at)
        SELECT tenant_id,id,draft_id,$3,location_id,$4,1,1,due_at,timezone,now() FROM pilot.occurrences
        WHERE tenant_id=$1 AND id=$2 RETURNING id`, [a.tenant, id, a.revision, a.membership])).rows[0].id;
      const approval = await approve(unavailable), claimedApproval = await approve(claimed);
      await db.query('UPDATE pilot.occurrences SET approval_id=$1 WHERE tenant_id=$2 AND id=$3', [approval, a.tenant, unavailable]);
      await db.query('INSERT INTO pilot.attempts(tenant_id,occurrence_id,approval_id) VALUES($1,$2,$3)', [a.tenant, claimed, claimedApproval]);
      const before = await snapshot();
      for (const id of [unavailable, claimed, winter]) {
        const view = await send(manager, `/customer/occurrences/${id}`);
        assert.equal(view.status, 200);
        assert.doesNotMatch(view.text, /Proposed text|Updated|Invented plain text/);
      }
      assert.deepEqual(await snapshot(), before);
    });
    await t.test('stored publication evidence is read independently without writes or inferred success', async () => {
      const claimedAt = '2030-01-01T12:01:00.000Z', observedAt = '2030-01-01T12:04:00.000Z';
      const cases = [
        { state: 'held', label: 'Held' },
        { state: 'approved', label: 'Approved' },
        { state: 'quarantined', label: 'Under review' },
        { state: 'exported', label: 'Exported', detail: /manual posting.*No Google publication was confirmed/ },
        { state: 'in_flight', label: 'Submitting', outcome: 'unknown' },
        { state: 'pending', label: 'Processing', outcome: 'pending', observed: true },
        { state: 'rejected', label: 'Rejected', outcome: 'rejected', observed: true },
        { state: 'confirmed', label: 'Publication confirmed', outcome: 'confirmed', observed: true },
        { state: 'unknown', label: 'Outcome unknown', outcome: 'unknown', observed: true },
        { state: 'in_flight', label: 'Outcome unknown' },
        { state: 'confirmed', label: 'Outcome unknown' },
        { state: 'confirmed', label: 'Outcome unknown', outcome: 'confirmed' },
        { state: 'confirmed', label: 'Outcome unknown', outcome: 'pending', observed: true },
        { state: 'confirmed', label: 'Outcome unknown', outcome: 'confirmed', observed: true, unboundApproval: true },
      ];
      const targets = [];
      for (const item of cases) {
        const id = await occurrence(db, a);
        await db.query('UPDATE pilot.occurrences SET state=$1 WHERE tenant_id=$2 AND id=$3', [item.state, a.tenant, id]);
        if (item.outcome) {
          const approval = (await db.query(`INSERT INTO pilot.approvals
            (tenant_id,occurrence_id,draft_id,revision_id,location_id,membership_id,membership_version,grant_version,due_at,timezone,mfa_at)
            SELECT tenant_id,id,draft_id,$3,location_id,$4,1,1,due_at,timezone,now() FROM pilot.occurrences
            WHERE tenant_id=$1 AND id=$2 RETURNING id`, [a.tenant, id, a.revision, a.membership])).rows[0].id;
          if (!item.unboundApproval) {
            await db.query('UPDATE pilot.occurrences SET approval_id=$1 WHERE tenant_id=$2 AND id=$3', [approval, a.tenant, id]);
          }
          await db.query(`INSERT INTO pilot.attempts(tenant_id,occurrence_id,approval_id,claimed_at,outcome,observed_at)
            VALUES($1,$2,$3,$4,$5,$6)`, [a.tenant, id, approval, claimedAt, item.outcome, item.observed ? observedAt : null]);
        }
        targets.push({ ...item, id });
      }
      const before = await snapshot();
      const sessions = () => db.query('SELECT id,last_seen_at FROM pilot.sessions WHERE tenant_id=$1 ORDER BY id', [a.tenant]);
      const beforeSessions = (await sessions()).rows;
      for (const who of [employee, manager]) {
        for (const item of targets) {
          const view = await send(who, `/customer/occurrences/${item.id}`);
          assert.equal(view.status, 200);
          assert.ok(view.text.includes(`<strong>${item.label}</strong>`), `Expected ${item.label} for ${item.state}/${item.outcome}`);
          if (item.detail) assert.match(view.text, item.detail);
          if (item.label === 'Outcome unknown') {
            assert.match(view.text, /Resolve the original attempt before retrying or posting manually/);
            assert.doesNotMatch(view.text, /<strong>Publication confirmed<\/strong>/);
          }
          assert.equal(view.text.includes(`<time datetime="${claimedAt}">`), Boolean(item.outcome));
          assert.equal(view.text.includes(`<time datetime="${observedAt}">`), Boolean(item.observed));
          assert.equal(view.text.includes('Last observation (UTC)'), Boolean(item.observed));
          assert.doesNotMatch(view.text, /Proposed text|Updated|Invented plain text|<form|<button/);
        }
      }
      assert.deepEqual(await snapshot(), before);
      assert.deepEqual((await sessions()).rows, beforeSessions);
    });
    await t.test('a stored draft without a text revision retains the status page', async () => {
      const draft = (await db.query('INSERT INTO pilot.drafts(tenant_id) VALUES($1) RETURNING id', [a.tenant])).rows[0].id;
      const id = await occurrence(db, { ...a, draft });
      const before = await snapshot();
      const view = await send(manager, `/customer/occurrences/${id}`);
      assert.equal(view.status, 200);
      assert.match(view.text, /<strong>Draft<\/strong>/);
      assert.doesNotMatch(view.text, /Proposed text|Revision/);
      assert.deepEqual(await snapshot(), before);
    });
    await t.test('foreign and unknown IDs deny equally despite second membership and forged authority input', async () => {
      const before = await snapshot();
      for (const who of [employee, manager]) {
        const denied = await send(who, `/customer/occurrences/${foreign}`);
        assert.equal(denied.status, 403);
        assert.deepEqual(await send(who, `/customer/occurrences/${randomUUID()}`), denied);
        for (const id of ['not-a-uuid', a.draft, '%27OR%201=1', 'undefined']) assert.deepEqual(await send(who, `/customer/occurrences/${id}`), denied);
        assert.deepEqual(await send(who, `/customer/occurrences/${foreign}?tenantId=${b.tenant}&role=Manager&subject=other`), denied);
        assert.deepEqual(await send(who, `/customer/occurrences/${foreign}`, undefined, `tenantId=${b.tenant}&role=Manager&subject=other`), denied);
        const own = await send(who, path);
        assert.deepEqual(await send(who, `${path}?tenantId=${b.tenant}&role=Admin&subject=other`), own);
        assert.deepEqual(await send(who, path, undefined, `tenantId=${b.tenant}&role=Admin&subject=other`), own);
        for (const cookie of ['', `__Host-session=${'0'.repeat(64)}; __Host-csrf=${who.csrf}`, `__Host-session=invalid; __Host-csrf=${who.csrf}`, `__Host-session=${who.token}; __Host-csrf=${'0'.repeat(64)}`]) {
          assert.deepEqual(await send(who, path, cookie), denied);
        }
      }
      assert.deepEqual(await snapshot(), before);
    });
    await t.test('every read retains the inherited identity status check', async () => {
      const before = await snapshot();
      for (const state of ['disabled', 'unverified', 'required', 'mismatch', 'unavailable'] as const) {
        status = state;
        const count = inspections;
        const denied = await send(employee, path);
        assert.ok([403, 503].includes(denied.status)); assert.ok(!denied.text.includes(destination));
        assert.equal(inspections, count + 1);
        status = 'active'; assert.equal((await send(employee, path)).status, 200);
      }
      assert.deepEqual(await snapshot(), before);
    });
    await t.test('repeated DST wall times retain distinct UTC instants', async () => {
      for (const instant of ['2030-10-27T00:30:00.000Z', '2030-10-27T01:30:00.000Z']) {
        await db.query('UPDATE pilot.occurrences SET due_at=$1 WHERE tenant_id=$2 AND id=$3', [instant, a.tenant, summer]);
        const before = await snapshot();
        const page = await send(manager, `/customer/occurrences/${summer}`); assert.equal(page.status, 200);
        assert.ok(page.text.includes(instant)); assert.ok(page.text.includes('27 October 2030 at 02:30:00'));
        assert.match(page.text, instant.includes('T00:') ? /02:30:00 (?:CEST|GMT\+2)/ : /02:30:00 (?:CET|GMT\+1)/);
        assert.ok(page.text.includes('Proposed text · Revision 2'));
        assert.deepEqual(await snapshot(), before);
      }
    });
    await t.test('unavailable stored time fails closed and demotion invalidates the prior Manager session', async () => {
      const previewPath = `/customer/occurrences/${summer}`;
      await db.query("UPDATE pilot.occurrences SET timezone='Fixture/Unavailable' WHERE tenant_id=$1 AND id=$2", [a.tenant, summer]);
      const before = await snapshot();
      const unavailable = await send(manager, previewPath);
      assert.equal(unavailable.status, 503);
      assert.doesNotMatch(unavailable.text, /Proposed text|Updated/);
      assert.deepEqual(await snapshot(), before);
      await db.query("UPDATE pilot.occurrences SET timezone='Europe/Berlin' WHERE tenant_id=$1 AND id=$2", [a.tenant, summer]);
      await db.query("UPDATE pilot.memberships SET role='Employee',version=version+1 WHERE tenant_id=$1 AND id=$2", [a.tenant, manager.membership]);
      const afterDemotion = await snapshot();
      assert.equal((await send(manager, previewPath)).status, 403);
      assert.deepEqual(await snapshot(), afterDemotion);
    });
  } finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); await db.end(); }
});
