import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import type { Client } from 'pg';
import { expireAuditEvent } from '../../ops/local/audit-retention.js';
import { connectFixture, loadFixture, runIsolatedFixture, safeDiagnostics, usesLocalDocker } from '../../ops/local/fixture.js';
import { createOrganization } from '../../packages/contracts/management-organization.js';
import { seedDomain, seedSecurity, verifyDomain } from './audit-retention-domain.js';
import { binding, clock } from './dispatch-fixture.js';
import { seedManagementSession } from './fixtures.js';

const entry = 'dist/pilot/tests/pilot/audit-retention.js';
const stack = 'dist/pilot/ops/local/stack.js';
const authFile = 'work/pilot/audit-drill-session.json';
type Target = { tenant: string; id: string; boundary: string; previous: string };
const expire = (t: Target, at = t.boundary) => expireAuditEvent(t.tenant, t.id, () => at);

async function target(db: Client, tenant: string, action: string, expected: Date | string): Promise<Target> {
  const { rows } = await db.query(`SELECT tenant_id AS tenant,id,
    (created_at+interval '2160 hours')::text AS boundary,
    (created_at+interval '2160 hours'-interval '1 microsecond')::text AS previous
    FROM pilot.audit WHERE tenant_id=$1 AND action=$2 AND created_at=$3`, [tenant, action, expected]);
  assert.equal(rows.length, 1);
  return rows[0];
}

async function authorize(db: Client, t: Target, at: Date | string) {
  await db.query(`INSERT INTO pilot.fixture_audit_disposition(fixture_id,tenant_id,audit_id,event_at,incident_state)
    VALUES($1,$2,$3,$4,'clear')`, [(await loadFixture()).id, t.tenant, t.id, at]);
}

async function auditDigest(db: Client) {
  return (await db.query(`SELECT count(*)::int AS count,md5(string_agg(to_jsonb(a)::text,',' ORDER BY tenant_id,id)) AS digest
    FROM pilot.audit a`)).rows[0];
}

async function applyHoldFirst(db: Client, held: Target) {
  const blocker = await connectFixture(true);
  let pending: Promise<string> | undefined;
  try {
    await blocker.query('BEGIN');
    const { rows: [self] } = await blocker.query('SELECT pg_backend_pid() AS pid');
    await blocker.query("UPDATE pilot.fixture_audit_disposition SET incident_state='held' WHERE tenant_id=$1 AND audit_id=$2",
      [held.tenant, held.id]);
    pending = expire(held);
    const deadline = performance.now() + 5000;
    while (!(await db.query('SELECT 1 FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))', [self.pid])).rowCount) {
      assert.ok(performance.now() < deadline, 'Expiry failed to wait for incident disposition');
      await setTimeout(10);
    }
    await blocker.query('COMMIT');
    assert.equal(await pending, 'ineligible');
  } finally { await blocker.end(); await pending; }
}

async function checkRefusals(db: Client, t: Target) {
  for (const [change, restore] of [
    ["UPDATE public.fixture_identity SET purpose='ordinary'", "UPDATE public.fixture_identity SET purpose='audit-retention'"],
    ['UPDATE public.fixture_identity SET restore_target=true', 'UPDATE public.fixture_identity SET restore_target=false'],
    ['ALTER TABLE pilot.fixture_audit_disposition RENAME TO temporarily_unavailable',
      'ALTER TABLE pilot.temporarily_unavailable RENAME TO fixture_audit_disposition'],
  ]) {
    await db.query(change!);
    try { await assert.rejects(expire(t)); } finally { await db.query(restore!); }
  }
  assert.equal(await expire({ ...t, tenant: randomUUID() }), 'ineligible');
  await assert.rejects(db.query('DELETE FROM pilot.audit WHERE tenant_id=$1 AND id=$2', [t.tenant, t.id]), { code: '23514' });
  const app = await connectFixture();
  try {
    for (const sql of ['DELETE FROM pilot.audit', 'UPDATE pilot.audit SET reason=reason',
      'INSERT INTO pilot.expired_occurrence_decisions DEFAULT VALUES', 'DELETE FROM pilot.expired_occurrence_decisions',
      'SELECT * FROM pilot.fixture_audit_disposition']) await assert.rejects(app.query(sql), { code: '42501' });
  } finally { await app.end(); }
  const before = await auditDigest(db);
  await db.query(`CREATE CONSTRAINT TRIGGER reject_expiry_test AFTER DELETE ON pilot.audit
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pilot.reject_mutation()`);
  try { await assert.rejects(expire(t), { code: '23514' }); }
  finally { await db.query('DROP TRIGGER reject_expiry_test ON pilot.audit'); }
  assert.deepEqual(await auditDigest(db), before);
  assert.equal((await db.query('SELECT 1 FROM pilot.expired_occurrence_decisions')).rowCount, 0);
  assert.equal((await db.query('SELECT 1 FROM pilot.fixture_audit_disposition WHERE expiry_xid IS NOT NULL')).rowCount, 0);
}

