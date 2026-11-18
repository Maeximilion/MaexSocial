import type { Client } from 'pg';
import type { CustomerContext } from '../../../../packages/contracts/pilot.js';
import { page } from './content.js';
import { html } from './portal.js';

// The caller holds the existing current-authority locks in its transaction.
export async function renderFacts(db: Client, context: CustomerContext, locationId?: string): Promise<string> {
  if (!['Employee', 'Manager'].includes(context.role)
    || (locationId !== undefined && !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(locationId))) throw new Error('Denied');
  const locations = (await db.query(`SELECT l.id,l.provider_location,f.revision,f.text,f.source_note,f.confirmed_at
    FROM pilot.locations l LEFT JOIN LATERAL
      (SELECT revision,text,source_note,confirmed_at FROM pilot.business_fact_revisions
       WHERE tenant_id=l.tenant_id AND location_id=l.id ORDER BY revision DESC LIMIT 1) f ON true
    WHERE l.tenant_id=$1 AND ($2::uuid IS NULL OR l.id=$2) ORDER BY l.provider_location,l.id`, [context.tenantId, locationId ?? null])).rows;
  if (locationId !== undefined && !locations.length) throw new Error('Denied');
  return page('Business facts', `<p>Read-only drafting context. Not a real customer confirmation or permission to publish.</p>
${locations.length ? locations.map(location => `<section aria-labelledby="location-${html(location.id)}">
<h2 id="location-${html(location.id)}"><a href="/customer/facts/${html(location.id)}">${html(location.provider_location)}</a></h2>
${location.revision === null ? '<p>No business facts yet for this location.</p>' : `<p>Revision ${location.revision}</p>
<p style="white-space:pre-wrap;overflow-wrap:anywhere">${html(location.text)}</p>
<h3>Source note</h3><p style="white-space:pre-wrap;overflow-wrap:anywhere">${html(location.source_note)}</p>
<p>Simulated fixture confirmation: <time datetime="${html(location.confirmed_at.toISOString())}">${html(location.confirmed_at.toISOString())}</time>.</p>`}</section>`).join('')
    : '<p>No business facts yet. This workspace has no locations.</p>'}
<p><a href="/customer/drafts">Text drafts</a></p>${locationId ? '<p><a href="/customer/facts">All business facts</a></p>' : ''}`);
}
