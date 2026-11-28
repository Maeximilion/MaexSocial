import type { Client } from 'pg';
import { deny, uuid } from '../../../packages/contracts/management.js';
import type { GbpCreateIntent, GbpReceipt } from '../../../packages/contracts/pilot.js';

interface SyntheticDispatch {
  policy: 'synthetic-organic-text';
  create(intent: GbpCreateIntent): Promise<GbpReceipt>;
}

// Only the invocation that committed the claim may call create. A later invocation
// can never resume an attempt, even when the original invocation did not reach the fake.
export async function claimDispatch(connect: () => Promise<Client>, occurrenceId: string,
  fake: SyntheticDispatch): Promise<{ state: 'in_flight'; attemptId: string }> {
  if (!uuid(occurrenceId) || fake?.policy !== 'synthetic-organic-text') return deny();
  const db = await connect();
  const intent = await persistClaim(db, occurrenceId).finally(() => db.end());
  try {
    await fake.create(intent);
  } catch {
    throw new Error('Synthetic dispatch outcome unknown');
  }
  return { state: 'in_flight', attemptId: intent.attemptId };
}

async function persistClaim(db: Client, occurrenceId: string): Promise<GbpCreateIntent> {
  await db.query('BEGIN ISOLATION LEVEL READ COMMITTED');
  try {
    // Discover lock keys only. Authority and snapshot bindings are checked again under the locks.
    const candidate = (await db.query<{ tenant_id: string; draft_id: string; approver_id: string; approval_id: string }>(
      `SELECT o.tenant_id,o.draft_id,o.approval_id,m.identity_id AS approver_id FROM pilot.occurrences o
        JOIN pilot.approvals a ON a.tenant_id=o.tenant_id AND a.occurrence_id=o.id AND a.id=o.approval_id
        JOIN pilot.memberships m ON m.tenant_id=a.tenant_id AND m.id=a.membership_id
        WHERE o.id=$1`, [occurrenceId])).rows[0] ?? deny();
    const { tenant_id: tenantId, draft_id: draftId, approver_id: approverId } = candidate;
    const identity = await db.query('SELECT id FROM pilot.identities WHERE id=$1 AND verified FOR SHARE', [approverId]);
    const tenant = (await db.query<{ version: number }>('SELECT version FROM pilot.tenants WHERE id=$1 AND active FOR SHARE',
      [tenantId])).rows[0];
    const draft = await db.query('SELECT id FROM pilot.drafts WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [tenantId, draftId]);
    if (identity.rowCount !== 1 || !tenant || draft.rowCount !== 1) return deny();
    const occurrence = await db.query(`SELECT id FROM pilot.occurrences
      WHERE tenant_id=$1 AND id=$2 AND draft_id=$3 AND state='approved' FOR UPDATE`, [tenantId, occurrenceId, draftId]);
    if (occurrence.rowCount !== 1) return deny();

    const approval = (await db.query<Omit<GbpCreateIntent, 'attemptId' | 'occurrenceId' | 'tenantId' | 'approverId'>>(
      `SELECT a.id AS "approvalId",a.revision_id AS "revisionId",r.text,l.provider_location AS location,
        a.location_id AS "locationId",a.membership_id AS "membershipId",a.membership_version AS "membershipVersion",
        a.grant_version AS "grantVersion",a.timezone,
        to_char(a.due_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "dueAt"
      FROM pilot.occurrences o
      JOIN pilot.approvals a ON a.tenant_id=o.tenant_id AND a.occurrence_id=o.id AND a.id=o.approval_id
        AND a.draft_id=o.draft_id AND a.location_id=o.location_id AND a.due_at=o.due_at AND a.timezone=o.timezone
      JOIN pilot.locations l ON l.tenant_id=a.tenant_id AND l.id=a.location_id
        AND l.provider_location=a.provider_location AND l.grant_active AND l.version=a.grant_version
      JOIN pilot.memberships m ON m.tenant_id=a.tenant_id AND m.id=a.membership_id
        AND m.active AND m.role='Manager' AND m.version=a.membership_version
      JOIN pilot.draft_revisions r ON r.tenant_id=a.tenant_id AND r.draft_id=a.draft_id AND r.id=a.revision_id AND r.text IS NOT NULL
      WHERE o.tenant_id=$1 AND o.id=$2 AND m.identity_id=$3 AND a.grant_active_at_approval
        AND a.tenant_version=$4 AND a.id=$5
        AND btrim(l.provider_location)<>''
        AND NOT EXISTS (SELECT 1 FROM pilot.draft_revisions newer
          WHERE newer.tenant_id=r.tenant_id AND newer.draft_id=r.draft_id AND newer.revision>r.revision)
        AND NOT EXISTS (SELECT 1 FROM pilot.attempts p WHERE p.tenant_id=o.tenant_id AND p.occurrence_id=o.id)
        AND NOT EXISTS (SELECT 1 FROM pilot.audit h
          WHERE h.tenant_id=o.tenant_id AND h.occurrence_id=o.id AND h.action='occurrence_hold')
      FOR SHARE OF l,m`, [tenantId, occurrenceId, approverId, tenant.version, candidate.approval_id])).rows[0] ?? deny();

    // The stop writer can proceed only before the claim or after its attempt is durable.
    const stop = await db.query('SELECT singleton FROM pilot.dispatch_control WHERE singleton AND NOT stopped FOR SHARE');
    if (stop.rowCount !== 1) return deny();
    const attempt = (await db.query<{ id: string }>(`WITH claim_time AS (SELECT clock_timestamp() AS instant)
      INSERT INTO pilot.attempts(tenant_id,occurrence_id,approval_id,claimed_at)
      SELECT o.tenant_id,o.id,o.approval_id,claim_time.instant
      FROM pilot.occurrences o CROSS JOIN claim_time
      WHERE o.tenant_id=$1 AND o.id=$2 AND o.due_at<=claim_time.instant AND isfinite(o.due_at)
      RETURNING id`, [tenantId, occurrenceId])).rows[0] ?? deny();

    const updated = await db.query("UPDATE pilot.occurrences SET state='in_flight' WHERE tenant_id=$1 AND id=$2",
      [tenantId, occurrenceId]);
    const audit = await db.query(`INSERT INTO pilot.audit(tenant_id,actor_id,occurrence_id,action,reason,outcome)
      VALUES($1,$2,$3,'dispatch_claim','Synthetic organic text','in_flight')`, [tenantId, approverId, occurrenceId]);
    if (updated.rowCount !== 1 || audit.rowCount !== 1) return deny();
    await db.query('COMMIT');
    return { ...approval, tenantId, occurrenceId, approverId, attemptId: attempt.id };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}