type Sessions = Parameters<typeof seedDomain>[1];

async function seed(db: Client, sessions: Sessions) {
  const domain = await seedDomain(db, sessions);
  const down = await readFile('db/migrations/016_occurrence_decisions.down.sql', 'utf8');
  const up = await readFile('db/migrations/016_occurrence_decisions.up.sql', 'utf8');
  await db.query('BEGIN');
  await db.query(down);
  assert.equal((await db.query("SELECT 1 FROM pilot.audit WHERE action IN ('approval_withdrawal','occurrence_hold')")).rowCount, 4);
  await db.query(up);
  await db.query('COMMIT');
  assert.equal((await db.query('SELECT 1 FROM pilot.expired_occurrence_decisions')).rowCount, 0);
  assert.equal((await db.query('SELECT 1 FROM pilot.occurrence_decisions')).rowCount, 4);
  // Put every domain event strictly before the old organization's trusted millisecond clock.
  const old = new Date((await db.query("SELECT clock_timestamp()+interval '1 second' AS at")).rows[0].at);
  const young = new Date(old.getTime()+86_400_000);
  async function organization(marker: string, at: Date) {
    const proof = await seedManagementSession(db, at, at);
    const { tenantId } = await createOrganization(connectFixture, { ...proof, action: 'organization_create' },
      marker, marker, () => at);
    return target(db, tenantId, 'organization_create', at);
  }
  const expired = await organization('Synthetic expired', old);
  const held = await organization('Synthetic incident', old);
  const fresh = await organization('Synthetic fresh', young);
  const others = await seedSecurity(db, sessions.manager, domain.withdrawn.tenant, old);
  assert.equal(await expire(expired), 'ineligible');
  for (const t of [expired, held, fresh]) await authorize(db, t, t === fresh ? young : old);
  const domainTargets = [];
  for (const [tenant, action, at] of [
    [domain.held.tenant, 'occurrence_hold', clock().toISOString()],
    [domain.withdrawn.tenant, 'approval_withdrawal', domain.firstAt],
    [domain.withdrawn.tenant, 'approval_withdrawal', domain.secondAt],
  ] as const) {
    const t = await target(db, tenant, action, at);
    await authorize(db, t, at);
    domainTargets.push(t);
  }
  const incident = await target(db, domain.revokedSend.tenant, 'approval_withdrawal', domain.incidentAt);
  await authorize(db, incident, domain.incidentAt);
  await checkRefusals(db, domainTargets[0]!);
  await applyHoldFirst(db, incident);
  await applyHoldFirst(db, held);
  const protectedDetails = async () => (await db.query(`SELECT md5(string_agg(to_jsonb(a)::text,',' ORDER BY id)) AS digest
    FROM pilot.audit a WHERE id=ANY($1::uuid[])`, [[incident.id, held.id, fresh.id]])).rows[0].digest;
  const originalDetails = await protectedDetails();
  const before = await auditDigest(db);
  for (const t of domainTargets) {
    assert.equal(await expire(t, t.previous), 'ineligible');
    assert.equal((await db.query('SELECT 1 FROM pilot.audit WHERE tenant_id=$1 AND id=$2', [t.tenant,t.id])).rowCount, 1);
    assert.deepEqual((await Promise.all([expire(t), expire(t)])).sort(), ['expired','ineligible']);
    assert.equal((await db.query('SELECT 1 FROM pilot.occurrence_decisions')).rowCount, 4);
  }
  await db.query('BEGIN');
  try { await assert.rejects(db.query(down), { code: '23514', message: 'Expired decision detail prevents this downgrade' }); }
  finally { await db.query('ROLLBACK'); }
  const afterDomain = await auditDigest(db);
  assert.equal(await expire(expired, expired.previous), 'ineligible');
  assert.equal(await expire(fresh, expired.boundary), 'ineligible');
  assert.deepEqual(await auditDigest(db), afterDomain);
  assert.deepEqual((await Promise.all([expire(expired), expire(expired)])).sort(), ['expired','ineligible']);
  for (const info of others) {
    const t = await target(db, info.tenant, info.action, info.at);
    await authorize(db, t, new Date(info.at.getTime()+1));
    assert.equal(await expire(t), 'ineligible');
    await db.query('UPDATE pilot.fixture_audit_disposition SET event_at=$1 WHERE audit_id=$2 AND tenant_id=$3', [info.at, t.id, t.tenant]);
    assert.equal(await expire(t, t.previous), 'ineligible');
    assert.equal(await expire(t), 'expired');
    assert.equal(await expire(t), 'ineligible');
  }
  const remaining = await auditDigest(db);
  assert.equal(remaining.count, before.count-8);
  assert.equal((await db.query(`SELECT 1 FROM pilot.audit WHERE action IN ('occurrence_hold','approval_withdrawal')
    AND created_at<$1`, [old])).rowCount, 1);
  assert.equal(await protectedDetails(), originalDetails);
  assert.equal((await db.query('SELECT 1 FROM pilot.audit WHERE id=ANY($1::uuid[])', [[held.id, fresh.id]])).rowCount, 2);
  return { expired, held, fresh, incident, domainTargets, remaining, domain, beforeCount: before.count };
}

