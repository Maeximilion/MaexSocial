import type { Client } from 'pg';
import type { CustomerContext } from '../../../../packages/contracts/pilot.js';
import { html } from './portal.js';

const uuid = (value: string): boolean => /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value);
const deny = (): never => { throw new Error('Denied'); };

function draftText(text: string): string {
  text = text.replace(/\r\n?/g, '\n');
  const length = [...text].length;
  if (/[\u0000\uD800-\uDFFF]/u.test(text) || length < 1 || length > 1500) throw new Error('Invalid request');
  return text;
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

export async function renderNewDraft(db: Client, context: CustomerContext, csrf: string): Promise<string> {
  const locations = (await db.query('SELECT id,provider_location FROM pilot.locations WHERE tenant_id=$1 ORDER BY provider_location,id', [context.tenantId])).rows;
  return page('New text draft', locations.length ? `<form method="post" action="/customer/drafts">
<input type="hidden" name="csrf" value="${html(csrf)}"><label for="location">Initial location</label>
<p id="location-help">This records the draft's starting context. Later destinations require their own approval.</p>
<select id="location" name="locationId" required aria-describedby="location-help">${locations.map(location => `<option value="${html(location.id)}">${html(location.provider_location)}</option>`).join('')}</select>
<label for="text">Draft text</label><p id="text-help">Enter 1–1500 characters. Text only; creating a draft does not schedule, approve or publish.</p>
<textarea id="text" name="text" required aria-describedby="text-help"></textarea><p><button type="submit">Create draft</button></p></form>`
    : '<p>No locations are available in this workspace. A location must be added before you can create a draft.</p><p><a href="/customer/drafts">All text drafts</a></p>');
}

// The caller owns the transaction and holds current authority/session locks.
export async function createDraft(db: Client, context: CustomerContext, locationId: string, text: string): Promise<string> {
  if (!uuid(locationId) || !['Employee', 'Manager'].includes(context.role)) deny();
  text = draftText(text);
  const location = await db.query('SELECT id FROM pilot.locations WHERE tenant_id=$1 AND id=$2 FOR KEY SHARE', [context.tenantId, locationId]);
  if (!location.rowCount) deny();
  const draft = (await db.query('INSERT INTO pilot.drafts(tenant_id,initial_location_id) VALUES($1,$2) RETURNING id', [context.tenantId, locationId])).rows[0];
  await db.query('INSERT INTO pilot.draft_revisions(tenant_id,draft_id,revision,text) VALUES($1,$2,1,$3)', [context.tenantId, draft.id, text]);
  return draft.id;
}

export async function renderDraft(db: Client, context: CustomerContext, draftId: string, csrf: string): Promise<string> {
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
<input type="hidden" name="revisionId" value="${html(draft.id)}"><label for="text">Draft text</label>
<p id="text-help">Enter 1–1500 characters. Text only; saving does not approve or publish.</p>
<textarea id="text" name="text" required aria-describedby="text-help">\n${html(draft.text)}</textarea><p><button type="submit">Save text</button></p></form>
${occurrences.length ? `<h2>Existing destinations</h2><ul>${occurrences.map(row => `<li><a href="/customer/occurrences/${html(row.id)}">${html(row.provider_location)} — ${html(row.state)}</a></li>`).join('')}</ul>` : ''}
<p><a href="/customer/drafts">All text drafts</a></p>`);
}

export async function renderOccurrence(db: Client, context: CustomerContext, occurrenceId: string): Promise<string> {
  if (!uuid(occurrenceId)) deny();
  const occurrence = (await db.query(`SELECT o.draft_id,o.state,o.due_at,o.timezone,l.provider_location FROM pilot.occurrences o
    JOIN pilot.locations l ON l.tenant_id=o.tenant_id AND l.id=o.location_id
    WHERE o.tenant_id=$1 AND o.id=$2`, [context.tenantId, occurrenceId])).rows[0];
  if (!occurrence) deny();
  const utc = (occurrence.due_at as Date).toISOString();
  const local = new Intl.DateTimeFormat('en-GB', {
    timeZone: occurrence.timezone, dateStyle: 'long', timeStyle: 'long'
  }).format(occurrence.due_at);
  return page('Post occurrence details', `<dl>
<dt>Status</dt><dd>${html(occurrence.state)}</dd>
<dt>Destination</dt><dd>${html(occurrence.provider_location)}</dd>
<dt>Due time (UTC)</dt><dd><time datetime="${html(utc)}">${html(utc)}</time></dd>
<dt>Due time (${html(occurrence.timezone)})</dt><dd>${html(local)}</dd></dl>
<p><a href="/customer/drafts/${html(occurrence.draft_id)}">Back to draft</a></p>`);
}

// Caller holds authority/session locks and owns the transaction; claims/approval must use draft → sorted occurrences too.
export async function editDraft(db: Client, context: CustomerContext, draftId: string, revisionId: string, text: string): Promise<void> {
  if (!uuid(draftId) || !['Employee', 'Manager'].includes(context.role)) deny();
  text = draftText(text);
  if (!uuid(revisionId)) throw new Error('Invalid request');
  const draft = await db.query('SELECT id FROM pilot.drafts WHERE tenant_id=$1 AND id=$2 FOR UPDATE', [context.tenantId, draftId]);
  if (!draft.rowCount) deny();
  const current = (await db.query(`SELECT id,revision FROM pilot.draft_revisions
    WHERE tenant_id=$1 AND draft_id=$2 ORDER BY revision DESC LIMIT 1`, [context.tenantId, draftId])).rows[0];
  if (!current) deny();
  if (current.id !== revisionId) throw new Error('Revision conflict');
  await db.query('SELECT id FROM pilot.occurrences WHERE tenant_id=$1 AND draft_id=$2 ORDER BY id FOR UPDATE', [context.tenantId, draftId]);
  await db.query('INSERT INTO pilot.draft_revisions(tenant_id,draft_id,revision,text) VALUES($1,$2,$3,$4)', [context.tenantId, draftId, current.revision + 1, text]);
  await db.query(`UPDATE pilot.occurrences o SET approval_id=NULL,state=CASE WHEN state='approved' THEN 'draft' ELSE state END
    WHERE tenant_id=$1 AND draft_id=$2 AND state IN ('draft','approved','held','quarantined')
    AND NOT EXISTS (SELECT 1 FROM pilot.attempts a WHERE a.tenant_id=o.tenant_id AND a.occurrence_id=o.id)`, [context.tenantId, draftId]);
}
