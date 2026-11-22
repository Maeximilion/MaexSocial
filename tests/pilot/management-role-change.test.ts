import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { approveOccurrence, readApprovalProposal } from '../../apps/web/src/routes/content.js';
import { requireCustomerRequest } from '../../apps/web/src/server/request.js';
import { requireManagerMfa, tokenHash } from '../../apps/web/src/server/session.js';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';
import { changeMembershipRole, type ManagementRoleChangeContext } from '../../packages/contracts/management-role-change.js';
import type { CustomerRole, InspectIdentity } from '../../packages/contracts/pilot.js';
import { occurrence, seedManagementContext, seedTenant } from './fixtures.js';

const now = new Date('2030-01-01T10:00:00Z');
const stepUp = new Date(now.getTime() - 300_000);
const clock = () => now;
const factor = 'synthetic-otp';
const inspect: InspectIdentity = async subject => ({
  subject, enabled: true, verified: true, requiredActions: [], credentials: [{ id: factor, type: 'otp' }]
});

test('private membership role changes invalidate the selected grant and commit the matching audit', async t => {
  if (process.env.PILOT_CONTAINER !== '1') {
    console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/management-role-change.test.js']));
    return;
  }

  const owner = await connectFixture(true);
  try {
    const a = await seedTenant(owner), b = await seedTenant(owner);
    const foreignMembership = randomUUID();
    await owner.query('UPDATE pilot.identities SET verified=true,version=version+1 WHERE id=$1', [a.user]);
    await owner.query("UPDATE pilot.memberships SET role='Employee',version=version+1 WHERE tenant_id=$1 AND id=$2", [a.tenant, a.membership]);
    await owner.query("INSERT INTO pilot.memberships(tenant_id,id,identity_id,role) VALUES($1,$2,$3,'Manager')", [b.tenant, foreignMembership, a.user]);
    const operator = await seedManagementContext(owner, a.tenant, now, stepUp);

    const seedSession = async (tenantId: string, membershipId: string, version: number) => {
      const binding = { token: randomBytes(32).toString('hex'), csrf: randomBytes(32).toString('hex') };
      const id = (await owner.query<{ id: string }>(`INSERT INTO pilot.sessions(token_hash,csrf_hash,identity_id,identity_version,
        tenant_id,tenant_version,membership_id,membership_version,audience,created_at,last_seen_at,expires_at,mfa_at,mfa_credential_id)
        VALUES($1,$2,$3,2,$4,1,$5,$6,'customer',$7,$8,$9,$10,$11) RETURNING id`, [tokenHash(binding.token), tokenHash(binding.csrf),
        a.user, tenantId, membershipId, version, new Date(now.getTime() - 360_000), now, new Date(now.getTime() + 600_000), stepUp, factor])).rows[0]!.id;
      return { id, binding };
    };
    const readCustomer = async (binding: Awaited<ReturnType<typeof seedSession>>['binding'], id?: string) => {
      const db = await connectFixture();
      try {
        await db.query('BEGIN');
        const customer = await requireCustomerRequest(db, binding, clock, inspect, 'read-only');
        return { customer, proposal: id === undefined ? undefined : await readApprovalProposal(db, customer, id) };
      } finally {
        await db.query('ROLLBACK');
        await db.end();
      }
    };
    const approve = async (id: string, binding: Awaited<ReturnType<typeof seedSession>>['binding']) =>
      approveOccurrence(connectFixture, binding, (await readCustomer(binding, id)).proposal!, clock, inspect);
    const change = (role: CustomerRole, membershipVersion: number, reason = ' Confirmed local fixture ',
      overrides: Partial<ManagementRoleChangeContext> = {}, time = clock) =>
      changeMembershipRole(connectFixture, { ...operator, membershipId: a.membership, membershipVersion, role, ...overrides },
        a.tenant, a.membership, role, reason, time);
    const rows = async (query: string, args: unknown[]) => (await owner.query(query, args)).rows;
    const members = () => rows('SELECT id,identity_id,role,version,active FROM pilot.memberships WHERE tenant_id=$1 ORDER BY id', [a.tenant]);
    const audit = () => rows(`SELECT actor_id,device_id,membership_id,membership_version,action,reason,outcome,created_at
      FROM pilot.audit WHERE tenant_id=$1 ORDER BY membership_version`, [a.tenant]);
    const revokedAt = async (id: string) => (await rows('SELECT revoked_at FROM pilot.sessions WHERE id=$1', [id]))[0].revoked_at;
    const invited = () => rows('SELECT revoked_at FROM pilot.invitations WHERE tenant_id=$1 AND issuer_membership_id=$2', [a.tenant, a.membership]);
    const occurrenceState = async (id: string) =>
      (await rows('SELECT state,approval_id FROM pilot.occurrences WHERE id=$1', [id]))[0];
    const before = await members();
    const employee = await seedSession(a.tenant, a.membership, 2);
    const foreign = await seedSession(b.tenant, foreignMembership, 1);

    await t.test('first Manager promotion rejects stale proof and customer authority; concurrent retries audit once', async () => {
      assert.equal(before.filter(m => m.role === 'Manager').length, 0);
      assert.equal((await readCustomer(employee.binding)).customer.role, 'Employee');
      assert.equal(await change('Manager', 1), false);
      assert.equal(await change('Employee', 2), false);
      for (const invalid of [{ tenantId: b.tenant }, { membershipId: foreignMembership }, { role: 'Employee' as const },
        { sessionId: employee.id, identityId: a.user }, { deviceVersion: 2 }, { grantVersion: 2 }, { tenantVersion: 2 }]) {
        await assert.rejects(change('Manager', 2, 'Fixture', invalid), /Denied/);
      }
      await assert.rejects(changeMembershipRole(connectFixture, { ...operator, membershipId: foreignMembership,
        membershipVersion: 1, role: 'Employee' }, a.tenant, foreignMembership, 'Employee', 'Fixture', clock), /Denied/);
      await assert.rejects(change('Manager', 2, ' '), /Denied/);
      await assert.rejects(change('Manager', 2, 'Fixture', {}, () => new Date(now.getTime() + 1)), /Denied/);
      assert.deepEqual(await audit(), []);
      assert.deepEqual(await members(), before);

      const results = await Promise.all([change('Manager', 2), change('Manager', 2)]);
      assert.deepEqual(results.sort(), [false, true]);
      assert.deepEqual(await members(), before.map(m => m.id === a.membership ? { ...m, role: 'Manager', version: 3 } : m));
      await assert.rejects(readCustomer(employee.binding), /Denied/);
      assert.deepEqual(await revokedAt(employee.id), now);
      assert.equal((await readCustomer(foreign.binding)).customer.role, 'Manager');
      assert.deepEqual(await audit(), [{
        actor_id: operator.identityId, device_id: operator.deviceId, membership_id: a.membership, membership_version: 3,
        action: 'membership_role_changed', reason: 'Confirmed local fixture', outcome: 'Manager', created_at: now
      }]);
    });

    const manager = await seedSession(a.tenant, a.membership, 3);
    const open = await occurrence(owner, a), claimed = await occurrence(owner, a), outside = await occurrence(owner, b);
    const openApproval = await approve(open, manager.binding), claimedApproval = await approve(claimed, manager.binding);
    const exported = await occurrence(owner, a), quarantined = await occurrence(owner, a);
    const exportedApproval = await approve(exported, manager.binding), quarantinedApproval = await approve(quarantined, manager.binding);
    const outsideApproval = await approve(outside, foreign.binding);
    await owner.query('INSERT INTO pilot.attempts(tenant_id,occurrence_id,approval_id) VALUES($1,$2,$3)', [a.tenant, claimed, claimedApproval]);
    await owner.query("UPDATE pilot.occurrences SET state='exported' WHERE id=$1", [exported]);
    await owner.query("UPDATE pilot.occurrences SET state='quarantined' WHERE id=$1", [quarantined]);
    await owner.query("UPDATE pilot.occurrences SET state='in_flight' WHERE tenant_id=$1 AND id=$2", [a.tenant, claimed]);
    await owner.query(`INSERT INTO pilot.invitations(tenant_id,email,role,purpose,issuer_membership_id,issuer_version,
      grant_version,token_hash,created_at,expires_at) VALUES($1,'fixture@example.invalid','Employee','membership',$2,3,1,$3,$4,$5)`,
    [a.tenant, a.membership, tokenHash(randomUUID()), now, new Date(now.getTime() + 600_000)]);
    const history = () => rows('SELECT * FROM pilot.approvals WHERE id=ANY($1::uuid[]) ORDER BY id', [[openApproval, claimedApproval, exportedApproval, quarantinedApproval, outsideApproval]]);
    const historyBefore = await history();

    await t.test('failed audit rolls back the demotion, session, invitation and approval changes', async () => {
      const current = await members(), priorAudit = await audit();
      await owner.query("ALTER TABLE pilot.audit ADD CONSTRAINT test_role_audit_failure CHECK (reason <> 'Fixture audit failure')");
      try {
        await assert.rejects(change('Employee', 3, 'Fixture audit failure'),
          { code: '23514', constraint: 'test_role_audit_failure' });
        assert.deepEqual(await members(), current);
        assert.deepEqual(await audit(), priorAudit);
        assert.equal(await revokedAt(manager.id), null);
        assert.deepEqual(await invited(), [{ revoked_at: null }]);
        assert.deepEqual(await occurrenceState(open), { state: 'approved', approval_id: openApproval });
        assert.deepEqual(await history(), historyBefore);
      } finally {
        await owner.query('ALTER TABLE pilot.audit DROP CONSTRAINT test_role_audit_failure');
      }
    });

    await t.test('last Manager demotion removes open eligibility, preserves claims, and re-promotion needs fresh approval', async () => {
      assert.equal(await change('Employee', 3, 'Demote last Manager'), true);
      assert.deepEqual(await members(), before.map(m => m.id === a.membership ? { ...m, version: 4 } : m));
      await assert.rejects(readCustomer(manager.binding), /Denied/);
      assert.deepEqual(await revokedAt(manager.id), now);
      assert.deepEqual(await invited(), [{ revoked_at: now }]);
      assert.deepEqual(await occurrenceState(open), { state: 'draft', approval_id: null });
      assert.deepEqual(await occurrenceState(claimed), { state: 'in_flight', approval_id: claimedApproval });
      assert.deepEqual(await occurrenceState(exported), { state: 'exported', approval_id: exportedApproval });
      assert.deepEqual(await occurrenceState(quarantined), { state: 'quarantined', approval_id: quarantinedApproval });
      assert.deepEqual(await occurrenceState(outside), { state: 'approved', approval_id: outsideApproval });
      assert.deepEqual(await history(), historyBefore);
      const newEmployee = await seedSession(a.tenant, a.membership, 4);
      const { customer } = await readCustomer(newEmployee.binding);
      assert.throws(() => requireManagerMfa(customer, clock), /Denied/);
      assert.equal(await change('Manager', 4, 'Re-promote Manager'), true);
      assert.deepEqual(await occurrenceState(open), { state: 'draft', approval_id: null });
      await assert.rejects(readCustomer(newEmployee.binding), /Denied/);
      const nextManager = await seedSession(a.tenant, a.membership, 5);
      const newApproval = await approve(open, nextManager.binding);
      assert.notEqual(newApproval, openApproval);
      assert.deepEqual(await rows('SELECT membership_version FROM pilot.approvals WHERE id=$1', [newApproval]), [{ membership_version: 5 }]);
      assert.deepEqual(await history(), historyBefore);
      assert.deepEqual((await audit()).map(r => [r.membership_version, r.outcome, r.reason]),
        [[3, 'Manager', 'Confirmed local fixture'], [4, 'Employee', 'Demote last Manager'], [5, 'Manager', 'Re-promote Manager']]);
      assert.equal(await revokedAt(foreign.id), null);
      assert.equal((await readCustomer(foreign.binding)).customer.membershipVersion, 1);
    });
  } finally {
    await owner.end();
  }
});
