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
    return { token, csrf };
  };
  const employee = await actor('Employee'), manager = await actor('Manager');
  const send = async (who: typeof employee, path: string, cookie = `__Host-session=${who.token}; __Host-csrf=${who.csrf}`, body?: string) =>
    new Promise<{ status: number; text: string }>((resolve, reject) => {
      const req = request({ hostname: '127.0.0.1', servername: 'customer', port: address.port, path, method: 'GET', ca,
        headers: { host: 'customer:8443', cookie, 'content-type': 'application/x-www-form-urlencoded', ...(body ? { 'content-length': Buffer.byteLength(body) } : {}) } }, res => {
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
        assert.ok(page.text.includes('<dd>held</dd>'));
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
        const page = await send(employee, `/customer/occurrences/${summer}`); assert.equal(page.status, 200);
        assert.ok(page.text.includes(instant)); assert.ok(page.text.includes('27 October 2030 at 02:30:00'));
        assert.deepEqual(await snapshot(), before);
      }
    });
  } finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); await db.end(); }
});