async function isolated(stage: string, saved?: string) {
  const f = await loadFixture();
  assert.ok(f.purpose === 'audit-retention' && !f.restoreTarget && !f.pairedRestore);
  const db = await connectFixture(true);
  try {
    assert.equal((await db.query("SELECT 1 FROM public.fixture_identity WHERE id=$1 AND purpose='audit-retention' AND NOT restore_target",
      [f.id])).rowCount, 1);
    const request = JSON.parse(await readFile(authFile, 'utf8')) as Sessions;
    if (stage === 'expiry') {
      assert.equal((await db.query('SELECT 1 FROM pilot.tenants LIMIT 1')).rowCount, 0, 'Fresh empty fixture required');
      console.log(JSON.stringify(await seed(db, request)));
    } else {
      assert.equal(stage, 'retained');
      const state = JSON.parse(saved!) as Awaited<ReturnType<typeof seed>>;
      assert.deepEqual(await auditDigest(db), state.remaining);
      for (const t of state.domainTargets) assert.equal(await expire(t), 'ineligible');
      assert.equal(await expire(state.incident), 'ineligible');
      assert.equal((await db.query('SELECT 1 FROM pilot.expired_occurrence_decisions')).rowCount, 3);
      for (const t of [state.expired, state.held, state.fresh]) assert.equal(await expire(t, state.expired.boundary), 'ineligible');
      await verifyDomain(db, request, state.domain);
    }
  } finally { await db.end(); }
}

async function drill() {
  const f = await loadFixture();
  assert.ok(usesLocalDocker() && f.purpose === 'audit-retention' && !f.restoreTarget && !f.pairedRestore);
  const phase = (...args: string[]) => runIsolatedFixture(f, [entry, ...args], true).output;
  const start = performance.now();
  await writeFile(authFile, JSON.stringify({ manager: binding(), heldManager: binding() }), { flag: 'wx', mode: 0o600 });
  try {
    const saved = phase('expiry');
    const result = JSON.parse(saved) as Awaited<ReturnType<typeof seed>>;
    console.log(`Seven classes expired at 90 days: ${result.beforeCount} to ${result.remaining.count} online rows. Three decision keys retained.`);
    for (const args of [['down'], ['up', 'audit-retention']]) {
      execFileSync(process.execPath, [stack, ...args], { stdio: 'pipe', timeout: 180_000 });
    }
    phase('retained', saved);
    console.log(`Retained audit digest and authorization verified after restart (${Math.round((performance.now()-start)/1000)} seconds total).`);
  } finally { await rm(authFile); }
}

(process.env.PILOT_CONTAINER === '1' ? isolated(process.argv[2]!, process.argv[3]) : drill()).catch(error => {
  console.error(safeDiagnostics(String(error)));
  process.exitCode = 1;
});
