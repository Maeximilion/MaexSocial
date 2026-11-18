import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer, request } from 'node:https';
import { test } from 'node:test';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';
import { createCustomerApp } from '../../apps/web/src/server/customer.js';
import { tokenHash } from '../../apps/web/src/server/session.js';
import { occurrence, seedTenant } from './fixtures.js';

test('business facts remain synthetic, immutable and scoped to current tenant authority', async t => {
  if (process.env.PILOT_CONTAINER !== '1') { console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/facts.test.js'])); return; }
  const db = await connectFixture(true), appDb = await connectFixture();
  const a = await seedTenant(db), b = await seedTenant(db);
  const existing = await occurrence(db, a); await occurrence(db, b);
  const approval = (await db.query(`INSERT INTO pilot.approvals(tenant_id,occurrence_id,draft_id,revision_id,location_id,
    membership_id,membership_version,grant_version,due_at,timezone,mfa_at)
    VALUES($1,$2,$3,$4,$5,$6,1,1,'2030-01-01T12:00:00Z','Europe/Berlin',now()) RETURNING id`,
  [a.tenant, existing, a.draft, a.revision, a.location, a.membership])).rows[0].id;
  await db.query("UPDATE pilot.occurrences SET approval_id=$1,state='approved' WHERE id=$2", [approval, existing]);
  let identityState = 'active';
  const app = createCustomerApp(connectFixture, async subject => {
    if (identityState === 'unavailable') throw new Error('Synthetic outage');
    return { subject: identityState === 'mismatch' ? 'other' : subject, enabled: identityState !== 'disabled',
      verified: identityState !== 'unverified', requiredActions: identityState === 'required' ? ['UPDATE_PASSWORD'] : [], credentials: [] };
  });
  const ca = await readFile('work/pilot/customer.crt');
  const server = createServer({ cert: ca, key: await readFile('work/pilot/customer.key') }, app);
  await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const actor = async (role: string, tenant = a.tenant) => {
    const token = randomBytes(32).toString('hex'), csrf = randomBytes(32).toString('hex');
    const identity = (await db.query('INSERT INTO pilot.identities(subject,verified) VALUES($1,true) RETURNING id', [randomUUID()])).rows[0].id;
    const membership = (await db.query('INSERT INTO pilot.memberships(tenant_id,identity_id,role) VALUES($1,$2,$3) RETURNING id', [tenant, identity, role])).rows[0].id;
    await db.query("INSERT INTO pilot.memberships(tenant_id,identity_id,role) VALUES($1,$2,'Manager')", [tenant === a.tenant ? b.tenant : a.tenant, identity]);
    await db.query(`INSERT INTO pilot.sessions(token_hash,csrf_hash,identity_id,identity_version,tenant_id,tenant_version,membership_id,membership_version,audience,created_at,last_seen_at,expires_at)
      VALUES($1,$2,$3,1,$4,1,$5,1,'customer',now(),now(),now()+interval '8 hours')`, [tokenHash(token), tokenHash(csrf), identity, tenant, membership]);
    return { token, csrf, identity, membership };
  };
  const employee = await actor('Employee'), manager = await actor('Manager'), readerB = await actor('Employee', b.tenant);
  const send = async (who: typeof employee, path = '/customer/facts', method = 'GET', cookie = `__Host-session=${who.token}; __Host-csrf=${who.csrf}`) =>
    new Promise<{ status: number; text: string }>((resolve, reject) => {
      const req = request({ hostname: '127.0.0.1', servername: 'customer', port: address.port, path, method, ca,
        headers: { host: 'customer:8443', cookie } }, res => {
        let text = ''; res.setEncoding('utf8'); res.on('data', chunk => text += chunk);
        res.on('end', () => resolve({ status: res.statusCode!, text }));
      }); req.on('error', reject); req.end();
    });
  try {
    await t.test('protected own location has an accessible empty state', async () => {
      const page = await send(employee); assert.equal(page.status, 200);
      assert.match(page.text, /No business facts yet/);
    });
    const insertSql = `INSERT INTO pilot.business_fact_revisions(tenant_id,location_id,revision,text,source_note,evidence_kind,membership_id,membership_version,confirmed_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`;
    const values = (revision = 1, text = 'Invented A facts', source = 'Invented source') =>
      [a.tenant, a.location, revision, text, source, 'synthetic_fixture', a.membership, 1, '2026-01-01T12:00:00Z'];
    const hostile = 'Invented latest A <script>alert("x")</script> & https://media.invalid/image.jpg\n😀';
    const source = 'Invented <source> & "note"';
    const snapshot = async () => {
      const result: Record<string, unknown> = {};
      for (const table of ['business_fact_revisions', 'drafts', 'draft_revisions', 'occurrences', 'approvals', 'attempts', 'locations', 'audit', 'budget_reservations']) {
        result[table] = (await db.query(`SELECT to_jsonb(t) AS row FROM pilot.${table} t WHERE tenant_id=ANY($1::uuid[]) ORDER BY to_jsonb(t)::text`, [[a.tenant, b.tenant]])).rows;
      }
      return result;
    };
    await t.test('storage enforces composite references, lengths, synthetic provenance and append-only privileges', async () => {
      await db.query(insertSql, values());
      const latest = values(3, hostile, source); await db.query(insertSql, latest);
      await assert.rejects(db.query(insertSql, latest), { code: '23505' });
      for (const [index, value, code] of [[1, b.location, '23503'], [6, b.membership, '23503'], [2, 0, '23514'],
        [7, 0, '23514'], [7, 2, '23514'], [5, 'real_confirmation', '23514'], [3, '', '23514'],
        [3, '😀'.repeat(6001), '23514'], [4, '', '23514'], [4, '😀'.repeat(501), '23514'], [8, 'infinity', '23514']] as const) {
        const invalid = values(4); invalid[index] = value;
        await assert.rejects(db.query(insertSql, invalid), { code });
      }
      const employeeMembership = (await db.query("SELECT id FROM pilot.memberships WHERE tenant_id=$1 AND role='Employee' LIMIT 1", [a.tenant])).rows[0].id;
      const invalid = values(4); invalid[6] = employeeMembership;
      await assert.rejects(db.query(insertSql, invalid), { code: '23514' });
      await assert.rejects(appDb.query(insertSql, values(4)), { code: '42501' });
      for (const sql of ["UPDATE pilot.business_fact_revisions SET text='changed'", 'DELETE FROM pilot.business_fact_revisions', 'TRUNCATE pilot.business_fact_revisions']) {
        await assert.rejects(appDb.query(sql), { code: '42501' });
        await assert.rejects(db.query(sql), { code: '23514' });
      }
      const historical = (await db.query('SELECT * FROM pilot.business_fact_revisions WHERE tenant_id=$1', [a.tenant])).rows;
      await db.query("UPDATE pilot.memberships SET active=false,role='Employee',version=version+1 WHERE tenant_id=$1 AND id=$2", [a.tenant, a.membership]);
      assert.deepEqual((await db.query('SELECT * FROM pilot.business_fact_revisions WHERE tenant_id=$1', [a.tenant])).rows, historical);
      await assert.rejects(db.query(insertSql, values(4)), { code: '23514' });
      const bValues = values(); bValues[0] = b.tenant; bValues[1] = b.location; bValues[6] = b.membership; bValues[3] = 'Private B facts canary';
      await db.query(insertSql, bValues);
    });
    await t.test('both roles see latest own revision and historical simulated confirmation, with literal escaped text', async () => {
      const before = await snapshot();
      for (const who of [employee, manager]) {
        const portal = await send(who, '/customer'); assert.ok(portal.text.includes('href="/customer/facts"'));
        const list = await send(who); assert.equal(list.status, 200);
        const detail = await send(who, `/customer/facts/${a.location}`); assert.equal(detail.status, 200);
        for (const page of [list, detail]) {
          assert.match(page.text, /Revision 3/); assert.match(page.text, /Simulated fixture confirmation/);
          assert.match(page.text, /Not a real customer confirmation/); assert.match(page.text, /2026-01-01T12:00:00.000Z/);
          assert.ok(page.text.includes('Invented latest A &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; https://media.invalid/image.jpg\n😀'));
          assert.ok(page.text.includes('Invented &lt;source&gt; &amp; &quot;note&quot;'));
          assert.ok(!page.text.includes('<script>') && !page.text.includes('href="https:') && !page.text.includes('<form'));
          assert.ok(!page.text.includes('Private B facts canary') && !page.text.includes('Invented A facts'));
        }
      }
      const ownB = await send(readerB); assert.equal(ownB.status, 200); assert.ok(ownB.text.includes('Private B facts canary'));
      assert.ok(!ownB.text.includes('Invented latest A'));
      assert.deepEqual(await snapshot(), before);
    });
    await t.test('foreign and unknown locations deny alike and request selectors cannot replace active tenant', async () => {
      const before = await snapshot();
      for (const who of [employee, manager]) {
        const denied = await send(who, `/customer/facts/${b.location}`); assert.equal(denied.status, 403);
        for (const id of [randomUUID(), 'bad-id', a.draft]) assert.deepEqual(await send(who, `/customer/facts/${id}`), denied);
        assert.deepEqual(await send(who, `/customer/facts/${b.location}?tenantId=${b.tenant}&role=Manager`), denied);
        assert.deepEqual(await send(who, `/customer/facts?tenantId=${b.tenant}&role=Admin`), await send(who));
        assert.equal((await send(who, '/customer/facts', 'POST')).status, 404);
        assert.equal((await send(who, `/customer/facts/${a.location}`, 'POST')).status, 404);
        assert.equal((await send(who, '/customer/facts', 'GET', '')).status, 403);
        assert.equal((await send(who, '/customer/facts', 'GET', `__Host-session=${who.token}; __Host-csrf=${'0'.repeat(64)}`)).status, 403);
        assert.equal((await send(who)).status, 200);
      }
      assert.deepEqual(await snapshot(), before);
    });
    await t.test('multiple locations, absent facts, normalized newlines and exact Unicode limits', async () => {
      const empty = (await db.query("INSERT INTO pilot.locations(tenant_id,provider_location) VALUES($1,'Empty <location>') RETURNING id", [a.tenant])).rows[0].id;
      const second = (await db.query("INSERT INTO pilot.locations(tenant_id,provider_location) VALUES($1,'Second location') RETURNING id", [b.tenant])).rows[0].id;
      const normalized = values(1, 'one\r\ntwo\rthree', 'source\r\nline');
      normalized[0] = b.tenant; normalized[1] = second; normalized[6] = b.membership;
      await db.query(insertSql, normalized);
      const stored = (await db.query('SELECT text,source_note FROM pilot.business_fact_revisions WHERE tenant_id=$1 AND location_id=$2', [b.tenant, second])).rows[0];
      assert.deepEqual(stored, { text: 'one\ntwo\nthree', source_note: 'source\nline' });
      const bounded = [...normalized]; bounded[2] = 2; bounded[3] = '😀'.repeat(5999) + '\r\n'; bounded[4] = '😀'.repeat(500);
      await db.query(insertSql, bounded);
      const lengths = (await db.query('SELECT length(text) AS text,length(source_note) AS source FROM pilot.business_fact_revisions WHERE tenant_id=$1 AND location_id=$2 AND revision=2', [b.tenant, second])).rows[0];
      assert.deepEqual(lengths, { text: 6000, source: 500 });
      const before = await snapshot();
      const page = await send(employee, `/customer/facts/${empty}`); assert.equal(page.status, 200);
      assert.match(page.text, /Empty &lt;location&gt;/); assert.match(page.text, /No business facts yet/);
      const list = await send(employee); assert.ok(list.text.includes(hostile.split('<')[0]!) && list.text.includes('Empty &lt;location&gt;'));
      assert.ok((await send(readerB)).text.includes('Private B facts canary'));
      assert.ok((await send(readerB)).text.includes('😀'.repeat(5999)));
      assert.deepEqual(await snapshot(), before);
      const minimum = [...normalized]; minimum[2] = 3; minimum[3] = '😀'; minimum[4] = 'x';
      await db.query(insertSql, minimum);
      const minimumStored = (await db.query('SELECT length(text) AS text,length(source_note) AS source FROM pilot.business_fact_revisions WHERE tenant_id=$1 AND location_id=$2 AND revision=3', [b.tenant, second])).rows[0];
      assert.deepEqual(minimumStored, { text: 1, source: 1 });
    });
    await t.test('current identity, session, tenant and membership authority remain mandatory', async () => {
      const before = await snapshot();
      for (const state of ['disabled', 'unverified', 'required', 'mismatch', 'unavailable']) {
        identityState = state;
        for (const path of ['/customer/facts', `/customer/facts/${a.location}`]) {
          const denied = await send(employee, path); assert.ok([403, 503].includes(denied.status)); assert.ok(!denied.text.includes('Invented latest A'));
        }
        identityState = 'active'; assert.equal((await send(employee)).status, 200);
      }
      for (const mutation of ["revoked_at=now()", "membership_version=2", "identity_version=2", "tenant_version=2", "last_seen_at=now()-interval '31 minutes'"]) {
        const who = await actor('Employee');
        await db.query(`UPDATE pilot.sessions SET ${mutation} WHERE token_hash=$1`, [tokenHash(who.token)]);
        assert.equal((await send(who)).status, 403); assert.equal((await send(employee)).status, 200);
      }
      const removed = await actor('Employee');
      await db.query('UPDATE pilot.memberships SET active=false,version=version+1 WHERE tenant_id=$1 AND id=$2', [a.tenant, removed.membership]);
      assert.equal((await send(removed)).status, 403); assert.equal((await send(employee)).status, 200);
      await db.query('UPDATE pilot.tenants SET active=false,version=version+1 WHERE id=$1', [a.tenant]);
      assert.equal((await send(employee)).status, 403); assert.equal((await send(readerB)).status, 200);
      assert.deepEqual(await snapshot(), before);
    });
    await t.test('no-location workspace has an empty state; migration005 rollback preserves all prior records', async () => {
      const tenant = (await db.query("INSERT INTO pilot.tenants(name) VALUES('Empty facts workspace') RETURNING id")).rows[0].id;
      const empty = await actor('Employee', tenant);
      const page = await send(empty); assert.equal(page.status, 200); assert.match(page.text, /This workspace has no locations/);
      const before = await snapshot();
      try {
        await db.query('BEGIN');
        await db.query(await readFile('db/migrations/005_business_facts.down.sql', 'utf8'));
        await db.query(await readFile('db/migrations/005_business_facts.up.sql', 'utf8'));
        const after = await snapshot();
        assert.deepEqual(after.business_fact_revisions, []);
        for (const table of Object.keys(before).filter(name => name !== 'business_fact_revisions')) assert.deepEqual(after[table], before[table]);
      } finally { await db.query('ROLLBACK'); }
      assert.deepEqual(await snapshot(), before);
    });
  } finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); await appDb.end(); await db.end(); }
});
