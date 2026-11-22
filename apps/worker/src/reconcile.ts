import type { Client } from 'pg';
import type { GbpObservation, GbpReadback } from '../../../packages/contracts/pilot.js';

type Outcome = 'unknown' | 'pending' | 'confirmed' | 'rejected';

interface StoredAttempt {
  id: string | null;
  tenant_id: string;
  approval_id: string | null;
  state: string;
  provider_location: string | null;
  resource_name: string | null;
  outcome: Outcome;
  claimed_at: Date | null;
  observed_at: Date | null;
}

// The worker supplies a stored global occurrence ID, never provider or tenant IDs from a request.
export async function reconcileOccurrence(connect: () => Promise<Client>, occurrenceId: string,
  provider: GbpReadback): Promise<Outcome | null> {
  if (typeof occurrenceId !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(occurrenceId)) return null;
  const reader = await connect();
  const original = await readAttempt(reader, occurrenceId).finally(() => reader.end());
  if (!original || !original.id || finalOutcome(original)) return original?.outcome ?? null;

  const { provider_location: location, resource_name: resourceName, tenant_id: tenantId } = original;
  const observation = location?.trim() ? await provider.readback({ tenantId, occurrenceId, attemptId: original.id, location,
    ...(resourceName === null ? {} : { resourceName }) }) : null;

  const db = await connect();
  try {
    await db.query('BEGIN');
    // Hold, claim and export serialize on this row before accessing the attempt.
    const locked = await db.query('SELECT id FROM pilot.occurrences WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [tenantId, occurrenceId]);
    const current = locked.rowCount === 1 ? await readAttempt(db, occurrenceId, true) : undefined;
    const sameBinding = current?.id === original.id && current.approval_id === original.approval_id &&
      current.resource_name === original.resource_name;
    const result = sameBinding && !finalOutcome(current) ? await persist(db, occurrenceId, current, observation) : current?.outcome ?? null;
    await db.query('COMMIT');
    return result;
  } catch (error) { await db.query('ROLLBACK'); throw error; }
  finally { await db.end(); }
}

async function readAttempt(db: Client, occurrenceId: string, lockAttempt = false): Promise<StoredAttempt | undefined> {
  return (await db.query<StoredAttempt>(`SELECT o.state,a.id,a.tenant_id,a.approval_id,a.resource_name,a.outcome,
    a.claimed_at,a.observed_at,p.provider_location FROM pilot.occurrences o
    JOIN pilot.attempts a ON a.tenant_id=o.tenant_id AND a.occurrence_id=o.id
    LEFT JOIN pilot.approvals p ON p.tenant_id=a.tenant_id AND p.occurrence_id=a.occurrence_id AND p.id=a.approval_id
    WHERE o.id=$1 AND o.state IN ('in_flight','unknown','pending','confirmed','rejected','quarantined')
      AND (a.details_retired OR p.id IS NOT NULL)
    ${lockAttempt ? 'FOR UPDATE OF a' : ''}`, [occurrenceId])).rows[0];
}

function finalOutcome({ state, outcome }: StoredAttempt): boolean {
  return state === 'confirmed' || state === 'rejected' || outcome === 'confirmed' || outcome === 'rejected';
}

async function persist(db: Client, occurrenceId: string, attempt: StoredAttempt, observation: GbpObservation | null): Promise<Outcome> {
  const { provider_location: location, tenant_id: tenantId, state } = attempt;
  let outcome: Outcome = 'unknown';
  let resourceName = attempt.resource_name;
  let observedAt = attempt.observed_at;
  if (observation && location) {
    const time = observation.observedAt;
    if (!Number.isSafeInteger(time) || !Number.isFinite(new Date(time).getTime())) throw new Error('Invalid GBP observation time');
    if (!attempt.claimed_at || time < attempt.claimed_at.getTime() ||
      (observedAt && time < observedAt.getTime())) return attempt.outcome;
    observedAt = new Date(time);
    const candidate = observation.location === location && observation.correlation === 'unique' &&
      Array.isArray(observation.candidates) && observation.candidates.length === 1 ? observation.candidates[0] : undefined;
    const prefix = `${location}/localPosts/`;
    if (typeof candidate?.resourceName === 'string' && candidate.resourceName.startsWith(prefix) &&
      /^[^/]+$/.test(candidate.resourceName.slice(prefix.length)) &&
      (resourceName === null || resourceName === candidate.resourceName)) {
      if (candidate.state === 'LIVE') {
        outcome = 'confirmed';
        resourceName = candidate.resourceName;
      } else if (candidate.state === 'PROCESSING') outcome = 'pending';
      else if (candidate.state === 'REJECTED') outcome = 'rejected';
    }
  }

  if (outcome !== attempt.outcome || observedAt?.getTime() !== attempt.observed_at?.getTime() || resourceName !== attempt.resource_name) {
    const updated = await db.query(`UPDATE pilot.attempts SET outcome=$3,observed_at=$4,resource_name=$5
      WHERE tenant_id=$1 AND occurrence_id=$2`, [tenantId, occurrenceId, outcome, observedAt, resourceName]);
    if (updated.rowCount !== 1) throw new Error('GBP attempt observation was not saved');
  }
  if (state !== 'quarantined' && state !== outcome) {
    const updated = await db.query('UPDATE pilot.occurrences SET state=$3 WHERE tenant_id=$1 AND id=$2',
      [tenantId, occurrenceId, outcome]);
    if (updated.rowCount !== 1) throw new Error('GBP occurrence outcome was not saved');
  }
  return outcome;
}
