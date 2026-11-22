import type { Client } from 'pg';

// Produced by a trusted management boundary after verifying the device and
// phishing-resistant assertion for this target. Only isolated tests supply it today.
export interface ManagementHoldContext {
  sessionId: string;
  identityId: string;
  deviceId: string;
  deviceVersion: number;
  grantId: string;
  grantVersion: number;
  tenantId: string;
  tenantVersion: number;
  occurrenceId: string;
  phishingResistantAt: Date;
}

type AttemptOutcome = 'unknown' | 'pending' | 'confirmed' | 'rejected';
type HoldResult = AttemptOutcome | 'in_flight' | 'held' | 'exported' | 'quarantined';
type OccurrenceState = HoldResult | 'draft' | 'approved';

const deny = (): never => { throw new Error('Denied'); };
const uuid = (value: string) => /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const version = (value: number) => Number.isInteger(value) && value > 0 && value <= 2_147_483_647;

export async function holdOccurrence(connect: () => Promise<Client>, proof: ManagementHoldContext,
  tenantId: string, occurrenceId: string, reason: string, clock: () => Date): Promise<HoldResult> {
  const { sessionId, identityId, deviceId, deviceVersion, grantId, grantVersion, tenantVersion } = proof;
  const assertedAt = proof.phishingResistantAt?.getTime();
  const auditReason = typeof reason === 'string' ? reason.trim() : '';
  if (proof.tenantId !== tenantId || proof.occurrenceId !== occurrenceId ||
      ![tenantId, occurrenceId, sessionId, identityId, deviceId, grantId].every(uuid) ||
      ![deviceVersion, grantVersion, tenantVersion].every(version) ||
      !Number.isFinite(assertedAt) || !auditReason || [...auditReason].length > 500 || auditReason.includes('\0')) deny();

  const db = await connect();
  try {
    await db.query('BEGIN');
    // Keep authority current until commit, starting with the identity lock used by customer mutations.
    const identity = await db.query('SELECT id FROM pilot.identities WHERE id=$1 AND verified FOR SHARE', [identityId]);
    if (identity.rowCount !== 1) deny();
    const session = (await db.query<{
      created_at: Date; last_seen_at: Date; expires_at: Date; mfa_at: Date | null;
    }>(`SELECT s.created_at,s.last_seen_at,s.expires_at,s.mfa_at FROM pilot.sessions s
      JOIN pilot.identities i ON i.id=s.identity_id AND i.version=s.identity_version
      JOIN pilot.devices d ON d.id=s.device_id AND d.identity_id=i.id AND d.version=s.device_version
      JOIN pilot.platform_grants g ON g.id=d.platform_grant_id AND g.identity_id=i.id
      JOIN pilot.tenants t ON t.id=$8
      WHERE s.id=$1 AND i.id=$2 AND s.audience='management' AND s.revoked_at IS NULL
        AND d.id=$3 AND d.version=$4 AND d.active AND g.id=$5 AND g.version=$6 AND g.active
        AND t.active AND t.version=$7
      FOR SHARE OF s,d,g,t`, [sessionId, identityId, deviceId, deviceVersion, grantId, grantVersion, tenantVersion, tenantId])).rows[0] ?? deny();

    // Every claim or export must take the same occurrence lock before inspecting its attempt.
    const occurrence = (await db.query<{ state: OccurrenceState }>(
      'SELECT state FROM pilot.occurrences WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [tenantId, occurrenceId])).rows[0] ?? deny();
    const attempt = (await db.query<{ outcome: AttemptOutcome }>(
      'SELECT outcome FROM pilot.attempts WHERE tenant_id=$1 AND occurrence_id=$2 FOR SHARE', [tenantId, occurrenceId])).rows[0];

    const now = clock();
    const age = now.getTime() - assertedAt;
    if (!Number.isFinite(age) || age < 0 || age > 300_000 || session.mfa_at?.getTime() !== assertedAt ||
        assertedAt < session.created_at.getTime() || now < session.last_seen_at || now >= session.expires_at ||
        now.getTime() - session.created_at.getTime() >= 3_600_000 ||
        now.getTime() - session.last_seen_at.getTime() >= 600_000) deny();

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
