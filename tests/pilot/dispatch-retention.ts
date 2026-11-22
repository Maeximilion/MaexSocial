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
import { FakeGbp } from './fake-gbp.js';

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

  const auth = binding();
  await db.query(`INSERT INTO pilot.sessions(token_hash,csrf_hash,identity_id,identity_version,tenant_id,tenant_version,
    membership_id,membership_version,audience,created_at,last_seen_at,expires_at)
    SELECT $1,$2,i.id,i.version,t.id,t.version,m.id,m.version,'customer',now(),now(),now()+interval '1 hour'
    FROM pilot.tenants t JOIN pilot.memberships m ON m.tenant_id=t.id JOIN pilot.identities i ON i.id=m.identity_id
    WHERE t.id=$3 AND i.id=$4`, [tokenHash(auth.token), tokenHash(auth.csrf), tenant, target.user]);
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
  const { rows: [times] } = await db.query(`SELECT start.instant::text AS boundary,
    (start.instant - interval '1 microsecond')::text AS previous
    FROM pilot.attempts CROSS JOIN LATERAL (
      SELECT ((resolved_at AT TIME ZONE 'UTC') + interval '90 days') AT TIME ZONE 'UTC' AS instant
    ) start
    WHERE occurrence_id=$1`, [target.id]);
  assert.equal(await retireDispatchDetails(target.id, () => times.previous), 'ineligible');
  assert.deepEqual(await attempt(db, target.id), prior);
  const competing = await Promise.all([
    retireDispatchDetails(target.id, () => times.boundary),
    retireDispatchDetails(target.id, () => times.boundary),
  ]);
  assert.deepEqual(competing.sort(), ['already-retired', 'retired']);
  assert.deepEqual(await retainedRecords(db, target.id), preserved);
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

async function seedAndRetire(db: Client) {
  const makeClaim = async (result: 'LIVE' | 'REJECTED' | 'PROCESSING') => {
    const target = await seedDispatchApproval(binding(), true);
    let fakeTime = Date.now();
    const fake = new FakeGbp('/fake', { clock: () => fakeTime, frames: [
      { afterMs: 0, candidates: ['PROCESSING'] }, { afterMs: 10, candidates: [result] },
    ] });
    try {
      await claimDispatch(connectFixture, target.id, { policy: fake.policy, create: intent => {
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
      return { ...target, outcome };
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
  const unrelated = await attempt(db, confirmed.id);
  for (const target of targets) {
    await proveExpiry(db, target);
    if (target.id === rejected.id) assert.deepEqual(await attempt(db, confirmed.id), unrelated);
    await db.query('UPDATE pilot.locations SET grant_active=false,version=version+1 WHERE tenant_id=$1', [target.tenant]);
    await assert.rejects(db.query('DELETE FROM pilot.attempts WHERE occurrence_id=$1', [target.id]), { code: '23514' });
    await assert.rejects(db.query(`INSERT INTO pilot.attempts (tenant_id,occurrence_id,approval_id)
      VALUES($1,$2,$3)`, [target.tenant, target.id, target.approvalId]), { code: '23505' });
  }
  await assert.rejects(migrate('down'), /Populated fixture/);
  await assert.rejects(db.query(await readFile('db/migrations/013_attempt_retention.down.sql', 'utf8')),
    /Retired dispatch claims prevent this downgrade/);
  return targets;
}

async function isolated(stage: string, saved: string | undefined) {
  const owner = await connectFixture(true);
  const fake = new FakeGbp('/fake');
  try {
    assert.ok(stage === 'expiry' || stage === 'retained');
    const targets = stage === 'expiry' ? await seedAndRetire(owner) : JSON.parse(saved!) as TerminalCase[];
    for (const target of targets) await verifyClosed(owner, target, fake);
    console.log(JSON.stringify(targets));
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
  const targets = JSON.parse(saved) as TerminalCase[];
  assert.equal(node(cli, targets[0]!.id), 'already-retired');
  console.log('Expiry: confirmed and rejected, one microsecond before and at 90 days, concurrent retry and exclusions verified.');
  node(stack, 'down');
  node(stack, 'up', 'dispatch-retention');
  assert.deepEqual(JSON.parse(phase('retained', saved)), targets);
  console.log('Retained restart: both terminal results visible, one create per occurrence, no provider reads or exports.');
}

(process.env.PILOT_CONTAINER === '1' ? isolated(process.argv[2]!, process.argv[3]) : drill()).catch(error => {
  console.error(safeDiagnostics(String(error)));
  process.exitCode = 1;
});
