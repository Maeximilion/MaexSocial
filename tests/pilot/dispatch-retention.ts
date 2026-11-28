import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer, request } from 'node:https';
import { resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import type { Client } from 'pg';
import { readApprovalProposal } from '../../apps/web/src/routes/content.js';
import { createCustomerApp } from '../../apps/web/src/server/customer.js';
import { claimExport } from '../../apps/web/src/server/occurrence-export.js';
import { requireCustomerRequest } from '../../apps/web/src/server/request.js';
import { tokenHash } from '../../apps/web/src/server/session.js';
import { claimDispatch } from '../../apps/worker/src/dispatch.js';
import { reconcileOccurrence } from '../../apps/worker/src/reconcile.js';
import { retireDispatchDetails } from '../../ops/local/dispatch-retention.js';
import { compose, connectFixture, loadFixture, safeDiagnostics, usesLocalDocker, verifyContainers } from '../../ops/local/fixture.js';
import { migrate } from '../../scripts/pilot-db.js';
import { binding, inspect, seedDispatchApproval, type Case } from './dispatch-fixture.js';
import { FakeGbp } from '../../apps/worker/src/fake-gbp.js';

const entry = 'dist/pilot/tests/pilot/dispatch-retention.js';
const stack = 'dist/pilot/ops/local/stack.js';
const cli = 'dist/pilot/ops/local/dispatch-retention.js';
const farFuture = () => '2099-01-01T00:00:00Z';
type TerminalCase = Case & { outcome: 'confirmed' | 'rejected' };
const attempt = async (db: Client, id: string) =>
  (await db.query('SELECT * FROM pilot.attempts WHERE occurrence_id=$1', [id])).rows[0];

async function retainedRecords(db: Client, id: string) {
  return (await db.query(`SELECT to_jsonb(o) AS occurrence,
    (SELECT jsonb_agg(p ORDER BY p.id) FROM pilot.approvals p WHERE p.occurrence_id=o.id) AS approvals,
    (SELECT jsonb_agg(a ORDER BY a.id) FROM pilot.audit a WHERE a.occurrence_id=o.id) AS audit
    FROM pilot.occurrences o WHERE o.id=$1`, [id])).rows[0];
}

async function session(db: Client, target: Case) {
  const auth = binding();
  await db.query(`INSERT INTO pilot.sessions(token_hash,csrf_hash,identity_id,identity_version,tenant_id,tenant_version,
    membership_id,membership_version,audience,created_at,last_seen_at,expires_at)
    SELECT $1,$2,i.id,i.version,t.id,t.version,m.id,m.version,'customer',now(),now(),now()+interval '1 hour'
    FROM pilot.tenants t JOIN pilot.memberships m ON m.tenant_id=t.id JOIN pilot.identities i ON i.id=m.identity_id
    WHERE t.id=$3 AND i.id=$4`, [tokenHash(auth.token), tokenHash(auth.csrf), target.tenant, target.user]);
  return auth;
}

async function verifyClosed(db: Client, target: TerminalCase, fake: FakeGbp) {
  const { id, tenant, outcome } = target;
  assert.deepEqual(await attempt(db, id), {
    tenant_id: tenant, occurrence_id: id, outcome, details_retired: true,
    id: null, approval_id: null, claimed_at: null, observed_at: null, resolved_at: null, resource_name: null,
  });
  assert.equal(await reconcileOccurrence(connectFixture, id, {
    readback: () => assert.fail('Retired claim reached the provider'),
  }), outcome);
  await assert.rejects(claimDispatch(connectFixture, id, fake), { message: 'Denied' });
  assert.equal(fake.createCount(tenant, id), 1);

  const auth = await session(db, target);
  await assert.rejects(claimExport(connectFixture, auth, id, () => new Date(), inspect), { message: 'Denied' });
  assert.equal((await db.query("SELECT 1 FROM pilot.audit WHERE occurrence_id=$1 AND action='occurrence_export'", [id])).rowCount, 0);
  const app = await connectFixture();
  try {
    await app.query('BEGIN');
    const customer = await requireCustomerRequest(app, auth, () => new Date(), inspect, 'read-only');
    await assert.rejects(readApprovalProposal(app, customer, id), { message: 'Denied' });
  } finally { await app.end(); }

  const ca = await readFile('work/pilot/customer.crt');
  const server = createServer({ cert: ca, key: await readFile('work/pilot/customer.key') },
    createCustomerApp(connectFixture, inspect));
  await new Promise<void>(done => server.listen(0, '127.0.0.1', done));
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const page = await new Promise<string>((done, fail) => {
      const get = request({ hostname: '127.0.0.1', servername: 'customer', port: address.port, ca,
        path: `/customer/occurrences/${id}`, headers: { host: 'customer:8443',
          cookie: `__Host-session=${auth.token}; __Host-csrf=${auth.csrf}` } }, response => {
        if (response.statusCode !== 200) fail(new Error(`Unexpected customer GET status ${response.statusCode}`));
        let html = '';
        response.setEncoding('utf8').on('data', chunk => { html += chunk; }).on('end', () => done(html)).on('error', fail);
      });
      get.on('error', fail).end();
    });
    assert.ok(page.includes(outcome === 'confirmed' ? '<strong>Publication confirmed</strong>' : '<strong>Rejected</strong>'));
    assert.match(page, /Detailed dispatch evidence has expired/);
    assert.doesNotMatch(page, /Attempt started|Last observation|Invented plain text|localPosts\/|<form/);
  } finally { await new Promise<void>(done => server.close(() => done())); }
}

