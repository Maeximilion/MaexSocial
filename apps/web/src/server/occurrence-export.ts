import type { Client } from 'pg';
import { deny, uuid } from '../../../../packages/contracts/management.js';
import type { InspectIdentity } from '../../../../packages/contracts/pilot.js';
import { requireCustomerRequest, type CustomerRequest } from './request.js';
import { lockIdentities, tokenHash } from './session.js';

// Private entry point for the isolated pilot. The authenticated route belongs to Task 4 integration.
export async function claimExport(connect: () => Promise<Client>, binding: CustomerRequest, occurrenceId: string,
  clock: () => Date, inspect: InspectIdentity): Promise<{ state: 'exported'; text: string }> {
  binding = { ...binding };
  if (!uuid(occurrenceId) || !/^[a-f0-9]{64}$/.test(binding.token)) return deny();

  const db = await connect();
  try {
    await db.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    // Discover the lock keys only. Revalidate all bindings after acquiring the locks.
    const candidate = (await db.query<{
      tenant_id: string; draft_id: string; caller_id: string; approver_id: string; approval_id: string;
    }>(`SELECT s.tenant_id,o.draft_id,s.identity_id AS caller_id,m.identity_id AS approver_id,o.approval_id
      FROM pilot.sessions s
      JOIN pilot.occurrences o ON o.tenant_id=s.tenant_id AND o.id=$2
      JOIN pilot.approvals a ON a.tenant_id=o.tenant_id AND a.occurrence_id=o.id AND a.id=o.approval_id
      JOIN pilot.memberships m ON m.tenant_id=a.tenant_id AND m.id=a.membership_id
      WHERE s.token_hash=$1 AND s.audience='customer'`, [tokenHash(binding.token), occurrenceId])).rows[0] ?? deny();

    await lockIdentities(db, [candidate.caller_id, candidate.approver_id]);
    const caller = await requireCustomerRequest(db, binding, clock, inspect, 'read-only');
    if (caller.tenantId !== candidate.tenant_id || caller.identityId !== candidate.caller_id
      || (caller.role !== 'Employee' && caller.role !== 'Manager')) return deny();
    const { tenantId } = caller;
    const draft = await db.query('SELECT id FROM pilot.drafts WHERE tenant_id=$1 AND id=$2 FOR UPDATE',
      [tenantId, candidate.draft_id]);
    if (draft.rowCount !== 1) return deny();
    const target = (await db.query<{ state: 'approved' | 'exported'; location_id: string }>(`SELECT state,location_id
      FROM pilot.occurrences WHERE tenant_id=$1 AND id=$2 AND draft_id=$3 AND state IN ('approved','exported')
      FOR UPDATE`, [tenantId, occurrenceId, candidate.draft_id])).rows[0] ?? deny();
    const destination = await db.query('SELECT id FROM pilot.locations WHERE tenant_id=$1 AND id=$2 FOR SHARE',
      [tenantId, target.location_id]);
    if (destination.rowCount !== 1) return deny();

    // Read attempts after locking the occurrence. Allow one evidenced loss of access to the same destination.
    const approval = (await db.query<{ text: string }>(`SELECT r.text FROM pilot.occurrences o
      JOIN pilot.locations l ON l.tenant_id=o.tenant_id AND l.id=o.location_id
      JOIN pilot.approvals a ON a.tenant_id=o.tenant_id AND a.occurrence_id=o.id AND a.id=o.approval_id
        AND a.draft_id=o.draft_id AND a.location_id=l.id AND a.provider_location=l.provider_location
        AND a.due_at=o.due_at AND a.timezone=o.timezone
      JOIN pilot.memberships m ON m.tenant_id=a.tenant_id AND m.id=a.membership_id
        AND m.version=a.membership_version AND m.active AND m.role='Manager'
      JOIN pilot.identities i ON i.id=m.identity_id AND i.verified
      JOIN pilot.draft_revisions r ON r.tenant_id=a.tenant_id AND r.draft_id=a.draft_id AND r.id=a.revision_id
      WHERE o.tenant_id=$1 AND o.id=$2 AND i.id=$3 AND NOT l.grant_active AND a.tenant_version=$4 AND a.id=$5
        AND (a.grant_version=l.version OR (a.grant_active_at_approval AND a.grant_version=l.version-1))
        AND NOT EXISTS (SELECT 1 FROM pilot.draft_revisions newer
          WHERE newer.tenant_id=r.tenant_id AND newer.draft_id=r.draft_id AND newer.revision>r.revision)
        AND NOT EXISTS (SELECT 1 FROM pilot.attempts p WHERE p.tenant_id=o.tenant_id AND p.occurrence_id=o.id)
        AND NOT EXISTS (SELECT 1 FROM pilot.audit h
          WHERE h.tenant_id=o.tenant_id AND h.occurrence_id=o.id AND h.action='occurrence_hold')
      FOR SHARE OF m`, [tenantId, occurrenceId, candidate.approver_id, caller.tenantVersion, candidate.approval_id])).rows[0] ?? deny();

    const current = await requireCustomerRequest(db, binding, clock, inspect, 'read-only');
    if (current.tenantId !== tenantId || current.identityId !== caller.identityId
      || (current.role !== 'Employee' && current.role !== 'Manager')) return deny();
    if (target.state === 'approved') {
      const updated = await db.query("UPDATE pilot.occurrences SET state='exported' WHERE tenant_id=$1 AND id=$2",
        [tenantId, occurrenceId]);
      const audit = await db.query(`INSERT INTO pilot.audit(tenant_id,actor_id,occurrence_id,action,reason,outcome)
        VALUES($1,$2,$3,'occurrence_export','Google access unavailable','exported')`,
      [tenantId, current.identityId, occurrenceId]);
      if (updated.rowCount !== 1 || audit.rowCount !== 1) return deny();
    }
    await db.query('COMMIT');
    return { state: 'exported', text: approval.text };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    await db.end();
  }
}
