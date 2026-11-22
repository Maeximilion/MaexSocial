import type { Client } from 'pg';
import type { CustomerRole } from '../../../../packages/contracts/pilot.js';
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

interface InvitationPreview {
  name: string;
  role: CustomerRole;
}

export async function previewInvitation(db: Client, token: string, recipient: string): Promise<InvitationPreview | undefined> {
  const result = await db.query<InvitationPreview>(`SELECT t.name,i.role FROM pilot.invitations i
    JOIN pilot.tenants t ON t.id=i.tenant_id AND t.active
    WHERE i.token_hash=$1 AND i.email=$2 AND i.purpose='membership'
      AND i.revoked_at IS NULL AND i.consumed_at IS NULL
      AND i.created_at<=statement_timestamp() AND i.expires_at>statement_timestamp()
      AND ((i.role='Employee' AND EXISTS (
        SELECT 1 FROM pilot.memberships m JOIN pilot.identities issuer ON issuer.id=m.identity_id AND issuer.verified
        WHERE m.tenant_id=i.tenant_id AND m.id=i.issuer_membership_id AND m.active
          AND m.role='Manager' AND m.version=i.issuer_version
      )) OR EXISTS (
        SELECT 1 FROM pilot.platform_grants g JOIN pilot.identities issuer ON issuer.id=g.identity_id AND issuer.verified
        WHERE g.id=i.issuer_platform_grant_id AND g.active AND g.version=i.issuer_version
      ))`, [tokenHash(token), recipient]);
  return result.rows[0];
}

export function renderInvitationPreview(preview?: InvitationPreview): string {
  if (preview === undefined) return page('Invitation unavailable', '<p>This invitation is unavailable.</p>');
  return page(`${preview.role} invitation`, `<dl><dt>Workspace</dt><dd>${html(preview.name)}</dd><dt>Role</dt><dd>${preview.role}</dd></dl>
<p>You have not accepted this invitation.</p>`);
}
