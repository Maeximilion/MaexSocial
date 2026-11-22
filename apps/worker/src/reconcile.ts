import type { Client } from 'pg';
import type { GbpReadback } from '../../../packages/contracts/pilot.js';

type Outcome = 'unknown' | 'pending' | 'confirmed' | 'rejected';

interface StoredAttempt {
  id: string;
  provider_location: string | null;
  resource_name: string | null;
  outcome: Outcome;
  claimed_at: Date;
  observed_at: Date | null;
}

// The worker supplies a stored global occurrence ID, never provider or tenant IDs from a request.
export async function reconcileOccurrence(connect: () => Promise<Client>, occurrenceId: string,
  provider: GbpReadback): Promise<Outcome | null> {
  if (typeof occurrenceId !== 'string' || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(occurrenceId)) return null;
  const db = await connect();
  try {
    await db.query('BEGIN');
    // Hold, claim and export serialize on this row before accessing the attempt.
    const occurrence = (await db.query<{ tenant_id: string; state: string }>(
      'SELECT tenant_id,state FROM pilot.occurrences WHERE id=$1 FOR UPDATE', [occurrenceId])).rows[0];
    const result = occurrence ? await reconcileStored(db, occurrence.tenant_id, occurrenceId, occurrence.state, provider) : null;
    await db.query('COMMIT');
    return result;
  } catch (error) { await db.query('ROLLBACK'); throw error; }
  finally { await db.end(); }
}

async function reconcileStored(db: Client, tenantId: string, occurrenceId: string, state: string,
  provider: GbpReadback): Promise<Outcome | null> {
  if (!['in_flight', 'unknown', 'pending', 'confirmed', 'rejected', 'quarantined'].includes(state)) return null;
  const attempt = (await db.query<StoredAttempt>(`SELECT a.id,a.resource_name,a.outcome,a.claimed_at,a.observed_at,p.provider_location
    FROM pilot.attempts a JOIN pilot.approvals p
      ON p.tenant_id=a.tenant_id AND p.occurrence_id=a.occurrence_id AND p.id=a.approval_id
    WHERE a.tenant_id=$1 AND a.occurrence_id=$2 FOR UPDATE OF a`, [tenantId, occurrenceId])).rows[0];
  if (!attempt) return null;
  if (attempt.outcome === 'confirmed' || attempt.outcome === 'rejected' || state === 'confirmed' || state === 'rejected') {
    return attempt.outcome;
  }

  let outcome: Outcome = 'unknown';
  let resourceName = attempt.resource_name;
  let observedAt = attempt.observed_at;
  const location = attempt.provider_location;
  if (location?.trim()) {
    const observation = await provider.readback({ tenantId, occurrenceId, attemptId: attempt.id, location,
      ...(resourceName === null ? {} : { resourceName }) });
    const time = observation?.observedAt;
    if (!Number.isSafeInteger(time) || !Number.isFinite(new Date(time).getTime())) throw new Error('Invalid GBP observation time');
    if (time < attempt.claimed_at.getTime() || (observedAt && time < observedAt.getTime())) return attempt.outcome;
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
