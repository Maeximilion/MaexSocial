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
    (SELECT text FROM pilot.draft_revisions WHERE tenant_id=d.tenant_id AND draft_id=d.id ORDER BY revision DESC LIMIT 1) r ON r.text IS NOT NULL
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
    (SELECT id,revision,text FROM pilot.draft_revisions WHERE tenant_id=d.tenant_id AND draft_id=d.id ORDER BY revision DESC LIMIT 1) r ON r.text IS NOT NULL
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

const publicationOutcomes = {
  draft: ['Draft', 'This post is awaiting approval.'],
  approved: ['Approved', 'This post is approved and awaiting submission.'],
  held: ['Held', 'Submission is paused for this occurrence.'],
  in_flight: ['Submitting', 'A submission attempt has started. The result is still open.'],
  pending: ['Processing', 'Google reported that it is processing this submission.'],
  rejected: ['Rejected', 'Google reported that it rejected this submission.'],
  confirmed: ['Publication confirmed', 'A recorded check found this post live on Google.'],
  unknown: ['Outcome unknown', 'This post may already be on Google. Resolve the original attempt before retrying or posting manually.'],
  exported: ['Exported', 'The approved text was exported for manual posting. No Google publication was confirmed. Automatic submission is closed for this occurrence.'],
  quarantined: ['Under review', 'This occurrence is blocked while its history is checked.'],
} as const;

interface OccurrenceView {
  draft_id: string;
  erased: boolean;
  state: keyof typeof publicationOutcomes;
  attempt_outcome: 'unknown' | 'pending' | 'confirmed' | 'rejected' | null;
  attempt_details_retired: boolean | null;
  attempt_matches_approval: boolean | null;
  claimed_at: Date | null;
  observed_at: Date | null;
  approval_id: string | null;
  approval_tenant_version: number | null;
  withdrawal_count: string | null;
  due_at: Date;
  due_instant: string;
  timezone: string;
  location_id: string;
  provider_location: string;
  grant_active: boolean;
  grant_version: number;
  revision_id: string | null;
  revision: number | null;
  text: string | null;
}

async function readOccurrence(db: Client, context: CustomerContext, occurrenceId: string, includeApproved = false): Promise<OccurrenceView> {
  if (!uuid(occurrenceId)) deny();
  // Keep displayed details and the private approval proposal in the same statement snapshot.
  const occurrence = (await db.query<OccurrenceView>(`SELECT o.draft_id,o.state,o.approval_id,o.due_at,
    EXISTS (SELECT 1 FROM pilot.draft_revisions r
      WHERE r.tenant_id=o.tenant_id AND r.draft_id=o.draft_id AND r.text IS NULL) AS erased,
    approved.tenant_version AS approval_tenant_version,
    CASE WHEN $4::boolean THEN (SELECT count(*)::text FROM pilot.occurrence_decisions w
      WHERE w.tenant_id=o.tenant_id AND w.occurrence_id=o.id AND w.approval_id IS NOT NULL) END AS withdrawal_count,
    extract(epoch FROM o.due_at)::text AS due_instant,o.timezone,o.location_id,l.provider_location,l.grant_active,l.version AS grant_version,
    p.id AS revision_id,p.revision,p.text,a.claimed_at,a.observed_at,a.outcome AS attempt_outcome,
    a.details_retired AS attempt_details_retired,
    a.approval_id=o.approval_id AS attempt_matches_approval FROM pilot.occurrences o
    JOIN pilot.locations l ON l.tenant_id=o.tenant_id AND l.id=o.location_id
    JOIN pilot.tenants t ON t.id=o.tenant_id AND t.active AND t.version=$5
    LEFT JOIN pilot.approvals approved ON approved.tenant_id=o.tenant_id AND approved.occurrence_id=o.id AND approved.id=o.approval_id
    LEFT JOIN pilot.attempts a ON a.tenant_id=o.tenant_id AND a.occurrence_id=o.id
    LEFT JOIN LATERAL (
      SELECT id,revision,text FROM pilot.draft_revisions
      WHERE tenant_id=o.tenant_id AND draft_id=o.draft_id AND text IS NOT NULL AND $3::boolean
        AND ((o.state='draft' AND o.approval_id IS NULL) OR ($4::boolean AND o.state='approved' AND o.approval_id IS NOT NULL))
        AND a.occurrence_id IS NULL
        AND (NOT $4::boolean OR NOT EXISTS (SELECT 1 FROM pilot.occurrence_decisions h
          WHERE h.tenant_id=o.tenant_id AND h.occurrence_id=o.id AND h.approval_id IS NULL))
      ORDER BY revision DESC LIMIT 1
    ) p ON true
    WHERE o.tenant_id=$1 AND o.id=$2`,
    [context.tenantId, occurrenceId, context.role === 'Manager', includeApproved, context.tenantVersion])).rows[0];
  return occurrence ?? deny();
}

