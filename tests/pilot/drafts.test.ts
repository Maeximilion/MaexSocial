import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer, request } from 'node:https';
import { setTimeout } from 'node:timers/promises';
import { test } from 'node:test';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';
import { createCustomerApp } from '../../apps/web/src/server/customer.js';
import { tokenHash } from '../../apps/web/src/server/session.js';
import { requireCustomerRequest } from '../../apps/web/src/server/request.js';
import { editDraft } from '../../apps/web/src/routes/content.js';
import { occurrence, seedTenant } from './fixtures.js';

test('protected text editing preserves tenant, revision and approval boundaries', async t => {
  if (process.env.PILOT_CONTAINER !== '1') { console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/drafts.test.js'])); return; }
  const db = await connectFixture();
  const a = await seedTenant(db), b = await seedTenant(db), independent = await seedTenant(db);
  const disabled = new Set<string>();
  const pids: number[] = [];
  const app = createCustomerApp(async () => {
    const connection = await connectFixture();
    pids.push((await connection.query('SELECT pg_backend_pid() AS pid')).rows[0].pid);
    return connection;
  }, async subject => ({ subject, enabled: !disabled.has(subject), verified: true, requiredActions: [], credentials: [] }));
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
    return { subject, token, csrf, identity, membership };
  };
  const employee = await actor('Employee'), manager = await actor('Manager');
  type Actor = typeof employee;
  const send = async (who: Actor, path: string, body?: Record<string, string> | string, origin = 'https://customer:8443', cookie?: string, type = 'application/x-www-form-urlencoded') =>
    new Promise<{ status: number; text: string; location: string | undefined }>((resolve, reject) => {
      const req = request({ hostname: '127.0.0.1', servername: 'customer', port: address.port, path, method: body === undefined ? 'GET' : 'POST', ca,
        headers: { host: 'customer:8443', origin, cookie: cookie ?? `__Host-session=${who.token}; __Host-csrf=${who.csrf}`, 'content-type': type } }, res => {
        let text = ''; res.setEncoding('utf8'); res.on('data', chunk => text += chunk);
        res.on('end', () => resolve({ status: res.statusCode!, text, location: res.headers.location }));
      }); req.on('error', reject); req.end(typeof body === 'string' ? body : body ? new URLSearchParams(body).toString() : undefined);
    });
  const path = `/customer/drafts/${a.draft}`;
  const latest = async () => (await db.query('SELECT * FROM pilot.draft_revisions WHERE tenant_id=$1 AND draft_id=$2 ORDER BY revision DESC LIMIT 1', [a.tenant, a.draft])).rows[0];
  const snapshot = async () => {
    const result: Record<string, unknown> = {};
    for (const table of ['drafts', 'draft_revisions', 'occurrences', 'approvals', 'attempts', 'locations', 'audit', 'budget_reservations']) {
      result[table] = (await db.query(`SELECT to_jsonb(t) AS row FROM pilot.${table} t WHERE tenant_id=ANY($1::uuid[]) ORDER BY to_jsonb(t)::text`, [[a.tenant, b.tenant, independent.tenant]])).rows;
    }
    return result;
  };
  try {
    await t.test('both customer roles edit existing drafts without MFA or new authority', async () => {
      assert.equal((await send(employee, '/customer/drafts')).status, 200);
      for (const who of [employee, manager]) {
        const old = await latest();
        const page = await send(who, path); assert.equal(page.status, 200); assert.ok(page.text.includes(old.text));
        const text = `Text from ${who === employee ? 'Employee' : 'Manager'}`;
        const saved = await send(who, path, { text, revisionId: old.id, csrf: who.csrf });
        assert.equal(saved.status, 303); assert.equal(saved.location, path);
        const row = await latest(); assert.equal(row.text, text); assert.equal(row.revision, old.revision + 1); assert.notEqual(row.id, old.id);
        assert.equal((await db.query('SELECT text FROM pilot.draft_revisions WHERE tenant_id=$1 AND id=$2', [a.tenant, old.id])).rows[0].text, old.text);
        assert.ok((await send(who, path)).text.includes(text));
      }
      assert.equal((await db.query('SELECT count(*)::int AS n FROM pilot.approvals WHERE tenant_id=$1', [a.tenant])).rows[0].n, 0);
    });
    await t.test('foreign identifiers, authority fields, media and forged requests have no domain effect', async () => {
      await db.query("INSERT INTO pilot.draft_revisions(tenant_id,draft_id,revision,text) VALUES($1,$2,2,'B private text canary')", [b.tenant, b.draft]);
      const foreignOccurrence = await occurrence(db, b);
      const before = await snapshot(), old = await latest();
      for (const who of [employee, manager]) {
        for (const id of [b.draft, b.location, foreignOccurrence, randomUUID()]) {
          const target = `/customer/drafts/${id}`;
          for (const response of [await send(who, target), await send(who, target, { text: 'Forbidden', revisionId: old.id, csrf: who.csrf })]) {
            assert.equal(response.status, 403); assert.ok(!response.text.includes('B private text canary'));
          }
        }
        const own = await send(who, `${path}?tenantId=${b.tenant}&locationId=${b.location}&occurrenceId=${foreignOccurrence}`);
        assert.equal(own.status, 200); assert.ok(!own.text.includes('B private text canary'));
        for (const field of ['tenantId', 'locationId', 'occurrenceId', 'role', 'identityId', 'approvalId', 'attachment', 'upload', 'mediaUrl', 'objectReference']) {
          assert.equal((await send(who, path, { text: 'No', revisionId: old.id, csrf: who.csrf, [field]: b.location })).status, 400);
        }
        assert.equal((await send(who, path, { text: 'No', revisionId: b.revision, csrf: who.csrf })).status, 409);
        assert.equal((await send(who, path, { text: 'No', revisionId: old.id, csrf: who.csrf }, 'https://foreign.invalid')).status, 403);
        assert.equal((await send(who, path, { text: 'No', revisionId: old.id, csrf: '0'.repeat(64) })).status, 403);
        assert.equal((await send(who, path, { text: 'No', revisionId: old.id, csrf: who.csrf }, undefined, '')).status, 403);
        const proof = '1'.repeat(64);
        assert.equal((await send(who, path, { text: 'No', revisionId: old.id, csrf: proof }, undefined, `__Host-session=${who.token}; __Host-csrf=${proof}`)).status, 403);
        assert.equal((await send(who, path, `text=one&text=two&revisionId=${old.id}&csrf=${who.csrf}`)).status, 400);
        assert.equal((await send(who, path, '{}', undefined, undefined, 'application/json')).status, 400);
        for (const text of ['', 'a'.repeat(1501), '\u0000', '😀'.repeat(1501), '\r\n' + 'x'.repeat(1500)]) {
          assert.equal((await send(who, path, { text, revisionId: old.id, csrf: who.csrf })).status, 400);
        }
        assert.equal((await send(who, path, { text: 'x'.repeat(22000), revisionId: old.id, csrf: who.csrf })).status, 400);
        for (const suffix of ['/approval', '/export', '/publish']) assert.equal((await send(who, path + suffix, { csrf: who.csrf })).status, 404);
      }
      assert.deepEqual(await snapshot(), before);
      assert.equal((await send(employee, '/customer/switch', { csrf: employee.csrf, tenantId: 'x'.repeat(2500) })).status, 400);
    });
    await t.test('stale sessions and disabled current authority deny without side effects', async () => {
      const old = await latest(), before = await snapshot();
      const denied = async () => { assert.equal((await send(employee, path)).status, 403); assert.equal((await send(employee, path, { text: 'No', revisionId: old.id, csrf: employee.csrf })).status, 403); };
      disabled.add(employee.subject); await denied(); disabled.clear();
      await db.query('UPDATE pilot.identities SET version=version+1 WHERE id=$1', [employee.identity]); await denied();
      await db.query('UPDATE pilot.sessions SET identity_version=2 WHERE token_hash=$1', [tokenHash(employee.token)]);
      await db.query('UPDATE pilot.tenants SET active=false,version=version+1 WHERE id=$1', [a.tenant]); await denied();
      await db.query('UPDATE pilot.tenants SET active=true,version=version+1 WHERE id=$1', [a.tenant]); await denied();
      await db.query('UPDATE pilot.sessions SET tenant_version=3 WHERE tenant_id=$1', [a.tenant]);
      await db.query('UPDATE pilot.sessions SET revoked_at=now() WHERE token_hash=$1', [tokenHash(employee.token)]); await denied();
      await db.query('UPDATE pilot.sessions SET revoked_at=NULL WHERE token_hash=$1', [tokenHash(employee.token)]);
      await db.query('UPDATE pilot.memberships SET active=false,version=version+1 WHERE tenant_id=$1 AND id=$2', [a.tenant, employee.membership]);
      await denied();
      await db.query('UPDATE pilot.memberships SET active=true,version=version+1 WHERE tenant_id=$1 AND id=$2', [a.tenant, employee.membership]);
      await denied();
      await db.query('UPDATE pilot.sessions SET membership_version=3 WHERE token_hash=$1', [tokenHash(employee.token)]);
      const times = (await db.query('SELECT created_at,last_seen_at,expires_at FROM pilot.sessions WHERE token_hash=$1', [tokenHash(employee.token)])).rows[0];
      await db.query("UPDATE pilot.sessions SET created_at=now()-interval '9 hours',last_seen_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' WHERE token_hash=$1", [tokenHash(employee.token)]); await denied();
      await db.query('UPDATE pilot.sessions SET created_at=$2,last_seen_at=$3,expires_at=$4 WHERE token_hash=$1', [tokenHash(employee.token), times.created_at, times.last_seen_at, times.expires_at]);
      assert.equal((await send(employee, path)).status, 200); assert.deepEqual(await snapshot(), before);
    });
    await t.test('Unicode boundary, whitespace and stored HTML remain literal plain text', async () => {
      const old = await latest(), before = await snapshot();
      await db.query('BEGIN');
      try {
        const context = await requireCustomerRequest(db, employee, () => new Date(), async subject => ({ subject, enabled: true, verified: true, requiredActions: [], credentials: [] }));
        for (const text of ['\uD800', '\uDC00']) await assert.rejects(editDraft(db, context, a.draft, old.id, text), /Invalid request/);
      } finally { await db.query('ROLLBACK'); }
      assert.deepEqual(await snapshot(), before);
      for (const text of ['\r\n' + 'x'.repeat(1499), '\r' + 'x'.repeat(1499)]) {
        const old = await latest();
        assert.equal((await send(employee, path, { text, revisionId: old.id, csrf: employee.csrf })).status, 303);
        assert.equal((await latest()).text, '\n' + 'x'.repeat(1499));
      }
      for (const text of ['😀'.repeat(1500), '  </textarea><script>alert("x")</script> & https://example.invalid/image.png\n ']) {
        const old = await latest(); assert.equal((await send(employee, path, { text, revisionId: old.id, csrf: employee.csrf })).status, 303);
        assert.equal((await latest()).text, text);
        const page = await send(employee, path); assert.equal(page.status, 200);
        assert.ok(!page.text.includes('<script>')); assert.ok(!page.text.includes('maxlength='));
        if (text.includes('<script>')) { assert.ok(page.text.includes('&lt;/textarea&gt;&lt;script&gt;')); assert.ok(page.text.includes('&quot;x&quot;')); }
      }
    });
    await t.test('only affected unclaimed eligibility changes; frozen histories and other drafts survive', async () => {
      const old = await latest();
      const seeded: { id: string; state: string; approval: string; claimed: boolean }[] = [];
      for (const [state, claimed] of [...['draft', 'approved', 'held', 'quarantined', 'exported', 'in_flight', 'unknown', 'pending', 'confirmed', 'rejected'].map(state => [state, false] as const), ['approved', true] as const]) {
        const id = await occurrence(db, a);
        const approval = (await db.query(`INSERT INTO pilot.approvals(tenant_id,occurrence_id,draft_id,revision_id,location_id,membership_id,membership_version,grant_version,due_at,timezone,mfa_at)
          VALUES($1,$2,$3,$4,$5,$6,1,1,'2030-01-01T12:00:00Z','Europe/Berlin',now()) RETURNING id`, [a.tenant, id, a.draft, old.id, a.location, a.membership])).rows[0].id;
        await db.query('UPDATE pilot.occurrences SET approval_id=$1,state=$2 WHERE tenant_id=$3 AND id=$4', [approval, state, a.tenant, id]);
        if (claimed) await db.query('INSERT INTO pilot.attempts(tenant_id,occurrence_id,approval_id) VALUES($1,$2,$3)', [a.tenant, id, approval]);
        seeded.push({ id, state, approval, claimed });
      }
      const otherDraft = (await db.query('INSERT INTO pilot.drafts(tenant_id) VALUES($1) RETURNING id', [a.tenant])).rows[0].id;
      await occurrence(db, { ...a, draft: otherDraft }); await occurrence(db, independent);
      const before = await snapshot();
      assert.equal((await send(manager, path, { text: 'New revision requiring fresh approval', revisionId: old.id, csrf: manager.csrf })).status, 303);
      const after = await snapshot();
      for (const table of ['approvals', 'attempts', 'locations', 'audit', 'budget_reservations', 'drafts']) assert.deepEqual(after[table], before[table], table);
      const expected = structuredClone(before.occurrences) as { row: Record<string, unknown> }[];
      for (const { row } of expected) {
        const item = seeded.find(item => item.id === row.id);
        if (item && !item.claimed && ['draft', 'approved', 'held', 'quarantined'].includes(item.state)) {
          row.approval_id = null; if (item.state === 'approved') row.state = 'draft';
        }
      }
      const sort = (rows: { row: Record<string, unknown> }[]) => rows.sort((a, b) => String(a.row.id).localeCompare(String(b.row.id)));
      assert.deepEqual(sort(after.occurrences as { row: Record<string, unknown> }[]), sort(expected));
      assert.equal((after.draft_revisions as unknown[]).length, (before.draft_revisions as unknown[]).length + 1);
      const unchanged = await snapshot();
      const stale = await send(employee, path, { text: 'Overwrite', revisionId: old.id, csrf: employee.csrf });
      assert.equal(stale.status, 409); assert.match(stale.text, /reload/i); assert.deepEqual(await snapshot(), unchanged);
    });
    await t.test('two actual editors block on the same draft and exactly one revision wins', async () => {
      const old = await latest(), before = await snapshot();
      const holder = await connectFixture();
      let pending: Promise<{ status: number; text: string; location: string | undefined }>[] = [];
      try {
        const holderPid = (await holder.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        await holder.query('BEGIN');
        await holder.query('SELECT id FROM pilot.drafts WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [a.tenant, a.draft]);
        const start = pids.length;
        pending = [send(employee, path, { text: 'Concurrent Employee', revisionId: old.id, csrf: employee.csrf }), send(manager, path, { text: 'Concurrent Manager', revisionId: old.id, csrf: manager.csrf })];
        let blocked = false;
        for (let i = 0; i < 200; i++) {
          const editors = pids.slice(start);
          if (editors.length === 2) {
            const waits = (await db.query('SELECT pid,pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE pid=ANY($1::int[])', [editors])).rows;
            if (waits.length === 2 && waits.every(row => row.blockers.some((pid: number) => [holderPid, ...editors].includes(pid)))) { blocked = true; break; }
          }
          await setTimeout(10);
        }
        assert.ok(blocked, 'Both separate HTTPS transactions must visibly block on the held draft');
        await holder.query('COMMIT');
        const results = await Promise.all(pending); assert.deepEqual(results.map(r => r.status).sort(), [303, 409]);
        const winner = results[0]!.status === 303 ? 'Concurrent Employee' : 'Concurrent Manager';
        assert.equal((await latest()).text, winner); assert.equal((await latest()).revision, old.revision + 1);
        const after = await snapshot();
        assert.equal((after.draft_revisions as unknown[]).length, (before.draft_revisions as unknown[]).length + 1);
        assert.deepEqual(after.approvals, before.approvals); assert.deepEqual(after.attempts, before.attempts);
      } finally { await holder.query('ROLLBACK'); await Promise.allSettled(pending); await holder.end(); }
    });
  } finally { server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); await db.end(); }
});
