import { randomBytes } from 'node:crypto';
import { request } from 'node:https';
import type { Client } from 'pg';
import type { CustomerContext } from '../../../../packages/contracts/pilot.js';
import { normalizeAccountEmail } from './account-email.js';
import { customerOrigin } from './request.js';
import { requireManagerMfa, tokenHash } from './session.js';

const invitationLifetimeMs = 24 * 60 * 60 * 1000;
const invitationId = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const denied = (): never => { throw new Error('Denied'); };

interface PrivateInvitationIssuer {
  connect: () => Promise<Client>;
  // Validate and lock the current customer authority on this transaction's connection.
  authorize: (db: Client) => Promise<CustomerContext>;
  clock: () => Date;
  mailboxCa: Buffer;
}

function captureInvitation(ca: Buffer, email: string, token: string): Promise<boolean> {
  const body = JSON.stringify({
    From: { Email: 'invitations@example.invalid' },
    To: [{ Email: email }],
    Subject: 'Employee invitation',
    Text: `You have been invited as an Employee. The invitation expires after 24 hours.\n\n${customerOrigin}/customer/invitations/preview#${token}\n`
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
export async function issueEmployeeInvitation(
  issuer: PrivateInvitationIssuer,
  recipient: string,
  replaces?: string
): Promise<{ id: string; delivery: 'captured' | 'unconfirmed' }> {
  const email = normalizeAccountEmail(recipient);
  if (process.env.PILOT_CONTAINER !== '1' || !email || (replaces !== undefined
    && (typeof replaces !== 'string' || !invitationId.test(replaces)))) return denied();

  const db = await issuer.connect();
  const token = randomBytes(32).toString('hex');
  let id: string;
  try {
    await db.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    const manager = await issuer.authorize(db);
    requireManagerMfa(manager, issuer.clock);
    const binding = [manager.tenantId, email, manager.membershipId, manager.membershipVersion];
    // Different Managers hold different authority locks. Serialize issues and resends for the same recipient here.
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',
      [JSON.stringify(['employee-invitation', manager.tenantId, email])]);
    let previous: { grant_version: number; created_at: Date } | undefined;
    if (replaces !== undefined) {
      previous = (await db.query<{ grant_version: number; created_at: Date }>(`SELECT grant_version,created_at FROM pilot.invitations
        WHERE tenant_id=$1 AND email=$2 AND issuer_membership_id=$3 AND issuer_version=$4 AND id=$5
        AND role='Employee' AND purpose='membership' AND revoked_at IS NULL AND consumed_at IS NULL
        FOR UPDATE`, [...binding, replaces])).rows[0];
      if (!previous) return denied();
    }

    const now = issuer.clock();
    requireManagerMfa(manager, () => now);
    if (previous && now < previous.created_at) return denied();
    // A higher membership version permanently invalidates that issuer binding.
    const pending = await db.query(`SELECT 1 FROM pilot.invitations i
      WHERE i.tenant_id=$1 AND i.email=$2 AND i.role='Employee' AND i.purpose='membership'
      AND i.id IS DISTINCT FROM $3::uuid AND i.consumed_at IS NULL AND i.revoked_at IS NULL AND i.expires_at>$4
      AND NOT EXISTS (SELECT 1 FROM pilot.memberships m
        WHERE m.tenant_id=i.tenant_id AND m.id=i.issuer_membership_id AND m.version>i.issuer_version)
      LIMIT 1`, [manager.tenantId, email, replaces ?? null, now]);
    if (pending.rowCount) return denied();
    if (replaces !== undefined) {
      await db.query('UPDATE pilot.invitations SET revoked_at=$3 WHERE tenant_id=$1 AND id=$2', [manager.tenantId, replaces, now]);
    }
    const created = await db.query<{ id: string }>(`INSERT INTO pilot.invitations
      (tenant_id,email,issuer_membership_id,issuer_version,role,purpose,grant_version,token_hash,created_at,expires_at)
      VALUES ($1,$2,$3,$4,'Employee','membership',$5,$6,$7,$8) RETURNING id`,
    [...binding, previous ? previous.grant_version + 1 : 1, tokenHash(token), now, new Date(now.getTime() + invitationLifetimeMs)]);
    id = created.rows[0]!.id;
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    await db.end();
  }

  // shortcut: Mailpit capture is separate from commit, revisit delivery guarantees before public integration.
  const captured = await captureInvitation(issuer.mailboxCa, email, token).catch(() => false);
  return { id, delivery: captured ? 'captured' : 'unconfirmed' };
}
