import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { test } from 'node:test';
import { approveOccurrence, readApprovalProposal } from '../../apps/web/src/routes/content.js';
import { claimExport } from '../../apps/web/src/server/occurrence-export.js';
import { requireCustomerRequest } from '../../apps/web/src/server/request.js';
import { tokenHash } from '../../apps/web/src/server/session.js';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';
import type { InspectIdentity } from '../../packages/contracts/pilot.js';
import { FakeGbp } from './fake-gbp.js';
import { occurrence, seedManagementContext, seedTenant } from './fixtures.js';

const clock = () => new Date('2030-01-01T10:00:00Z');
const inspect: InspectIdentity = async subject => ({
  subject, verified: true, enabled: true, requiredActions: [], credentials: [{ id: 'synthetic-otp', type: 'otp' }]
});
const exported = { state: 'exported', text: 'Invented plain text' };

test('private terminal export commits approved text only under current authority', async t => {
  if (process.env.PILOT_CONTAINER !== '1') {
    console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/occurrence-export.test.js']));
    return;
  }

  const providerDirectory = await mkdtemp(join('/dev/shm', 'maex-252-provider-'));
  let fake: FakeGbp | undefined;
  t.after(async () => {
    fake?.close();
    await rm(providerDirectory, { recursive: true, force: true });
  });
  fake = new FakeGbp(providerDirectory);
  const owner = await connectFixture(true);
  try {
    const a = await seedTenant(owner), b = await seedTenant(owner);
    const session = async (tenantId: string, role: 'Manager' | 'Employee') => {
      const binding = { token: randomBytes(32).toString('hex'), csrf: randomBytes(32).toString('hex') };
      await owner.query(`UPDATE pilot.identities i SET verified=true,version=i.version+1 FROM pilot.memberships m
        WHERE m.tenant_id=$1 AND m.role=$2 AND m.identity_id=i.id AND NOT i.verified`, [tenantId, role]);
      await owner.query(`INSERT INTO pilot.sessions(token_hash,csrf_hash,identity_id,identity_version,tenant_id,tenant_version,
        membership_id,membership_version,audience,created_at,last_seen_at,expires_at,mfa_at,mfa_credential_id)
        SELECT $1,$2,i.id,i.version,t.id,t.version,m.id,m.version,'customer',
          '2030-01-01T09:55Z','2030-01-01T09:56Z','2030-01-01T11:00Z','2030-01-01T09:59Z','synthetic-otp'
        FROM pilot.memberships m JOIN pilot.identities i ON i.id=m.identity_id JOIN pilot.tenants t ON t.id=m.tenant_id
        WHERE t.id=$3 AND m.role=$4`, [tokenHash(binding.token), tokenHash(binding.csrf), tenantId, role]);
      return binding;
    };
    const manager = await session(a.tenant, 'Manager'), employee = await session(a.tenant, 'Employee');
    const outside = await session(b.tenant, 'Manager');
    const approved = async (tenant = a, binding = manager) => {
      const id = await occurrence(owner, tenant);
      const db = await connectFixture();
      const proposal = await (async () => {
        try {
          await db.query('BEGIN');
          return await readApprovalProposal(db, await requireCustomerRequest(db, binding, clock, inspect, 'read-only'), id);
        } finally {
          await db.query('ROLLBACK');
          await db.end();
        }
      })();
      const approvalId = await approveOccurrence(connectFixture, binding, proposal, clock, inspect);
      return { id, approvalId };
    };
    const claim = (id: string, binding = employee) => claimExport(connectFixture, binding, id, clock, inspect);
    const rows = async (sql: string, values: unknown[]) => (await owner.query(sql, values)).rows;
    const state = (id: string) => rows('SELECT state,approval_id FROM pilot.occurrences WHERE id=$1', [id]);
    const audit = (id: string) => rows(`SELECT actor_id,action,outcome FROM pilot.audit WHERE occurrence_id=$1 ORDER BY id`, [id]);
    const denied = async (id: string, binding = employee) => {
      const before = [await state(id), await audit(id)];
      await assert.rejects(claim(id, binding), { message: 'Denied' });
      assert.deepEqual([await state(id), await audit(id)], before);
    };
    const control = await approved(b, outside);
    const controlState = await state(control.id);
    const first = await approved();
    const concurrent = await approved();
    const rollback = await approved();
    const attempted = await approved();
    const stale = await approved();
    const initialSessions = await rows(`SELECT token_hash,last_seen_at FROM pilot.sessions
      WHERE tenant_id=ANY($1::uuid[]) ORDER BY token_hash`, [[a.tenant, b.tenant]]);

    await t.test('Employee exports the exact snapshot and Manager repeats without another transition', async () => {
      assert.deepEqual(await claim(first.id), exported);
      const committed = [{ state: 'exported', approval_id: first.approvalId }];
      assert.deepEqual(await state(first.id), committed);
      assert.deepEqual(await claim(first.id, manager), exported);
      assert.deepEqual(await state(first.id), committed);
      const [event, ...duplicates] = await audit(first.id);
      const [actor] = await rows("SELECT identity_id FROM pilot.memberships WHERE tenant_id=$1 AND role='Employee'", [a.tenant]);
      assert.deepEqual(event, { actor_id: actor.identity_id, action: 'occurrence_export', outcome: 'exported' });
      assert.deepEqual(duplicates, []);
      await denied(first.id, outside);
    });

    await t.test('concurrent authorized callers converge on one committed transition', async () => {
      assert.deepEqual(await Promise.all([claim(concurrent.id), claim(concurrent.id, manager)]), [exported, exported]);
      assert.deepEqual(await state(concurrent.id), [{ state: 'exported', approval_id: concurrent.approvalId }]);
      assert.equal((await audit(concurrent.id)).length, 1);
    });

    await t.test('a deferred audit failure at commit releases no result and rolls both records back', async () => {
      await owner.query(`CREATE CONSTRAINT TRIGGER fixture_export_commit_failure AFTER INSERT ON pilot.audit
        DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pilot.reject_mutation()`);
      try {
        await assert.rejects(claim(rollback.id), { code: '23514' });
        assert.deepEqual(await state(rollback.id), [{ state: 'approved', approval_id: rollback.approvalId }]);
        assert.deepEqual(await audit(rollback.id), []);
      } finally {
        await owner.query('DROP TRIGGER fixture_export_commit_failure ON pilot.audit');
      }
      assert.deepEqual(await claim(rollback.id), exported);
    });

    await t.test('an attempt that commits while export waits wins', async () => {
      const blocker = await connectFixture();
      try {
        await blocker.query('BEGIN');
        await blocker.query('SELECT id FROM pilot.occurrences WHERE id=$1 FOR UPDATE', [attempted.id]);
        await blocker.query('INSERT INTO pilot.attempts(tenant_id,occurrence_id,approval_id) VALUES($1,$2,$3)',
          [a.tenant, attempted.id, attempted.approvalId]);
        const pid = (await blocker.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        const losingExport = assert.rejects(claim(attempted.id), { message: 'Denied' });
        try {
          let waiting = false;
          for (let n = 0; n < 80 && !waiting; n++) {
            waiting = (await owner.query('SELECT 1 FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))', [pid])).rowCount === 1;
            if (!waiting) await setTimeout(25);
          }
          assert.equal(waiting, true);
          await blocker.query('COMMIT');
        } finally {
          await blocker.query('ROLLBACK');
          await losingExport;
        }
        assert.deepEqual(await state(attempted.id), [{ state: 'approved', approval_id: attempted.approvalId }]);
        assert.deepEqual(await audit(attempted.id), []);
      } finally { await blocker.end(); }
    });

    await t.test('state, hold history, audience, approval binding and active Google grant independently deny', async () => {
      const held = await approved(), quarantined = await approved(), previouslyHeld = await approved();
      await owner.query("UPDATE pilot.occurrences SET state='held' WHERE id=$1", [held.id]);
      await owner.query("UPDATE pilot.occurrences SET state='quarantined' WHERE id=$1", [quarantined.id]);
      await owner.query(`INSERT INTO pilot.audit(tenant_id,actor_id,occurrence_id,action,reason,outcome)
        VALUES($1,$2,$3,'occurrence_hold','Synthetic earlier hold','held')`, [a.tenant, a.user, previouslyHeld.id]);
      for (const id of [held.id, quarantined.id, previouslyHeld.id, control.id]) await denied(id);

      const operator = await seedManagementContext(owner, a.tenant, clock(), clock());
      const management = { token: randomBytes(32).toString('hex'), csrf: employee.csrf };
      await owner.query('UPDATE pilot.sessions SET token_hash=$2 WHERE id=$1', [operator.sessionId, tokenHash(management.token)]);
      await denied(stale.id, management);
      await denied(stale.id, { ...employee, csrf: outside.csrf });

      await owner.query("UPDATE pilot.occurrences SET due_at=due_at+interval '1 microsecond' WHERE id=$1", [stale.id]);
      await denied(stale.id);
      await owner.query("UPDATE pilot.occurrences SET due_at=due_at-interval '1 microsecond' WHERE id=$1", [stale.id]);
      await owner.query('UPDATE pilot.locations SET version=version+1 WHERE tenant_id=$1 AND id=$2', [a.tenant, a.location]);
      await denied(stale.id);
      await owner.query('UPDATE pilot.locations SET grant_active=true,version=version+1 WHERE tenant_id=$1 AND id=$2',
        [a.tenant, a.location]);
      const connected = await approved();
      await denied(connected.id);
      await owner.query(`UPDATE pilot.locations SET grant_active=false,version=version+1,provider_location='Different destination'
        WHERE tenant_id=$1 AND id=$2`, [a.tenant, a.location]);
      await denied(connected.id);
    });

    await t.test('both roles export revision two after a recorded grant loss and reconnect blocks further downloads', async () => {
      const c = await seedTenant(owner);
      const approving = await session(c.tenant, 'Manager'), exporting = await session(c.tenant, 'Employee');
      await owner.query("INSERT INTO pilot.draft_revisions(tenant_id,draft_id,revision,text) VALUES($1,$2,2,'Second approved revision')",
        [c.tenant, c.draft]);
      const setAccess = (active: boolean) => owner.query(`UPDATE pilot.locations SET grant_active=$3,version=version+1
        WHERE tenant_id=$1 AND id=$2`, [c.tenant, c.location, active]);
      await setAccess(true);
      const employeeExport = await approved(c, approving), managerExport = await approved(c, approving);
      const legacy = await approved(c, approving);
      await owner.query(`WITH historical AS (
        INSERT INTO pilot.approvals(tenant_id,occurrence_id,draft_id,revision_id,location_id,provider_location,
          membership_id,membership_version,grant_version,due_at,timezone,mfa_at)
        SELECT tenant_id,occurrence_id,draft_id,revision_id,location_id,provider_location,membership_id,membership_version,
          grant_version,due_at,timezone,mfa_at FROM pilot.approvals WHERE tenant_id=$1 AND id=$2 RETURNING id
      ) UPDATE pilot.occurrences SET approval_id=historical.id FROM historical WHERE pilot.occurrences.id=$3`,
      [c.tenant, legacy.approvalId, legacy.id]);
      await denied(employeeExport.id, exporting);
      await setAccess(false);
      const expected = { state: 'exported', text: 'Second approved revision' };
      assert.deepEqual(await claim(employeeExport.id, exporting), expected);
      assert.deepEqual(await claim(managerExport.id, approving), expected);
      assert.deepEqual(await claim(employeeExport.id, approving), expected);
      await denied(legacy.id, exporting);
      await setAccess(true);
      for (const target of [employeeExport, managerExport]) {
        await denied(target.id, exporting);
        assert.deepEqual(await state(target.id), [{ state: 'exported', approval_id: target.approvalId }]);
        assert.equal(fake!.createCount(c.tenant, target.id), 0);
      }
    });

    await t.test('new revision, stale approving Manager and revoked caller require current authority', async () => {
      const oldRevision = await approved();
      await owner.query("INSERT INTO pilot.draft_revisions(tenant_id,draft_id,revision,text) VALUES($1,$2,2,'Synthetic newer text')",
        [a.tenant, a.draft]);
      await denied(oldRevision.id);
      const reapproved = await approved();
      await owner.query('UPDATE pilot.memberships SET version=version+1 WHERE tenant_id=$1 AND id=$2', [a.tenant, a.membership]);
      await denied(reapproved.id);
      const currentManager = await session(a.tenant, 'Manager');
      const newExport = await approved(a, currentManager);
      assert.deepEqual(await claim(newExport.id), { state: 'exported', text: 'Synthetic newer text' });
      await owner.query('UPDATE pilot.sessions SET revoked_at=$2 WHERE token_hash=$1', [tokenHash(employee.token), clock()]);
      await denied(newExport.id);
      assert.deepEqual(await claim(newExport.id, currentManager), { state: 'exported', text: 'Synthetic newer text' });
    });

    assert.deepEqual(await state(control.id), controlState);
    assert.deepEqual(await audit(control.id), []);
    assert.deepEqual(await rows(`SELECT token_hash,last_seen_at FROM pilot.sessions
      WHERE token_hash=ANY($1::text[]) ORDER BY token_hash`, [initialSessions.map(row => row.token_hash)]), initialSessions);
    assert.deepEqual(await rows('SELECT occurrence_id FROM pilot.attempts WHERE tenant_id=ANY($1::uuid[])',
      [[a.tenant, b.tenant]]), [{ occurrence_id: attempted.id }]);
    for (const id of [first.id, concurrent.id, rollback.id, attempted.id, stale.id]) {
      assert.equal(fake.createCount(a.tenant, id), 0);
    }
    assert.equal(fake.createCount(b.tenant, control.id), 0);
  } finally { await owner.end(); }
});
