import type { Client } from 'pg';
import { tokenHash } from '../server/session.js';
import { page } from './content.js';
import { html } from './portal.js';

export function invitationToken(cookieHeader: string | undefined): string | undefined {
  let token: string | undefined;
  for (const cookie of (cookieHeader ?? '').split(';')) {
    const name = '__Host-invitation=';
    const part = cookie.trim();
    if (!part.startsWith(name)) continue;
    if (token !== undefined) return undefined;
    token = part.slice(name.length);
  }
  return token && /^[a-f0-9]{64}$/.test(token) ? token : undefined;
}

export async function previewEmployeeInvitation(db: Client, token: string, recipient: string): Promise<string | undefined> {
  const result = await db.query<{ name: string }>(`SELECT t.name FROM pilot.invitations i
    JOIN pilot.tenants t ON t.id=i.tenant_id AND t.active
    JOIN pilot.memberships m ON m.tenant_id=i.tenant_id AND m.id=i.issuer_membership_id
      AND m.active AND m.role='Manager' AND m.version=i.issuer_version
    JOIN pilot.identities issuer ON issuer.id=m.identity_id AND issuer.verified
    WHERE i.token_hash=$1 AND i.email=$2 AND i.role='Employee' AND i.purpose='membership'
      AND i.revoked_at IS NULL AND i.consumed_at IS NULL
      AND i.created_at<=statement_timestamp() AND i.expires_at>statement_timestamp()`, [tokenHash(token), recipient]);
  return result.rows[0]?.name;
}

export function renderInvitationPreview(tenantName?: string): string {
  if (tenantName === undefined) return page('Invitation unavailable', '<p>This invitation is unavailable.</p>');
  return page('Employee invitation', `<dl><dt>Workspace</dt><dd>${html(tenantName)}</dd><dt>Role</dt><dd>Employee</dd></dl>
<p>You have not accepted this invitation.</p>`);
}