function localDueTime(occurrence: OccurrenceView): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: occurrence.timezone, dateStyle: 'long', timeStyle: 'long'
  }).format(occurrence.due_at);
}

function publicationOutcome(occurrence: OccurrenceView) {
  const { state, attempt_matches_approval, attempt_outcome, attempt_details_retired, observed_at } = occurrence;
  if (attempt_details_retired && attempt_outcome === state && (state === 'confirmed' || state === 'rejected')) {
    return [publicationOutcomes[state][0], 'The recorded result is final. Detailed dispatch evidence has expired.'];
  }
  switch (state) {
    case 'pending':
    case 'confirmed':
    case 'rejected':
      if (attempt_matches_approval && attempt_outcome === state && observed_at) return publicationOutcomes[state];
      break;
    case 'in_flight':
      if (attempt_matches_approval && attempt_outcome === 'unknown' && !observed_at) return publicationOutcomes.in_flight;
      break;
    case 'draft':
    case 'approved':
    case 'held':
    case 'exported':
      if (!attempt_outcome) return publicationOutcomes[state];
      break;
    case 'quarantined':
      return publicationOutcomes.quarantined;
  }
  return publicationOutcomes.unknown;
}

const outcomeTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'UTC', dateStyle: 'long', timeStyle: 'long'
});

function recordedTime(label: string, time: Date | null): string {
  return time ? `<dt>${label} (UTC)</dt><dd><time datetime="${time.toISOString()}">${outcomeTime.format(time)}</time></dd>` : '';
}

export async function renderOccurrence(db: Client, context: CustomerContext, occurrenceId: string, exportCsrf?: string): Promise<string> {
  const occurrence = await readOccurrence(db, context, occurrenceId);
  const utc = occurrence.due_at.toISOString();
  const local = localDueTime(occurrence);
  const [label, explanation] = occurrence.erased && ['draft', 'approved'].includes(occurrence.state)
    ? ['Text erased', 'This occurrence has no text available for submission.'] : publicationOutcome(occurrence);
  const details = `<dl>
<dt>Status</dt><dd><strong>${label}</strong><p>${explanation}</p></dd>
${recordedTime('Attempt started', occurrence.claimed_at)}
${recordedTime('Last observation', occurrence.observed_at)}
<dt>Destination</dt><dd>${html(occurrence.provider_location)}</dd>
<dt>Due time (UTC)</dt><dd><time datetime="${html(utc)}">${html(utc)}</time></dd>
<dt>Due time (${html(occurrence.timezone)})</dt><dd>${html(local)}</dd></dl>`;
  const content = occurrence.revision === null || occurrence.text === null ? details : `<section aria-labelledby="proposed-text">
<h2 id="proposed-text">Proposed text · Revision ${occurrence.revision}</h2>
${details}
<p style="white-space:pre-wrap;overflow-wrap:anywhere">${html(occurrence.text)}</p></section>`;
  const exportForm = !occurrence.erased && exportCsrf !== undefined && (context.role === 'Employee' || context.role === 'Manager')
    && (occurrence.state === 'approved' || occurrence.state === 'exported') && !occurrence.attempt_outcome && !occurrence.grant_active
    && occurrence.approval_tenant_version === context.tenantVersion
    ? `<form method="post" action="/customer/occurrences/${html(occurrenceId)}/export">
<input type="hidden" name="csrf" value="${html(exportCsrf)}">
<p id="export-help">Google access is unavailable. Save the approved text for manual posting.${occurrence.state === 'approved' ? ' Reload this page after the download to see the updated status.' : ''}</p>
<button type="submit" aria-describedby="export-help">Download approved text</button></form>` : '';
  return page('Post occurrence details', `${content}
${exportForm}
${occurrence.erased ? '<p><a href="/customer/drafts">All text drafts</a></p>' : `<p><a href="/customer/drafts/${html(occurrence.draft_id)}">Back to draft</a></p>`}`);
}

