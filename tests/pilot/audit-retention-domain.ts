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

export async function seedDomain(db: Client, request: CustomerRequest) {
  const held = await seedDispatchApproval(binding(), true);
  const operator = await seedManagementContext(db, held.tenant, clock(), clock());
  const proof = { ...operator, occurrenceId: held.id };
  assert.equal(await holdOccurrence(connectFixture, proof, held.tenant, held.id, 'Synthetic hold', clock), 'held');
  const withdrawn = await seedDispatchApproval(request, false);
  assert.equal(await withdrawApproval(connectFixture, request, withdrawn.id, withdrawn.approvalId, clock, inspect), true);
  const sender = binding();
  const revokedSend = await seedDispatchApproval(sender, true);
  assert.ok(await withdrawApproval(connectFixture, sender, revokedSend.id, revokedSend.approvalId, clock, inspect));
  const control = await seedDispatchApproval(binding(), true);
  await db.query('UPDATE pilot.dispatch_control SET stopped=false WHERE singleton');
  return { held, withdrawn, revokedSend, control };
}

export async function verifyDomain(db: Client, request: CustomerRequest, domain: Awaited<ReturnType<typeof seedDomain>>) {
  const { held, withdrawn, revokedSend, control } = domain;
  const denied = (p: Promise<unknown>) => assert.rejects(p, { message: 'Denied' });
  const fake = { policy: 'synthetic-organic-text' as const, async create() { return assert.fail('Unexpected create'); } };
  assert.equal((await db.query('SELECT state FROM pilot.occurrences WHERE id=$1', [held.id])).rows[0].state, 'held');
  await denied(claimDispatch(connectFixture, held.id, fake));
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
  const app = await connectFixture();
  const fresh = await (async () => {
    try {
      await app.query('BEGIN');
      return await readApprovalProposal(app, await requireCustomerRequest(app, request, clock, inspect, 'read-only'), withdrawn.id);
    } finally { await app.end(); }
  })();
  assert.equal(fresh.withdrawalCount, '1');
  assert.notEqual(await approveOccurrence(connectFixture, request, fresh, clock, inspect), withdrawn.approvalId);
  assert.equal((await claimExport(connectFixture, request, withdrawn.id, clock, inspect)).state, 'exported');
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
