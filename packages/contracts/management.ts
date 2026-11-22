import type { Client } from 'pg';

// A trusted management boundary verifies the device and phishing-resistant assertion for the action.
export interface ManagementSessionContext {
  sessionId: string;
  identityId: string;
  deviceId: string;
  deviceVersion: number;
  grantId: string;
  grantVersion: number;
  phishingResistantAt: Date;
}

export interface ManagementContext extends ManagementSessionContext {
  tenantId: string;
  tenantVersion: number;
}

export const deny = (): never => { throw new Error('Denied'); };
export const uuid = (value: string) => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
export const version = (value: number) => Number.isInteger(value) && value > 0 && value <= 2_147_483_647;

export function managementEvidence(proof: ManagementContext, tenantId: string, reason: string) {
  if (proof.tenantId !== tenantId || !uuid(tenantId) || !version(proof.tenantVersion)) deny();
  return managementSessionEvidence(proof, reason);
}

export function managementSessionEvidence(proof: ManagementSessionContext, reason: string) {
  const assertedAt = managementAssertion(proof);
  const auditReason = typeof reason === 'string' ? reason.trim() : '';
  if (!auditReason || [...auditReason].length > 500 || auditReason.includes('\0')) deny();
  return { auditReason, assertedAt };
}

export function managementAssertion(proof: ManagementSessionContext): number {
  const assertedAt = proof.phishingResistantAt instanceof Date ? proof.phishingResistantAt.getTime() : NaN;
  if (![proof.sessionId, proof.identityId, proof.deviceId, proof.grantId].every(uuid) ||
      ![proof.deviceVersion, proof.grantVersion].every(version) || !Number.isFinite(assertedAt)) deny();
  return assertedAt;
}

export async function lockManagementSession(db: Client, proof: ManagementContext) {
  const tenant = await db.query('SELECT id FROM pilot.tenants WHERE id=$1 AND version=$2 AND active FOR SHARE',
    [proof.tenantId, proof.tenantVersion]);
  if (tenant.rowCount !== 1) deny();
  return lockManagementSessionAuthority(db, proof);
}

export function lockManagementSessionAuthority(db: Client, proof: ManagementSessionContext) {
  return managementSessionAuthority(db, proof, 'lock');
}

export async function readManagementSessionAuthority(db: Client, proof: ManagementSessionContext) {
  const session = await managementSessionAuthority(db, proof, 'read');
  if (!session.verified) deny();
  return session;
}

async function managementSessionAuthority(db: Client, proof: ManagementSessionContext, mode: 'lock' | 'read') {
  const { sessionId, identityId, deviceId, deviceVersion, grantId, grantVersion } = proof;
  return (await db.query<{
    created_at: Date; last_seen_at: Date; expires_at: Date; mfa_at: Date | null; verified: boolean;
  }>(`SELECT s.created_at,s.last_seen_at,s.expires_at,s.mfa_at,i.verified FROM pilot.sessions s
    JOIN pilot.identities i ON i.id=s.identity_id AND i.version=s.identity_version
    JOIN pilot.devices d ON d.id=s.device_id AND d.identity_id=i.id AND d.version=s.device_version
    JOIN pilot.platform_grants g ON g.id=d.platform_grant_id AND g.identity_id=i.id
    WHERE s.id=$1 AND i.id=$2 AND s.audience='management' AND s.revoked_at IS NULL
      AND d.id=$3 AND d.version=$4 AND d.active AND g.id=$5 AND g.version=$6 AND g.active
    ${mode === 'lock' ? 'FOR SHARE OF s,d,g' : ''}`,
  [sessionId, identityId, deviceId, deviceVersion, grantId, grantVersion])).rows[0] ?? deny();
}

export function requireValidManagementSession(session: Awaited<ReturnType<typeof managementSessionAuthority>>,
  assertedAt: number, now: Date): void {
  const age = now.getTime() - assertedAt;
  if (!Number.isFinite(age) || age < 0 || session.mfa_at?.getTime() !== assertedAt ||
      assertedAt < session.created_at.getTime() || now < session.last_seen_at || now >= session.expires_at ||
      now.getTime() - session.created_at.getTime() >= 3_600_000 ||
      now.getTime() - session.last_seen_at.getTime() >= 600_000) deny();
}

export function requireFreshManagementProof(session: Awaited<ReturnType<typeof managementSessionAuthority>>,
  assertedAt: number, now: Date): void {
  requireValidManagementSession(session, assertedAt, now);
  if (now.getTime() - assertedAt > 300_000) deny();
}
