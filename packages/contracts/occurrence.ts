import type { Client } from 'pg';
import { deny, lockManagementSession, managementEvidence, requireFreshManagementProof, uuid, type ManagementContext } from './management.js';

export interface ManagementHoldContext extends ManagementContext {
  occurrenceId: string;
}

type AttemptOutcome = 'unknown' | 'pending' | 'confirmed' | 'rejected';
type HoldResult = AttemptOutcome | 'in_flight' | 'held' | 'exported' | 'quarantined';
type OccurrenceState = HoldResult | 'draft' | 'approved';

export async function holdOccurrence(connect: () => Promise<Client>, proof: ManagementHoldContext,
  tenantId: string, occurrenceId: string, reason: string, clock: () => Date): Promise<HoldResult> {
  proof = { ...proof };
  const { identityId, deviceId } = proof;
  if (proof.occurrenceId !== occurrenceId || !uuid(occurrenceId)) deny();
  const { auditReason, assertedAt } = managementEvidence(proof, tenantId, reason);

  const db = await connect();
  try {
    await db.query('BEGIN');
    // Keep authority current until commit, starting with the identity lock used by customer mutations.
    const identity = await db.query('SELECT id FROM pilot.identities WHERE id=$1 AND verified FOR SHARE', [identityId]);
    if (identity.rowCount !== 1) deny();
    const session = await lockManagementSession(db, proof);

    // Every claim or export must take the same occurrence lock before inspecting its attempt.
    const occurrence = (await db.query<{ state: OccurrenceState }>(
      'SELECT state FROM pilot.occurrences WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [tenantId, occurrenceId])).rows[0] ?? deny();
    const attempt = (await db.query<{ outcome: AttemptOutcome }>(
      'SELECT outcome FROM pilot.attempts WHERE tenant_id=$1 AND occurrence_id=$2 FOR SHARE', [tenantId, occurrenceId])).rows[0];

    const now = clock();
    requireFreshManagementProof(session, assertedAt, now);

    let result: HoldResult;
    if (attempt && attempt.outcome !== 'unknown') {
      result = attempt.outcome;
    } else if (occurrence.state !== 'draft' && occurrence.state !== 'approved') {
      result = occurrence.state;
    } else if (attempt) {
      result = 'unknown';
    } else {
      const updated = await db.query("UPDATE pilot.occurrences SET state='held' WHERE tenant_id=$1 AND id=$2", [tenantId, occurrenceId]);
      const audit = await db.query(`INSERT INTO pilot.audit(tenant_id,actor_id,device_id,occurrence_id,action,reason,outcome,created_at)
        VALUES($1,$2,$3,$4,'occurrence_hold',$5,'held',$6)`, [tenantId, identityId, deviceId, occurrenceId, auditReason, now]);
      if (updated.rowCount !== 1 || audit.rowCount !== 1) deny();
      result = 'held';
    }
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    await db.end();
  }
}