interface ApprovalProposal {
  withdrawalCount: string;
  tenantId: string;
  tenantVersion: number;
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
  const occurrence = await readOccurrence(db, context, occurrenceId, true);
  if (!occurrence.revision_id || occurrence.withdrawal_count === null
    || occurrence.approval_tenant_version === context.tenantVersion) return deny();
  localDueTime(occurrence);
  return {
    tenantId: context.tenantId, tenantVersion: context.tenantVersion, withdrawalCount: occurrence.withdrawal_count,
    membershipId: context.membershipId, membershipVersion: context.membershipVersion,
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
    if (context.tenantId !== proposal.tenantId || context.tenantVersion !== proposal.tenantVersion
      || context.membershipId !== proposal.membershipId || context.membershipVersion !== proposal.membershipVersion) return deny();

    const draft = await db.query('SELECT id FROM pilot.drafts WHERE tenant_id=$1 AND id=$2 FOR UPDATE',
      [context.tenantId, proposal.draftId]);
    if (!draft.rowCount) return deny();
    const target = (await db.query<{ location_id: string }>(`SELECT location_id FROM pilot.occurrences
      WHERE tenant_id=$1 AND draft_id=$2 AND id=$3 FOR UPDATE`, [context.tenantId, proposal.draftId, proposal.occurrenceId])).rows[0];
    if (target?.location_id !== proposal.locationId) return deny();
    const location = (await db.query<{ grant_active: boolean }>(
      'SELECT grant_active FROM pilot.locations WHERE tenant_id=$1 AND id=$2 FOR SHARE',
      [context.tenantId, target.location_id])).rows[0] ?? deny();

    const occurrence = await readOccurrence(db, context, proposal.occurrenceId, true);
    if (!occurrence.revision_id || occurrence.revision_id !== proposal.revisionId
      || occurrence.withdrawal_count !== proposal.withdrawalCount
      || occurrence.grant_version !== proposal.grantVersion || occurrence.provider_location !== proposal.providerLocation
      || occurrence.due_instant !== proposal.dueInstant || occurrence.timezone !== proposal.timezone) return deny();

    try { localDueTime(occurrence); } catch { return deny(); }

    // Recheck the session and current enrolled factor after any wait for domain locks.
    const current = await requireCustomerRequest(db, binding, clock, inspect);
    requireManagerMfa(current, clock);
    let approvalId: string;
    if (occurrence.approval_id && occurrence.approval_tenant_version === context.tenantVersion) {
      const existing = await db.query(`SELECT 1 FROM pilot.approvals
        WHERE tenant_id=$1 AND occurrence_id=$2 AND id=$3 AND revision_id=$4 AND location_id=$5
          AND provider_location=$6 AND grant_version=$7 AND membership_id=$8 AND membership_version=$9
          AND due_at=(SELECT due_at FROM pilot.occurrences WHERE tenant_id=$1 AND id=$2) AND timezone=$10
          AND tenant_version=$11`,
      [context.tenantId, proposal.occurrenceId, occurrence.approval_id, occurrence.revision_id, target.location_id,
        occurrence.provider_location, occurrence.grant_version, context.membershipId, context.membershipVersion,
        occurrence.timezone, context.tenantVersion]);
      if (!existing.rowCount) return deny();
      approvalId = occurrence.approval_id;
    } else {
      // A fresh approval replaces only the pointer. Preserve the prior immutable snapshot.
      const inserted = await db.query<{ id: string }>(`INSERT INTO pilot.approvals(tenant_id,occurrence_id,draft_id,revision_id,
        location_id,provider_location,membership_id,membership_version,grant_version,due_at,timezone,mfa_at,grant_active_at_approval,tenant_version)
        SELECT tenant_id,id,draft_id,$3,location_id,$4,$5,$6,$7,due_at,timezone,$8,$9,$10
        FROM pilot.occurrences WHERE tenant_id=$1 AND id=$2 RETURNING id`,
      [context.tenantId, proposal.occurrenceId, occurrence.revision_id, occurrence.provider_location,
        context.membershipId, context.membershipVersion, occurrence.grant_version, current.mfaAt, location.grant_active, context.tenantVersion]);
      approvalId = inserted.rows[0]!.id;
      await db.query("UPDATE pilot.occurrences SET approval_id=$3,state='approved' WHERE tenant_id=$1 AND id=$2",
        [context.tenantId, proposal.occurrenceId, approvalId]);
    }
    await db.query('COMMIT');
    return approvalId;
  } catch (error) { await db.query('ROLLBACK'); throw error; }
  finally { await db.end(); }
}

