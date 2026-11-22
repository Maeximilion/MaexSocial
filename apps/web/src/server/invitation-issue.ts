import { randomBytes } from 'node:crypto';
import { request } from 'node:https';
import type { Client } from 'pg';
import { deny, lockManagementSession, managementEvidence, requireFreshManagementProof, uuid,
  type ManagementContext } from '../../../../packages/contracts/management.js';
import type { CustomerContext, CustomerRole } from '../../../../packages/contracts/pilot.js';
import { normalizeAccountEmail } from './account-email.js';
import { customerOrigin } from './request.js';
import { requireManagerMfa, tokenHash } from './session.js';

const invitationLifetimeMs = 24 * 60 * 60 * 1000;

interface PrivateInvitationTransport {
  connect: () => Promise<Client>;
  clock: () => Date;
  mailboxCa: Buffer;
}

interface PrivateInvitationIssuer extends PrivateInvitationTransport {
  // Validate and lock the current customer authority on this transaction's connection.
  authorize: (db: Client) => Promise<CustomerContext>;
}

export interface ManagementInvitationContext extends ManagementContext {
  action: 'invitation_issue';
  recipient: string;
  role: CustomerRole;
}

interface InvitationAuthority {
  tenantId: string;
  membershipId?: string;
  platformGrantId?: string;
  issuerVersion: number;
  role: CustomerRole;
  requireFresh: (now: Date) => void;
  audit?: { identityId: string; deviceId: string; reason: string };
}

