import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { Client } from 'pg';
import { approveOccurrence, readApprovalProposal, withdrawApproval } from '../../apps/web/src/routes/content.js';
import { revokeEmployeeMembership } from '../../apps/web/src/routes/employee-revocation.js';
import { issueManagementInvitation } from '../../apps/web/src/server/invitation-issue.js';
import { revokeManagementMembership } from '../../apps/web/src/server/management-membership-revocation.js';
import { claimExport } from '../../apps/web/src/server/occurrence-export.js';
import { requireCustomerRequest, type CustomerRequest } from '../../apps/web/src/server/request.js';
import { claimDispatch } from '../../apps/worker/src/dispatch.js';
import { connectFixture } from '../../ops/local/fixture.js';
import { changeMembershipRole } from '../../packages/contracts/management-role-change.js';
import { holdOccurrence } from '../../packages/contracts/occurrence.js';
import { binding, clock, inspect, seedDispatchApproval } from './dispatch-fixture.js';
import { seedManagementContext, seedTenant } from './fixtures.js';

type Sessions = { manager: CustomerRequest; heldManager: CustomerRequest };

async function preview(request: CustomerRequest, id: string) {
  const app = await connectFixture();
  try {
    await app.query('BEGIN');
    return await readApprovalProposal(app, await requireCustomerRequest(app, request, clock, inspect, 'read-only'), id);
  } finally { await app.end(); }
}

// The audit default uses the writer's transaction start. Witness it before the mutation, with DB precision.
async function witnessedWithdrawal(request: CustomerRequest, id: string, approval: string) {
  const app = await connectFixture();
  let instant: string | undefined;
  const observe = async (subject: string) => {
    instant ??= (await app.query('SELECT transaction_timestamp()::text AS at')).rows[0].at;
    return inspect(subject);
  };
  assert.ok(await withdrawApproval(async () => app, request, id, approval, clock, observe));
  assert.ok(instant);
  return instant;
}

export async function seedDomain(db: Client, sessions: Sessions) {
  const request = sessions.manager;
  const held = await seedDispatchApproval(sessions.heldManager, true);
  const operator = await seedManagementContext(db, held.tenant, clock(), clock());
  const proof = { ...operator, occurrenceId: held.id };
  assert.equal(await holdOccurrence(connectFixture, proof, held.tenant, held.id, 'Synthetic hold', clock), 'held');
  const withdrawn = await seedDispatchApproval(request, false);
  const firstAt = await witnessedWithdrawal(request, withdrawn.id, withdrawn.approvalId);
  const intermediate = await preview(request, withdrawn.id);
  assert.equal(intermediate.withdrawalCount, '1');
  const secondApproval = await approveOccurrence(connectFixture, request, intermediate, clock, inspect);
  const secondAt = await witnessedWithdrawal(request, withdrawn.id, secondApproval);
  const sender = binding();
  const revokedSend = await seedDispatchApproval(sender, true);
  const incidentAt = await witnessedWithdrawal(sender, revokedSend.id, revokedSend.approvalId);
  const control = await seedDispatchApproval(binding(), true);
  await db.query('UPDATE pilot.dispatch_control SET stopped=false WHERE singleton');
  const independent = await seedDispatchApproval(binding(), false);
  return { held, withdrawn, intermediate, secondApproval, firstAt, secondAt, incidentAt, revokedSend, control, independent };
}