async function proveExpiry(db: Client, target: TerminalCase) {
  const prior = await attempt(db, target.id);
  const preserved = await retainedRecords(db, target.id);
  assert.equal(prior.outcome, target.outcome);
  assert.equal(prior.approval_id, target.approvalId);
  assert.ok(prior.claimed_at < prior.observed_at && prior.observed_at < prior.resolved_at);
  assert.equal(Boolean(prior.resource_name), target.outcome === 'confirmed');
  assert.equal(await reconcileOccurrence(connectFixture, target.id, {
    readback: () => assert.fail('Terminal retry read the provider'),
  }), target.outcome);
  assert.deepEqual(await attempt(db, target.id), prior);
  const { rows: [times] } = await db.query(`SELECT start.instant::text AS boundary,
    (start.instant - interval '1 microsecond')::text AS previous
    FROM pilot.attempts CROSS JOIN LATERAL (
      SELECT ((resolved_at AT TIME ZONE 'UTC') + interval '90 days') AT TIME ZONE 'UTC' AS instant
    ) start
    WHERE occurrence_id=$1`, [target.id]);
  assert.equal(await retireDispatchDetails(target.id, () => times.previous), 'ineligible');
  assert.deepEqual(await attempt(db, target.id), prior);
  if (target.outcome === 'confirmed') {
    await db.query(`CREATE CONSTRAINT TRIGGER fail_retirement_test AFTER UPDATE ON pilot.attempts
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pilot.reject_mutation()`);
    try { await assert.rejects(retireDispatchDetails(target.id, () => times.boundary), { code: '23514' }); }
    finally { await db.query('DROP TRIGGER fail_retirement_test ON pilot.attempts'); }
    assert.deepEqual(await attempt(db, target.id), prior);
    assert.deepEqual(await retainedRecords(db, target.id), preserved);
    assert.equal((await db.query(`SELECT 1 FROM pilot.fixture_audit_disposition
      WHERE audit_id=$1 AND incident_state='clear' AND expiry_xid IS NULL AND checked_at IS NULL`,
    [preserved.audit[0].id])).rowCount, 1);
  }
  const auditId = preserved.audit[0].id;
  await assert.rejects(db.query('DELETE FROM pilot.audit WHERE tenant_id=$1 AND id=$2', [target.tenant, auditId]),
    { code: '23514' });
  const competing = await Promise.all([
    retireDispatchDetails(target.id, () => times.boundary),
    retireDispatchDetails(target.id, () => times.boundary),
  ]);
  assert.deepEqual(competing.sort(), ['already-retired', 'retired']);
  assert.equal(preserved.audit.length, 1);
  assert.deepEqual(await retainedRecords(db, target.id), { ...preserved, audit: null });
  assert.equal((await db.query('SELECT 1 FROM pilot.fixture_audit_disposition WHERE tenant_id=$1 AND audit_id=$2',
    [target.tenant, preserved.audit[0].id])).rowCount, 0);
  assert.equal(await retireDispatchDetails(target.id, farFuture), 'already-retired');
}