// Private entry point for the isolated pilot, with no HTTP mount.
export async function withdrawApproval(connect: () => Promise<Client>, binding: CustomerRequest,
  occurrenceId: string, approvalId: string, clock: () => Date, inspect: InspectIdentity): Promise<boolean> {
  binding = { ...binding };
  if (!uuid(occurrenceId) || !uuid(approvalId)) return deny();

  const db = await connect();
  try {
    await db.query('BEGIN');
    const context = await requireCustomerRequest(db, binding, clock, inspect, 'read-only');
    requireManagerMfa(context, clock);
    const { tenantId, tenantVersion, membershipId, membershipVersion, identityId } = context;
    const draft = await db.query(`SELECT d.id FROM pilot.occurrences o
      JOIN pilot.drafts d ON d.tenant_id=o.tenant_id AND d.id=o.draft_id
      WHERE o.tenant_id=$1 AND o.id=$2 FOR UPDATE OF d`, [tenantId, occurrenceId]);
    if (draft.rowCount !== 1) return deny();
    const occurrence = (await db.query<{ approval_id: string | null; state: string }>(
      'SELECT approval_id,state FROM pilot.occurrences WHERE tenant_id=$1 AND id=$2 FOR UPDATE',
      [tenantId, occurrenceId])).rows[0] ?? deny();

    const approval = (await db.query<{ withdrawn: boolean }>(`SELECT EXISTS (
        SELECT 1 FROM pilot.occurrence_decisions w WHERE w.tenant_id=a.tenant_id AND w.occurrence_id=a.occurrence_id
          AND w.approval_id=a.id) AS withdrawn
      FROM pilot.approvals a WHERE a.tenant_id=$1 AND a.occurrence_id=$2 AND a.id=$3
        AND a.tenant_version=$4 AND a.membership_id=$5 AND a.membership_version=$6`,
    [tenantId, occurrenceId, approvalId, tenantVersion, membershipId, membershipVersion])).rows[0] ?? deny();

    // Recheck current enrolled MFA after waiting for the same locks as dispatch and export.
    requireManagerMfa(await requireCustomerRequest(db, binding, clock, inspect, 'read-only'), clock);
    if (!approval.withdrawn) {
      if (occurrence.state !== 'approved' || occurrence.approval_id !== approvalId) return deny();
      const updated = await db.query(`UPDATE pilot.occurrences o SET approval_id=NULL,state='draft'
        WHERE o.tenant_id=$1 AND o.id=$2
          AND NOT EXISTS (SELECT 1 FROM pilot.attempts p WHERE p.tenant_id=o.tenant_id AND p.occurrence_id=o.id)
          AND NOT EXISTS (SELECT 1 FROM pilot.occurrence_decisions h
            WHERE h.tenant_id=o.tenant_id AND h.occurrence_id=o.id AND h.approval_id IS NULL)`,
      [tenantId, occurrenceId]);
      if (updated.rowCount !== 1) return deny();
      const audit = await db.query(`INSERT INTO pilot.audit(tenant_id,actor_id,occurrence_id,approval_id,action,reason,outcome)
        VALUES($1,$2,$3,$4,'approval_withdrawal','Approving Manager withdrew approval','withdrawn')`,
      [tenantId, identityId, occurrenceId, approvalId]);
      if (audit.rowCount !== 1) return deny();
    }
    await db.query('COMMIT');
    return !approval.withdrawn;
  } catch (error) { await db.query('ROLLBACK'); throw error; }
  finally { await db.end(); }
}