function captureInvitation(ca: Buffer, email: string, token: string, role: CustomerRole): Promise<boolean> {
  const body = JSON.stringify({
    From: { Email: 'invitations@example.invalid' },
    To: [{ Email: email }],
    Subject: `${role} invitation`,
    Text: `You have been invited as ${role === 'Employee' ? 'an' : 'a'} ${role}. The invitation expires after 24 hours.\n\n${customerOrigin}/customer/invitations/preview#${token}\n`
  });
  return new Promise(resolve => {
    const send = request({ hostname: 'mailbox', port: 8025, path: '/api/v1/send', method: 'POST',
      ca, rejectUnauthorized: true, agent: false, signal: AbortSignal.timeout(5000),
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, response => {
      response.on('error', () => resolve(false));
      response.on('end', () => resolve(response.statusCode === 200));
      response.resume();
    });
    send.on('error', () => resolve(false));
    send.end(body);
  });
}

// Private pilot operation. Only the mailbox receives the raw token.
export async function issueEmployeeInvitation(issuer: PrivateInvitationIssuer, recipient: string, replaces?: string) {
  const email = normalizeAccountEmail(recipient);
  if (!email) return deny();
  return issueInvitation(issuer, email, replaces, async db => {
    const manager = await issuer.authorize(db);
    requireManagerMfa(manager, issuer.clock);
    return {
      tenantId: manager.tenantId, membershipId: manager.membershipId, issuerVersion: manager.membershipVersion,
      role: 'Employee', requireFresh: now => requireManagerMfa(manager, () => now)
    };
  });
}

export async function issueManagementInvitation(issuer: PrivateInvitationTransport, proof: ManagementInvitationContext,
  tenantId: string, recipient: string, role: CustomerRole, reason: string, replaces?: string) {
  proof = { ...proof };
  const email = normalizeAccountEmail(recipient);
  if (!email || proof.action !== 'invitation_issue' || proof.recipient !== email || proof.role !== role ||
    (role !== 'Manager' && role !== 'Employee')) return deny();
  const { auditReason, assertedAt } = managementEvidence(proof, tenantId, reason);

  return issueInvitation(issuer, email, replaces, async db => {
    const identity = await db.query('SELECT id FROM pilot.identities WHERE id=$1 AND verified FOR SHARE', [proof.identityId]);
    if (identity.rowCount !== 1) return deny();
    const session = await lockManagementSession(db, proof);
    return {
      tenantId, role, platformGrantId: proof.grantId, issuerVersion: proof.grantVersion,
      requireFresh: now => requireFreshManagementProof(session, assertedAt, now),
      audit: { identityId: proof.identityId, deviceId: proof.deviceId, reason: auditReason }
    };
  });
}

async function issueInvitation(issuer: PrivateInvitationTransport, email: string, replaces: string | undefined,
  authorize: (db: Client) => Promise<InvitationAuthority>): Promise<{ id: string; delivery: 'captured' | 'unconfirmed' }> {
  if (process.env.PILOT_CONTAINER !== '1' || (replaces !== undefined && !uuid(replaces))) return deny();
  const db = await issuer.connect();
  const token = randomBytes(32).toString('hex');
  let id: string;
  let invitedRole: CustomerRole;
  try {
    await db.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    const { tenantId, membershipId, platformGrantId, issuerVersion, role, requireFresh, audit } = await authorize(db);
    const binding = [tenantId, email, membershipId ?? null, platformGrantId ?? null, issuerVersion, role];
    // Customer and platform issuers share the same recipient lock across both roles.
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
      [JSON.stringify(['employee-invitation', tenantId, email])]);
    let previous: { grant_version: number; created_at: Date } | undefined;
    if (replaces !== undefined) {
      previous = (await db.query<{ grant_version: number; created_at: Date }>(`SELECT grant_version,created_at FROM pilot.invitations
        WHERE tenant_id=$1 AND email=$2 AND issuer_membership_id IS NOT DISTINCT FROM $3::uuid
        AND issuer_platform_grant_id IS NOT DISTINCT FROM $4::uuid AND issuer_version=$5 AND role=$6 AND id=$7
        AND purpose='membership' AND revoked_at IS NULL AND consumed_at IS NULL
        FOR UPDATE`, [...binding, replaces])).rows[0];
      if (!previous) return deny();
    }

    const now = issuer.clock();
    requireFresh(now);
    if (previous && now < previous.created_at) return deny();
    // A higher issuer version permanently invalidates the binding.
    const pending = await db.query(`SELECT 1 FROM pilot.invitations i
      WHERE i.tenant_id=$1 AND i.email=$2 AND i.purpose='membership'
      AND i.id IS DISTINCT FROM $3::uuid AND i.consumed_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>$4
      AND NOT EXISTS (SELECT 1 FROM pilot.memberships m
        WHERE m.tenant_id=i.tenant_id AND m.id=i.issuer_membership_id AND m.version>i.issuer_version)
      AND NOT EXISTS (SELECT 1 FROM pilot.platform_grants g
        WHERE g.id=i.issuer_platform_grant_id AND g.version>i.issuer_version)
      LIMIT 1`, [tenantId, email, replaces ?? null, now]);
    if (pending.rowCount) return deny();
    if (replaces !== undefined) {
      await db.query('UPDATE pilot.invitations SET revoked_at=$3 WHERE tenant_id=$1 AND id=$2', [tenantId, replaces, now]);
    }
    const created = await db.query<{ id: string }>(`INSERT INTO pilot.invitations
      (tenant_id,email,issuer_membership_id,issuer_platform_grant_id,issuer_version,role,purpose,grant_version,token_hash,created_at,expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,'membership',$7,$8,$9,$10) RETURNING id`,
    [...binding, previous ? previous.grant_version + 1 : 1, tokenHash(token), now, new Date(now.getTime() + invitationLifetimeMs)]);
    id = (created.rows[0] ?? deny()).id;
    invitedRole = role;
    if (audit) {
      const recorded = await db.query(`INSERT INTO pilot.audit(tenant_id,actor_id,device_id,action,reason,outcome,created_at)
        VALUES($1,$2,$3,'invitation_issue',$4,$5,$6)`, [tenantId, audit.identityId, audit.deviceId, audit.reason, role, now]);
      if (recorded.rowCount !== 1) return deny();
    }
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    await db.end();
  }

  // shortcut: Mailpit capture is separate from commit, revisit delivery guarantees before public integration.
  const captured = await captureInvitation(issuer.mailboxCa, email, token, invitedRole).catch(() => false);
  return { id, delivery: captured ? 'captured' : 'unconfirmed' };
}