async function testExclusions(db: Client, target: TerminalCase) {
  const prior = await attempt(db, target.id);
  const { id } = await loadFixture();
  for (const [sql, restore, args] of [
    ["UPDATE public.fixture_identity SET purpose='ordinary'", "UPDATE public.fixture_identity SET purpose='dispatch-retention'"],
    ['UPDATE public.fixture_identity SET restore_target=true', 'UPDATE public.fixture_identity SET restore_target=false'],
    ["UPDATE public.fixture_identity SET id='different-fixture'", 'UPDATE public.fixture_identity SET id=$1', [id]],
  ] satisfies [string, string, string[]?][]) {
    await db.query(sql);
    try { await assert.rejects(retireDispatchDetails(target.id, farFuture), /mismatch/); }
    finally { await db.query(restore, args); }
  }
  assert.equal(await retireDispatchDetails(randomUUID(), farFuture), 'ineligible');
  const blocker = await connectFixture(true);
  let retiring: ReturnType<typeof retireDispatchDetails> | undefined;
  try {
    await blocker.query('BEGIN');
    const { rows: [{ pid } = {}] } = await blocker.query('SELECT pg_backend_pid() AS pid');
    await blocker.query('SELECT id FROM pilot.occurrences WHERE id=$1 FOR UPDATE', [target.id]);
    retiring = retireDispatchDetails(target.id, farFuture);
    try {
      const deadline = performance.now() + 3000;
      for (;;) {
        const waiting = await db.query(`SELECT 1 FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))
          AND query LIKE 'SELECT tenant_id,state%FROM pilot.occurrences%FOR UPDATE'`, [pid]);
        if (waiting.rowCount) break;
        assert.ok(performance.now() < deadline, 'Retention did not wait on the occurrence lock');
        await setTimeout(10);
      }
      await blocker.query('SELECT id FROM pilot.attempts WHERE occurrence_id=$1 FOR UPDATE NOWAIT', [target.id]);
      await blocker.query("UPDATE pilot.occurrences SET state='quarantined' WHERE id=$1", [target.id]);
      await blocker.query('COMMIT');
    } catch (error) { await blocker.query('ROLLBACK'); throw error; }
    assert.equal(await retiring, 'ineligible');
  } finally {
    await blocker.end();
    await retiring;
  }

  for (const state of ['held', target.outcome]) {
    await db.query('UPDATE pilot.occurrences SET state=$2,approval_id=NULL WHERE id=$1', [target.id, state]);
    assert.equal(await retireDispatchDetails(target.id, farFuture), 'ineligible');
  }
  await db.query('UPDATE pilot.occurrences SET approval_id=$2 WHERE id=$1', [target.id, target.approvalId]);
  // A historical operator hold is distinct from the current occurrence state.
  await db.query(`INSERT INTO pilot.audit(tenant_id,actor_id,occurrence_id,action,reason,outcome)
    VALUES($1,$2,$3,'occurrence_hold','Synthetic historical hold case','held')`, [target.tenant, target.user, target.id]);
  assert.equal(await retireDispatchDetails(target.id, farFuture), 'ineligible');
  assert.deepEqual(await attempt(db, target.id), prior);
}

async function preservedEvidence(db: Client, id: string): Promise<string> {
  const { rows: [row] } = await db.query(`SELECT md5(jsonb_build_array(to_jsonb(o),
    (SELECT to_jsonb(a) FROM pilot.attempts a WHERE a.occurrence_id=o.id),
    (SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM pilot.audit e WHERE e.occurrence_id=o.id),
    (SELECT jsonb_agg(to_jsonb(d) ORDER BY d.audit_id) FROM pilot.fixture_audit_disposition d JOIN pilot.audit e
      ON (e.tenant_id,e.id)=(d.tenant_id,d.audit_id) WHERE e.occurrence_id=o.id))::text) AS digest
    FROM pilot.occurrences o WHERE o.id=$1`, [id]);
  return row.digest;
}

async function holdDuringExpiry(db: Client, target: Case & { event: string }) {
  const blocker = await connectFixture(true);
  let pending: Promise<string> | undefined;
  try {
    await blocker.query('BEGIN');
    const { rows: [self] } = await blocker.query('SELECT pg_backend_pid() AS pid');
    assert.equal((await blocker.query(`UPDATE pilot.fixture_audit_disposition SET incident_state='held'
      WHERE tenant_id=$1 AND audit_id=$2`, [target.tenant, target.event])).rowCount, 1);
    pending = retireDispatchDetails(target.id, farFuture);
    const deadline = performance.now()+5000;
    while (!(await db.query('SELECT 1 FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))', [self.pid])).rowCount) {
      assert.ok(performance.now()<deadline, 'Retirement failed to wait for the incident decision');
      await setTimeout(10);
    }
    await blocker.query('COMMIT');
    assert.equal(await pending, 'ineligible');
    assert.equal((await attempt(db, target.id)).details_retired, false);
    assert.equal((await retainedRecords(db, target.id)).audit[0].id, target.event);
  } finally { await blocker.end(); await pending; }
}

