import type { Client } from 'pg';
import type { CustomerContext, InspectIdentity } from '../../../../packages/contracts/pilot.js';
import { requireCustomerRequest, type CustomerRequest } from '../server/request.js';
import { requireManagerMfa } from '../server/session.js';
import { html } from './portal.js';

const uuid = (value: string): boolean => /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const deny = (): never => { throw new Error('Denied'); };
const maxDraftCodePoints = 1500;

export class InvalidDraftText extends Error {
  constructor(readonly text: string) { super('Invalid request'); }
}

export class DraftConflict extends Error {
  constructor(readonly page?: string) { super('Revision conflict'); }
}

function draftText(text: string): string {
  text = text.replace(/\r\n?/g, '\n');
  const length = [...text].length;
  if (/[\u0000\uD800-\uDFFF]/u.test(text) || length < 1 || length > maxDraftCodePoints) throw new InvalidDraftText(text);
  return text;
}

function draftTextField(text: string, help: string, invalid: boolean): string {
  const requirement = `Enter 1–${maxDraftCodePoints.toLocaleString('en-US')} Unicode code points.`;
  return `<label for="text">Draft text</label>
<p id="text-help">${invalid ? '' : `${requirement} `}${help}</p>
${invalid ? `<p id="text-error">${requirement} Remove any null characters.</p>` : ''}
<textarea id="text" name="text" required ${invalid ? 'aria-invalid="true" autofocus ' : ''}aria-describedby="text-help${invalid ? ' text-error' : ''}">\n${html(text.replaceAll('\u0000', '\uFFFD'))}</textarea>`;
}