interface OccurrenceSchedule {
  draftId: string;
  occurrenceId: string;
  locationId: string;
  timezone: string;
  localTime: string;
  dueAt: string;
}

const wallTime = /^(\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d)(?::([0-5]\d)(?:\.(\d{1,6}))?)?$/;

function validateSchedule(timezone: string, localTime: string, dueAt: string): void {
  const utc = typeof dueAt === 'string' && dueAt.endsWith('Z') ? wallTime.exec(dueAt.slice(0, -1)) : null;
  const local = typeof localTime === 'string' ? wallTime.exec(localTime) : null;
  if (!utc || !local || typeof timezone !== 'string' || timezone.length > 100 || !/^[A-Za-z]/.test(timezone)) return deny();
  const utcSeconds = `${utc[1]}:${utc[2] ?? '00'}`;
  const instant = new Date(`${utcSeconds}Z`);
  if (utcSeconds.startsWith('0000') || !Number.isFinite(instant.getTime()) || !instant.toISOString().startsWith(utcSeconds)
    || (utc[3] ?? '').padEnd(6, '0') !== (local[3] ?? '').padEnd(6, '0')) return deny();

  // Convert the supplied instant to wall time using the same time-zone implementation as the occurrence view.
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', era: 'short',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    });
  } catch { return deny(); }
  const parts = Object.fromEntries(formatter.formatToParts(instant).map(({ type, value }) => [type, value]));
  const actual = `${parts.year!.padStart(4, '0')}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
  if (parts.era !== 'AD' || actual !== `${local[1]}:${local[2] ?? '00'}`) return deny();
}

// Private entry point for the isolated pilot, with no HTTP mount.
export async function rescheduleOccurrence(connect: () => Promise<Client>, binding: CustomerRequest, schedule: OccurrenceSchedule,
  clock: () => Date, inspect: InspectIdentity): Promise<boolean> {
  const { draftId, occurrenceId, locationId, timezone, localTime, dueAt } = schedule;
  binding = { ...binding };
  if (!uuid(draftId) || !uuid(occurrenceId) || !uuid(locationId)) return deny();
  validateSchedule(timezone, localTime, dueAt);

  const db = await connect();
  try {
    await db.query('BEGIN');
    const { tenantId, role } = await requireCustomerRequest(db, binding, clock, inspect, 'read-only');
    if (!['Employee', 'Manager'].includes(role)) return deny();
    const draft = await db.query('SELECT id FROM pilot.drafts WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [tenantId, draftId]);
    if (!draft.rowCount) return deny();
    const target = await db.query(`SELECT id FROM pilot.occurrences WHERE tenant_id=$1 AND draft_id=$2 AND id=$3
      AND state IN ('draft','approved','held','quarantined') FOR UPDATE`, [tenantId, draftId, occurrenceId]);
    if (!target.rowCount) return deny();

    // Read attempts after acquiring the lock so a claim that committed while we waited is visible.
    const attempt = await db.query('SELECT 1 FROM pilot.attempts WHERE tenant_id=$1 AND occurrence_id=$2', [tenantId, occurrenceId]);
    if (attempt.rowCount) return deny();
    const location = await db.query('SELECT id FROM pilot.locations WHERE tenant_id=$1 AND id=$2 FOR KEY SHARE', [tenantId, locationId]);
    if (!location.rowCount) return deny();
    const current = await requireCustomerRequest(db, binding, clock, inspect, 'read-only');
    if (current.tenantId !== tenantId || !['Employee', 'Manager'].includes(current.role)) return deny();

    const updated = await db.query(`UPDATE pilot.occurrences
      SET location_id=$3,due_at=$4,timezone=$5,approval_id=NULL,state=CASE WHEN state='approved' THEN 'draft' ELSE state END
      WHERE tenant_id=$1 AND id=$2 AND ROW(location_id,due_at,timezone) IS DISTINCT FROM ROW($3::uuid,$4::timestamptz,$5::text)`,
    [tenantId, occurrenceId, locationId, dueAt, timezone]);
    await db.query('COMMIT');
    return updated.rowCount === 1;
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
  if (!current || current.text === null) return deny();
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