async function verifyExport(db: Client, target: Case, first: boolean) {
  const auth = await session(db, target);
  const download = () => claimExport(connectFixture, auth, target.id, () => new Date(), inspect);
  if (first) assert.deepEqual(await download(), { state: 'exported', text: 'Invented plain text' });
  const prior = await retainedRecords(db, target.id);
  assert.equal(prior.occurrence.state, 'exported');
  assert.equal(prior.audit.length, 1);
  assert.equal(prior.audit[0].action, 'occurrence_export');
  assert.equal(await retireDispatchDetails(target.id, farFuture), 'ineligible');
  assert.deepEqual(await download(), { state: 'exported', text: 'Invented plain text' });
  assert.deepEqual(await retainedRecords(db, target.id), prior);
  assert.equal(await attempt(db, target.id), undefined);
}

async function seedAndRetire(db: Client) {
  // Witness the claim transaction's clock before its separate audit INSERT.
  await db.query(`CREATE FUNCTION public.witness_claim_clock() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE NOTICE 'claim-clock %', transaction_timestamp()::text; RETURN NEW; END $$;
    CREATE TRIGGER witness_claim_clock BEFORE INSERT ON pilot.attempts
      FOR EACH ROW EXECUTE FUNCTION public.witness_claim_clock()`);
  const makeClaim = async (result: 'LIVE' | 'REJECTED' | 'PROCESSING') => {
    const target = await seedDispatchApproval(binding(), true);
    let fakeTime = Date.now();
    const fake = new FakeGbp('/fake', { clock: () => fakeTime, frames: [
      { afterMs: 0, candidates: ['PROCESSING'] }, { afterMs: 10, candidates: [result] },
    ] });
    try {
      let eventAt: string | undefined;
      const writer = await connectFixture();
      writer.on('notice', message => {
        if (message.message?.startsWith('claim-clock ')) eventAt = message.message.slice('claim-clock '.length);
      });
      await claimDispatch(async () => writer, target.id, { policy: fake.policy, create: intent => {
        fakeTime = Date.now();
        return fake.create(intent);
      } });
      fakeTime += 2;
      assert.equal(await reconcileOccurrence(connectFixture, target.id, fake), 'pending');
      assert.equal((await attempt(db, target.id)).resolved_at, null);
      const pending = await attempt(db, target.id);
      fakeTime += 10;
      await setTimeout(15);
      const outcome = result === 'LIVE' ? 'confirmed' : result === 'REJECTED' ? 'rejected' : 'pending';
      assert.equal(await reconcileOccurrence(connectFixture, target.id, fake), outcome);
      assert.ok(pending.observed_at < (await attempt(db, target.id)).observed_at);
      assert.ok(eventAt);
      const { rows: [event] } = await db.query(`SELECT id FROM pilot.audit WHERE tenant_id=$1 AND occurrence_id=$2
        AND action='dispatch_claim' AND actor_id=$3 AND created_at=$4 AND outcome='in_flight'`,
      [target.tenant, target.id, target.user, eventAt]);
      assert.ok(event);
      assert.equal(await retireDispatchDetails(target.id, farFuture), 'ineligible');
      await db.query(`INSERT INTO pilot.fixture_audit_disposition(fixture_id,tenant_id,audit_id,event_at,incident_state)
        VALUES($1,$2,$3,$4,'clear')`, [(await loadFixture()).id, target.tenant, event.id, eventAt]);
      return { ...target, outcome, event: event.id };
    } finally { fake.close(); }
  };
  await db.query('UPDATE pilot.dispatch_control SET stopped=false WHERE singleton');
  const confirmed = await makeClaim('LIVE');
  const rejected = await makeClaim('REJECTED');
  assert.equal(confirmed.outcome, 'confirmed');
  assert.equal(rejected.outcome, 'rejected');
  const targets = [rejected, confirmed] as TerminalCase[];
  const { rows: [privileges] } = await db.query(`SELECT
    has_column_privilege('pilot_app','pilot.attempts','resolved_at','INSERT,UPDATE') AS resolution,
    has_column_privilege('pilot_app','pilot.attempts','details_retired','INSERT,UPDATE') AS retirement,
    has_table_privilege('pilot_app','pilot.attempts','DELETE') AS deletion`);
  assert.deepEqual(privileges, { resolution: false, retirement: false, deletion: false });

  const pending = await makeClaim('PROCESSING');
  const pendingPrior = await attempt(db, pending.id);
  assert.equal(await retireDispatchDetails(pending.id, farFuture), 'ineligible');
  assert.deepEqual(await attempt(db, pending.id), pendingPrior);
  const unknown = await seedDispatchApproval(binding(), true);
  await assert.rejects(claimDispatch(connectFixture, unknown.id, { policy: 'synthetic-organic-text',
    async create() { throw new Error('Synthetic loss before acceptance'); },
  }), /outcome unknown/);
  const unknownPrior = await attempt(db, unknown.id);
  assert.equal(unknownPrior.outcome, 'unknown');
  assert.equal(await retireDispatchDetails(unknown.id, farFuture), 'ineligible');
  assert.deepEqual(await attempt(db, unknown.id), unknownPrior);

  const legacy = await seedDispatchApproval(binding(), true);
  await db.query(`INSERT INTO pilot.attempts (tenant_id,occurrence_id,approval_id,outcome,observed_at,resource_name)
    VALUES($1,$2,$3,'confirmed',now(),'fake-location/localPosts/historical')`, [legacy.tenant, legacy.id, legacy.approvalId]);
  await db.query("UPDATE pilot.occurrences SET state='confirmed' WHERE id=$1", [legacy.id]);
  const legacyPrior = await attempt(db, legacy.id);
  assert.equal(legacyPrior.resolved_at, null);
  assert.equal(await retireDispatchDetails(legacy.id, farFuture), 'ineligible');
  assert.deepEqual(await attempt(db, legacy.id), legacyPrior);

  const holdControl = await makeClaim('LIVE');
  assert.equal(holdControl.outcome, 'confirmed');
  await testExclusions(db, { ...holdControl, outcome: 'confirmed' });
  const incident = await makeClaim('LIVE');
  await holdDuringExpiry(db, incident);
  const ambiguous = await makeClaim('REJECTED');
  await db.query(`INSERT INTO pilot.audit(tenant_id,actor_id,occurrence_id,action,reason,outcome)
    SELECT tenant_id,actor_id,occurrence_id,action,reason,outcome FROM pilot.audit WHERE id=$1`, [ambiguous.event]);
  const exportTarget = await seedDispatchApproval(binding(), false);
  await verifyExport(db, exportTarget, true);
  const controls = [incident, ambiguous, pending, unknown, legacy, holdControl, exportTarget];
  const snapshots = [];
  for (const target of controls) snapshots.push(await preservedEvidence(db, target.id));
  for (const control of controls) assert.equal(await retireDispatchDetails(control.id, farFuture), 'ineligible');
  await db.query('DROP TRIGGER witness_claim_clock ON pilot.attempts; DROP FUNCTION public.witness_claim_clock()');
  await db.query('ALTER TABLE pilot.fixture_audit_disposition RENAME TO unavailable_test');
  try { await assert.rejects(retireDispatchDetails(confirmed.id, farFuture), { code: '42P01' }); }
  finally { await db.query('ALTER TABLE pilot.unavailable_test RENAME TO fixture_audit_disposition'); }
  await db.query(`UPDATE pilot.fixture_audit_disposition SET event_at=event_at+interval '1 microsecond' WHERE audit_id=$1`,
    [confirmed.event]);
  assert.equal(await retireDispatchDetails(confirmed.id, farFuture), 'ineligible');
  await db.query(`UPDATE pilot.fixture_audit_disposition SET event_at=event_at-interval '1 microsecond' WHERE audit_id=$1`,
    [confirmed.event]);
  const fixture = await loadFixture();
  await db.query("UPDATE pilot.fixture_audit_disposition SET fixture_id='other-dispatch-fixture' WHERE audit_id=$1",
    [confirmed.event]);
  assert.equal(await retireDispatchDetails(confirmed.id, farFuture), 'ineligible');
  await db.query(`INSERT INTO public.fixture_identity(id,purpose,restore_target)
    VALUES('other-dispatch-fixture','dispatch-retention',false)`);
  try { await assert.rejects(retireDispatchDetails(confirmed.id, farFuture), /Fixture database identity mismatch/); }
  finally { await db.query("DELETE FROM public.fixture_identity WHERE id='other-dispatch-fixture'"); }
  await db.query('UPDATE pilot.fixture_audit_disposition SET fixture_id=$1 WHERE audit_id=$2', [fixture.id, confirmed.event]);
  const unrelated = await preservedEvidence(db, confirmed.id);
  for (const target of targets) {
    await proveExpiry(db, target);
    if (target.id === rejected.id) assert.equal(await preservedEvidence(db, confirmed.id), unrelated);
    await db.query('UPDATE pilot.locations SET grant_active=false,version=version+1 WHERE tenant_id=$1', [target.tenant]);
    await assert.rejects(db.query('DELETE FROM pilot.attempts WHERE occurrence_id=$1', [target.id]), { code: '23514' });
    await assert.rejects(db.query(`INSERT INTO pilot.attempts (tenant_id,occurrence_id,approval_id)
      VALUES($1,$2,$3)`, [target.tenant, target.id, target.approvalId]), { code: '23505' });
  }
  await assert.rejects(migrate('down'), /Populated fixture/);
  await assert.rejects(db.query(await readFile('db/migrations/013_attempt_retention.down.sql', 'utf8')),
    /Retired dispatch claims prevent this downgrade/);
  await assert.rejects(db.query(await readFile('db/migrations/019_dispatch_claim_expiry.down.sql', 'utf8')),
    /Expired dispatch audit detail prevents this downgrade/);
  return { targets, controls: controls.map(t => t.id), snapshots, exportTarget, pendingId: pending.id };
}