export function page(title: string, content: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${html(title)} · MaexSocial</title><style>
:root{color-scheme:dark;font-family:system-ui,sans-serif;background:#0B0F19;color:#F8FAFC}*{box-sizing:border-box}
body{margin:0;line-height:1.6}main{max-width:60rem;margin:auto;padding:1.5rem}a,h1{color:#00E5FF}
form{background:#161F30;padding:1.5rem;border:1px solid #64748B;border-radius:.8rem}label{display:block;font-weight:600}
textarea{width:100%;min-height:16rem;background:#0B0F19;color:#F8FAFC;border:1px solid #64748B;padding:.75rem;font:inherit}
select{max-width:100%;min-height:44px;background:#0B0F19;color:#F8FAFC;font:inherit}
button{font:inherit;font-weight:700;min-height:44px;padding:.6rem .9rem;background:#00E5FF;color:#0B0F19;border:0;border-radius:.4rem;cursor:pointer}
:focus-visible{outline:3px solid #FF5E5B;outline-offset:4px}li{overflow-wrap:anywhere}
</style></head><body><main><p><a href="/customer">Back to workspace</a></p><h1>${html(title)}</h1>${content}</main></body></html>`;
}

export async function renderDrafts(db: Client, context: CustomerContext): Promise<string> {
  const drafts = (await db.query(`SELECT d.id,r.text FROM pilot.drafts d JOIN LATERAL
    (SELECT text FROM pilot.draft_revisions WHERE tenant_id=d.tenant_id AND draft_id=d.id ORDER BY revision DESC LIMIT 1) r ON true
    WHERE d.tenant_id=$1 ORDER BY d.id`, [context.tenantId])).rows;
  return page('Text drafts', '<p><a href="/customer/drafts/new">New draft</a></p><p><a href="/customer/facts">Business facts</a></p>' + (drafts.length ? `<ul>${drafts.map(draft => `<li><a href="/customer/drafts/${html(draft.id)}">${html(draft.text)}</a></li>`).join('')}</ul>` : '<p>No text drafts yet.</p>'));
}

export async function renderNewDraft(db: Client, context: CustomerContext, csrf: string,
  correction?: { text: string; locationId: string }): Promise<string> {
  const locations = (await db.query('SELECT id,provider_location FROM pilot.locations WHERE tenant_id=$1 ORDER BY provider_location,id', [context.tenantId])).rows;
  return page('New text draft', locations.length ? `<form method="post" action="/customer/drafts">
<input type="hidden" name="csrf" value="${html(csrf)}"><label for="location">Initial location</label>
<p id="location-help">This records the draft's starting context. Later destinations require their own approval.</p>
<select id="location" name="locationId" required aria-describedby="location-help">${locations.map(location => `<option value="${html(location.id)}"${location.id === correction?.locationId ? ' selected' : ''}>${html(location.provider_location)}</option>`).join('')}</select>
${draftTextField(correction?.text ?? '', 'Text only. Creating a draft does not schedule, approve or publish.', correction !== undefined)}
<p><button type="submit">Create draft</button></p></form>`
    : '<p>No locations are available in this workspace. A location must be added before you can create a draft.</p><p><a href="/customer/drafts">All text drafts</a></p>');
}

// The caller owns the transaction and holds current authority/session locks.
export async function createDraft(db: Client, context: CustomerContext, locationId: string, text: string): Promise<string> {
  if (!uuid(locationId) || !['Employee', 'Manager'].includes(context.role)) deny();
  const location = await db.query('SELECT id FROM pilot.locations WHERE tenant_id=$1 AND id=$2 FOR KEY SHARE', [context.tenantId, locationId]);
  if (!location.rowCount) deny();
  text = draftText(text);
  const draft = (await db.query('INSERT INTO pilot.drafts(tenant_id,initial_location_id) VALUES($1,$2) RETURNING id', [context.tenantId, locationId])).rows[0];
  await db.query('INSERT INTO pilot.draft_revisions(tenant_id,draft_id,revision,text) VALUES($1,$2,1,$3)', [context.tenantId, draft.id, text]);
  return draft.id;
}

export async function renderDraft(db: Client, context: CustomerContext, draftId: string, csrf: string, invalidText?: string): Promise<string> {
  if (!uuid(draftId)) deny();
  const draft = (await db.query(`SELECT r.id,r.revision,r.text,t.name,l.provider_location FROM pilot.drafts d JOIN pilot.tenants t ON t.id=d.tenant_id
    LEFT JOIN pilot.locations l ON l.tenant_id=d.tenant_id AND l.id=d.initial_location_id JOIN LATERAL
    (SELECT id,revision,text FROM pilot.draft_revisions WHERE tenant_id=d.tenant_id AND draft_id=d.id ORDER BY revision DESC LIMIT 1) r ON true
    WHERE d.tenant_id=$1 AND d.id=$2`, [context.tenantId, draftId])).rows[0];
  if (!draft) deny();
  const occurrences = (await db.query(`SELECT o.id,o.state,l.provider_location FROM pilot.occurrences o
    JOIN pilot.locations l ON l.tenant_id=o.tenant_id AND l.id=o.location_id
    WHERE o.tenant_id=$1 AND o.draft_id=$2 ORDER BY o.id`, [context.tenantId, draftId])).rows;
  return page('Edit text draft', `<p>Workspace: ${html(draft.name)}. Role: ${html(context.role)}. Revision ${draft.revision}.</p>
${draft.provider_location !== null ? `<p>Initial location: ${html(draft.provider_location)}. Later destinations require their own approval.</p>` : ''}
<p>Saving creates a new text revision. Affected unsent approvals need renewed approval. Previously claimed content stays unchanged.</p>
<form method="post" action="/customer/drafts/${html(draftId)}"><input type="hidden" name="csrf" value="${html(csrf)}">
<input type="hidden" name="revisionId" value="${html(draft.id)}">
${draftTextField(invalidText ?? draft.text, 'Text only. Saving does not approve or publish.', invalidText !== undefined)}
<p><button type="submit">Save text</button></p></form>
${occurrences.length ? `<h2>Existing destinations</h2><ul>${occurrences.map(row => `<li><a href="/customer/occurrences/${html(row.id)}">${html(row.provider_location)} — ${html(row.state)}</a></li>`).join('')}</ul>` : ''}
<p><a href="/customer/drafts">All text drafts</a></p>`);
}

function renderDraftConflict(draftId: string, saved: { revision: number; text: string }, submitted: string): string {
  return page('This draft changed', `<p>Someone saved a newer revision. Your text was not saved. Copy any text you want to keep before opening the current draft.</p>
<label for="saved-text">Saved text · Revision ${saved.revision}</label>
<textarea id="saved-text" readonly>\n${html(saved.text)}</textarea>
<label for="unsaved-text">Your unsaved text</label>
<textarea id="unsaved-text" readonly>\n${html(submitted)}</textarea>
<p><a href="/customer/drafts/${html(draftId)}">Open current draft</a></p>`);
}

interface OccurrenceView {
  draft_id: string;
  state: string;
  approval_id: string | null;
  due_at: Date;
  due_instant: string;
  timezone: string;
  location_id: string;
  provider_location: string;
  grant_version: number;
  revision_id: string | null;
  revision: number | null;
  text: string | null;
}

async function readOccurrence(db: Client, context: CustomerContext, occurrenceId: string, includeApproved = false): Promise<OccurrenceView> {
  if (!uuid(occurrenceId)) deny();
  // Keep displayed details and the private approval proposal in the same statement snapshot.
  const occurrence = (await db.query<OccurrenceView>(`SELECT o.draft_id,o.state,o.approval_id,o.due_at,
    extract(epoch FROM o.due_at)::text AS due_instant,o.timezone,o.location_id,l.provider_location,l.version AS grant_version,
    p.id AS revision_id,p.revision,p.text FROM pilot.occurrences o
    JOIN pilot.locations l ON l.tenant_id=o.tenant_id AND l.id=o.location_id
    LEFT JOIN LATERAL (
      SELECT id,revision,text FROM pilot.draft_revisions
      WHERE tenant_id=o.tenant_id AND draft_id=o.draft_id AND $3::boolean
        AND ((o.state='draft' AND o.approval_id IS NULL) OR ($4::boolean AND o.state='approved' AND o.approval_id IS NOT NULL))
        AND NOT EXISTS (SELECT 1 FROM pilot.attempts a WHERE a.tenant_id=o.tenant_id AND a.occurrence_id=o.id)
      ORDER BY revision DESC LIMIT 1
    ) p ON true
    WHERE o.tenant_id=$1 AND o.id=$2`, [context.tenantId, occurrenceId, context.role === 'Manager', includeApproved])).rows[0];
  return occurrence ?? deny();
}

function localDueTime(occurrence: OccurrenceView): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: occurrence.timezone, dateStyle: 'long', timeStyle: 'long'
  }).format(occurrence.due_at);
}

export async function renderOccurrence(db: Client, context: CustomerContext, occurrenceId: string): Promise<string> {
  const occurrence = await readOccurrence(db, context, occurrenceId);
  const utc = occurrence.due_at.toISOString();
  const local = localDueTime(occurrence);
  const details = `<dl>
<dt>Status</dt><dd>${html(occurrence.state)}</dd>
<dt>Destination</dt><dd>${html(occurrence.provider_location)}</dd>
<dt>Due time (UTC)</dt><dd><time datetime="${html(utc)}">${html(utc)}</time></dd>
<dt>Due time (${html(occurrence.timezone)})</dt><dd>${html(local)}</dd></dl>`;
  const content = occurrence.revision === null || occurrence.text === null ? details : `<section aria-labelledby="proposed-text">
<h2 id="proposed-text">Proposed text · Revision ${occurrence.revision}</h2>
${details}
<p style="white-space:pre-wrap;overflow-wrap:anywhere">${html(occurrence.text)}</p></section>`;
  return page('Post occurrence details', `${content}
<p><a href="/customer/drafts/${html(occurrence.draft_id)}">Back to draft</a></p>`);
}

interface ApprovalProposal {
  tenantId: string;
  membershipId: string;
  membershipVersion: number;
  draftId: string;
  occurrenceId: string;
  revisionId: string;
  locationId: string;
  providerLocation: string;
  grantVersion: number;
  dueInstant: string;
  timezone: string;
}

export async function readApprovalProposal(db: Client, context: CustomerContext, occurrenceId: string): Promise<ApprovalProposal> {
  const occurrence = await readOccurrence(db, context, occurrenceId);
  if (occurrence.state !== 'draft' || occurrence.approval_id || !occurrence.revision_id) return deny();
  localDueTime(occurrence);
  return {
    tenantId: context.tenantId, membershipId: context.membershipId, membershipVersion: context.membershipVersion,
    draftId: occurrence.draft_id, occurrenceId, revisionId: occurrence.revision_id, locationId: occurrence.location_id,
    providerLocation: occurrence.provider_location, grantVersion: occurrence.grant_version, dueInstant: occurrence.due_instant,
    timezone: occurrence.timezone
  };
}

// Private entry point. Only the isolated harness supplies authority until the authenticated #223 integration.
export async function approveOccurrence(connect: () => Promise<Client>, binding: CustomerRequest, proposal: ApprovalProposal,
  clock: () => Date, inspect: InspectIdentity): Promise<string> {
  proposal = { ...proposal };
  binding = { ...binding };
  if (!uuid(proposal.draftId) || !uuid(proposal.occurrenceId) || !uuid(proposal.locationId)) return deny();
  const db = await connect();
  try {
    await db.query('BEGIN');
    const context = await requireCustomerRequest(db, binding, clock, inspect, 'read-only');
    requireManagerMfa(context, clock);
    if (context.tenantId !== proposal.tenantId || context.membershipId !== proposal.membershipId
      || context.membershipVersion !== proposal.membershipVersion) return deny();

    const draft = await db.query('SELECT id FROM pilot.drafts WHERE tenant_id=$1 AND id=$2 FOR UPDATE',
      [context.tenantId, proposal.draftId]);
    if (!draft.rowCount) return deny();
    const target = (await db.query<{ location_id: string }>(`SELECT location_id FROM pilot.occurrences
      WHERE tenant_id=$1 AND draft_id=$2 AND id=$3 FOR UPDATE`, [context.tenantId, proposal.draftId, proposal.occurrenceId])).rows[0];
    if (target?.location_id !== proposal.locationId) return deny();
    const location = await db.query('SELECT id FROM pilot.locations WHERE tenant_id=$1 AND id=$2 FOR SHARE',
      [context.tenantId, target.location_id]);
    if (!location.rowCount) return deny();

    const occurrence = await readOccurrence(db, context, proposal.occurrenceId, true);
    if (!occurrence.revision_id || occurrence.revision_id !== proposal.revisionId
      || occurrence.grant_version !== proposal.grantVersion || occurrence.provider_location !== proposal.providerLocation
      || occurrence.due_instant !== proposal.dueInstant || occurrence.timezone !== proposal.timezone) return deny();

    try { localDueTime(occurrence); } catch { return deny(); }

    // Recheck the session and current enrolled factor after any wait for domain locks.
    const current = await requireCustomerRequest(db, binding, clock, inspect);
    requireManagerMfa(current, clock);
    let approvalId: string;
    if (occurrence.state === 'approved' && occurrence.approval_id) {
      const existing = await db.query(`SELECT 1 FROM pilot.approvals
        WHERE tenant_id=$1 AND occurrence_id=$2 AND id=$3 AND revision_id=$4 AND location_id=$5
          AND provider_location=$6 AND grant_version=$7 AND membership_id=$8 AND membership_version=$9
          AND due_at=(SELECT due_at FROM pilot.occurrences WHERE tenant_id=$1 AND id=$2) AND timezone=$10`,
      [context.tenantId, proposal.occurrenceId, occurrence.approval_id, occurrence.revision_id, target.location_id,
        occurrence.provider_location, occurrence.grant_version, context.membershipId, context.membershipVersion, occurrence.timezone]);
      if (!existing.rowCount) return deny();
      approvalId = occurrence.approval_id;
    } else {
      if (occurrence.state !== 'draft' || occurrence.approval_id) return deny();
      const inserted = await db.query<{ id: string }>(`INSERT INTO pilot.approvals(tenant_id,occurrence_id,draft_id,revision_id,
        location_id,provider_location,membership_id,membership_version,grant_version,due_at,timezone,mfa_at)
        SELECT tenant_id,id,draft_id,$3,location_id,$4,$5,$6,$7,due_at,timezone,$8
        FROM pilot.occurrences WHERE tenant_id=$1 AND id=$2 RETURNING id`,
      [context.tenantId, proposal.occurrenceId, occurrence.revision_id, occurrence.provider_location,
        context.membershipId, context.membershipVersion, occurrence.grant_version, current.mfaAt]);
      approvalId = inserted.rows[0]!.id;
      await db.query("UPDATE pilot.occurrences SET approval_id=$3,state='approved' WHERE tenant_id=$1 AND id=$2",
        [context.tenantId, proposal.occurrenceId, approvalId]);
    }
    await db.query('COMMIT');
    return approvalId;
  } catch (error) { await db.query('ROLLBACK'); throw error; }
  finally { await db.end(); }
}

// Caller holds authority/session locks and owns the transaction; claims/approval must use draft → sorted occurrences too.
export async function editDraft(db: Client, context: CustomerContext, draftId: string, revisionId: string, text: string): Promise<void> {
  if (!uuid(draftId) || !['Employee', 'Manager'].includes(context.role)) deny();
  if (!uuid(revisionId)) throw new Error('Invalid request');
  const draft = await db.query('SELECT id FROM pilot.drafts WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, draftId]);
  if (!draft.rowCount) deny();
  const current = (await db.query<{ id: string; revision: number; text: string }>(`SELECT id,revision,text FROM pilot.draft_revisions
    WHERE tenant_id=$1 AND draft_id=$2 ORDER BY revision DESC LIMIT 1`, [context.tenantId, draftId])).rows[0];
  if (!current) return deny();
  const stale = current.id !== revisionId;
  try { text = draftText(text); }
  catch (error) {
    if (stale && error instanceof InvalidDraftText) throw new DraftConflict();
    throw error;
  }
  if (stale) throw new DraftConflict(renderDraftConflict(draftId, current, text));
  await db.query('SELECT id FROM pilot.occurrences WHERE tenant_id=$1 AND draft_id=$2 ORDER BY id FOR UPDATE', [context.tenantId, draftId]);
  await db.query('INSERT INTO pilot.draft_revisions(tenant_id,draft_id,revision,text) VALUES($1,$2,$3,$4)', [context.tenantId, draftId, current.revision + 1, text]);
  await db.query(`UPDATE pilot.occurrences o SET approval_id=NULL,state=CASE WHEN state='approved' THEN 'draft' ELSE state END
    WHERE tenant_id=$1 AND draft_id=$2 AND state IN ('draft','approved','held','quarantined')
    AND NOT EXISTS (SELECT 1 FROM pilot.attempts a WHERE a.tenant_id=o.tenant_id AND a.occurrence_id=o.id)`, [context.tenantId, draftId]);
}