export async function verifyDomain(db: Client, sessions: Sessions, domain: Awaited<ReturnType<typeof seedDomain>>) {
  const { held, withdrawn, revokedSend, control, independent } = domain;
  const request = sessions.manager;
  async function effects(id: string) {
    return (await db.query(`SELECT o.state,o.approval_id,
      (SELECT count(*)::int FROM pilot.attempts WHERE occurrence_id=o.id) AS attempts,
      (SELECT count(*)::int FROM pilot.audit WHERE occurrence_id=o.id AND action='occurrence_export') AS exports
      FROM pilot.occurrences o WHERE id=$1`, [id])).rows[0];
  }
  const isolated = { state: 'approved', approval_id: independent.approvalId, attempts: 0, exports: 0 };
  assert.deepEqual(await effects(independent.id), isolated);
  const denied = (p: Promise<unknown>) => assert.rejects(p, { message: 'Denied' });
  const fake = { policy: 'synthetic-organic-text' as const, async create() { return assert.fail('Unexpected create'); } };
  assert.equal((await db.query('SELECT state FROM pilot.occurrences WHERE id=$1', [held.id])).rows[0].state, 'held');
  await denied(claimDispatch(connectFixture, held.id, fake));
  await denied(claimExport(connectFixture, sessions.heldManager, held.id, clock, inspect));
  // Exercise the historical-hold predicate even if lifecycle state no longer says held.
  await db.query("UPDATE pilot.occurrences SET state='approved' WHERE id=$1", [held.id]);
  await denied(claimDispatch(connectFixture, held.id, fake));
  await db.query('UPDATE pilot.locations SET grant_active=false,version=version+1 WHERE tenant_id=$1', [held.tenant]);
  await denied(claimExport(connectFixture, sessions.heldManager, held.id, clock, inspect));
  await denied(withdrawApproval(connectFixture, sessions.heldManager, held.id, held.approvalId, clock, inspect));
  await db.query("UPDATE pilot.occurrences SET state='held' WHERE id=$1", [held.id]);
  assert.deepEqual(await effects(held.id), { state: 'held', approval_id: held.approvalId, attempts: 0, exports: 0 });
  await denied(claimDispatch(connectFixture, revokedSend.id, fake));
  let sends = 0;
  const provider = { policy: 'synthetic-organic-text' as const, async create(intent: { attemptId: string; locationId: string }) {
    sends++;
    return { attemptId: intent.attemptId, location: intent.locationId };
  } };
  assert.equal((await claimDispatch(connectFixture, control.id, provider)).state, 'in_flight');
  await denied(claimDispatch(connectFixture, control.id, provider));
  assert.equal(sends, 1);
  await denied(claimExport(connectFixture, request, withdrawn.id, clock, inspect));
  assert.equal(await withdrawApproval(connectFixture, request, withdrawn.id, withdrawn.approvalId, clock, inspect), false);
  await denied(approveOccurrence(connectFixture, request, withdrawn.proposal, clock, inspect));
  await denied(approveOccurrence(connectFixture, request, domain.intermediate, clock, inspect));
  const fresh = await preview(request, withdrawn.id);
  assert.equal(fresh.withdrawalCount, '2');
  const next = await approveOccurrence(connectFixture, request, fresh, clock, inspect);
  for (const old of [withdrawn.approvalId, domain.secondApproval]) {
    assert.notEqual(next, old);
    assert.equal(await withdrawApproval(connectFixture, request, withdrawn.id, old, clock, inspect), false);
  }
  assert.deepEqual(await effects(withdrawn.id), { state: 'approved', approval_id: next, attempts: 0, exports: 0 });
  assert.equal((await claimExport(connectFixture, request, withdrawn.id, clock, inspect)).state, 'exported');
  assert.deepEqual(await effects(withdrawn.id), { state: 'exported', approval_id: next, attempts: 0, exports: 1 });
  assert.deepEqual(await effects(independent.id), isolated);
}

// Exercise the four other non-occurrence security writers; their authority lives in memberships and invitations.
export async function seedSecurity(db: Client, request: CustomerRequest, tenant: string, at: Date) {
  const f = await seedTenant(db);
  await db.query('UPDATE pilot.identities SET verified=true,version=version+1 WHERE id=$1', [f.user]);
  const proof = await seedManagementContext(db, f.tenant, at, at);
  const recipient = 'audit-drill@example.invalid';
  const issuer = { connect: connectFixture, clock: () => at, mailboxCa: await readFile('work/pilot/mailbox.crt') };
  const invitation = await issueManagementInvitation(issuer, { ...proof, action: 'invitation_issue', role: 'Employee', recipient },
    f.tenant, recipient, 'Employee', 'Synthetic invitation');
  assert.equal(invitation.delivery, 'captured');
  assert.ok(await changeMembershipRole(connectFixture, { ...proof, membershipId: f.membership, membershipVersion: 1,
    role: 'Employee' }, f.tenant, f.membership, 'Employee', 'Synthetic role', () => at));
  assert.ok(await revokeManagementMembership(connectFixture, { ...proof, membershipId: f.membership, membershipVersion: 2,
    action: 'membership_revoke' }, f.tenant, f.membership, 'Synthetic revoke', () => at, new Map()));
  const { rows: [employee] } = await db.query(`SELECT m.id,i.subject FROM pilot.memberships m JOIN pilot.identities i
    ON i.id=m.identity_id WHERE m.tenant_id=$1 AND m.role='Employee'`, [tenant]);
  const app = await connectFixture();
  try {
    await app.query('BEGIN');
    assert.ok(await revokeEmployeeMembership(app, request, employee.id, clock, inspect, new Map([[employee.subject, recipient]])));
    await app.query('COMMIT');
  } finally { await app.end(); }
  return [
    { tenant: f.tenant, action: 'invitation_issue', at },
    { tenant: f.tenant, action: 'membership_role_changed', at },
    { tenant: f.tenant, action: 'membership_revoked', at },
    { tenant, action: 'employee_membership_revoked', at: clock() },
  ];
}