async function isolated(stage: string, saved: string | undefined) {
  const owner = await connectFixture(true);
  const fake = new FakeGbp('/fake');
  try {
    assert.ok(stage === 'expiry' || stage === 'retained');
    const result = stage === 'expiry' ? await seedAndRetire(owner) : JSON.parse(saved!) as Awaited<ReturnType<typeof seedAndRetire>>;
    for (const target of result.targets) {
      assert.equal(await retireDispatchDetails(target.id, farFuture), 'already-retired');
      await verifyClosed(owner, target, fake);
    }
    await verifyExport(owner, result.exportTarget, false);
    assert.equal(fake.createCount(result.exportTarget.tenant, result.exportTarget.id), 0);
    for (const [index, id] of result.controls.entries()) {
      assert.equal(await retireDispatchDetails(id, farFuture), 'ineligible');
      assert.equal(await preservedEvidence(owner, id), result.snapshots[index]);
    }
    if (stage === 'retained') {
      let reads = 0;
      assert.equal(await reconcileOccurrence(connectFixture, result.pendingId, {
        readback: attempt => { reads++; return fake.readback(attempt); },
      }), 'pending');
      assert.equal(reads, 1);
      const pending = await attempt(owner, result.pendingId);
      assert.equal(fake.createCount(pending.tenant_id, result.pendingId), 1);
      assert.equal(pending.resolved_at, null);
    }
    console.log(JSON.stringify(result));
  } finally { fake.close(); await owner.end(); }
}

async function drill() {
  assert.equal(process.argv.length, 2);
  const fixture = await loadFixture();
  assert.ok(usesLocalDocker() && fixture.purpose === 'dispatch-retention' && !fixture.restoreTarget && !fixture.pairedRestore);
  verifyContainers(fixture, true);
  const phase = (...args: string[]) => compose(fixture, ['run', '--rm', '-T', '--no-deps', '--pull', 'never',
    '--volume', resolve('work/pilot/provider-state') + ':/fake', 'runner', 'node', entry, ...args]);
  const node = (file: string, ...args: string[]) => execFileSync(process.execPath, [file, ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180_000,
  }).trim();
  assert.equal(node(cli, randomUUID()), 'ineligible');
  const saved = phase('expiry');
  const result = JSON.parse(saved) as Awaited<ReturnType<typeof seedAndRetire>>;
  assert.equal(node(cli, result.targets[0]!.id), 'already-retired');
  console.log('Expiry: confirmed and rejected, one microsecond before and at 90 days, concurrent retry and exclusions verified.');
  node(stack, 'down');
  node(stack, 'up', 'dispatch-retention');
  assert.deepEqual(JSON.parse(phase('retained', saved)), result);
  console.log('Retained restart: both terminal results visible, one create per occurrence, no provider reads or exports.');
}

(process.env.PILOT_CONTAINER === '1' ? isolated(process.argv[2]!, process.argv[3]) : drill()).catch(error => {
  console.error(safeDiagnostics(String(error)));
  process.exitCode = 1;
});
