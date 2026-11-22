import express from 'express';
import type { Client } from 'pg';
import type { InspectIdentity } from '../../../../packages/contracts/pilot.js';
import { lockIdentities, rotateCustomerSession, tokenHash } from './session.js';
import { customerRequest, requireBoundCsrf, requireCustomerRequest } from './request.js';
import { renderPortal, renderSignedOut } from '../routes/portal.js';
import { createDraft, DraftConflict, editDraft, InvalidDraftText, renderDraft, renderDrafts, renderNewDraft, renderOccurrence } from '../routes/content.js';
import { renderFacts } from '../routes/facts.js';
import { invitationToken, previewEmployeeInvitation, renderInvitationPreview } from '../routes/employees.js';

const cookieOptions = { secure: true, httpOnly: true, sameSite: 'lax' as const, path: '/' };
const deny = (): never => { throw new Error('Denied'); };

class DraftCorrection extends Error {
  constructor(readonly page: string) { super('Invalid request'); }
}

async function saveDraft<T>(save: () => Promise<T>, render: (invalidText: string) => Promise<string>): Promise<T> {
  try { return await save(); }
  catch (error) {
    // Render under the checked locks, then roll back before sending the correction.
    if (error instanceof InvalidDraftText) throw new DraftCorrection(await render(error.text));
    throw error;
  }
}

export function createCustomerApp(connect: () => Promise<Client>, inspect: InspectIdentity,
  privateLogout?: { issuer: string; clientId: string; postLogoutRedirectUri: string },
  privateInvitationPreview?: { recipientBySubject: ReadonlyMap<string, string> }): express.Express {
  // This unmounted option belongs only to the isolated, pinned browser fixture.
  if (privateLogout && (privateLogout.issuer !== 'https://keycloak:8443/realms/pilot'
    || privateLogout.clientId !== 'pilot-oidc-test' || privateLogout.postLogoutRedirectUri !== 'https://customer:8443/')) {
    throw new Error('Invalid private logout configuration');
  }
  const logoutRedirect = privateLogout ? `${privateLogout.issuer}/protocol/openid-connect/logout?${new URLSearchParams({
    client_id: privateLogout.clientId, post_logout_redirect_uri: privateLogout.postLogoutRedirectUri
  })}` : '/';
  const app = express();
  app.disable('x-powered-by'); app.set('trust proxy', false);
  app.use((request, response, next) => {
    response.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'same-origin', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; form-action 'self'${logoutRedirect === '/' ? '' : ' https://keycloak:8443/realms/pilot/protocol/openid-connect/logout'}; frame-ancestors 'none'; base-uri 'none'` });
    if (!request.secure || request.headers.host !== 'customer:8443') { response.status(400).type('text').send('HTTPS required.'); return; }
    next();
  });
  app.post('/customer/drafts/:draftId', express.urlencoded({ extended: false, limit: '20kb', parameterLimit: 3 }));
  app.post('/customer/drafts', express.urlencoded({ extended: false, limit: '20kb', parameterLimit: 3 }));
  app.use(express.urlencoded({ extended: false, limit: '2kb', parameterLimit: 4 }));
  app.get('/', (_request, response) => { response.type('html').send(renderSignedOut()); });
  async function transaction<T>(work: (db: Client) => Promise<T>): Promise<T> {
    const db = await connect();
    try { await db.query('BEGIN'); const value = await work(db); await db.query('COMMIT'); return value; }
    catch (error) { await db.query('ROLLBACK'); throw error; }
    finally { await db.end(); }
  }
  app.get('/customer', async (request, response) => {
    const binding = customerRequest(request); const { csrf } = binding;
    const page = await transaction(async db => {
      const context = await requireCustomerRequest(db, binding, () => new Date(), inspect);
      const tenants = (await db.query(`SELECT t.id,t.name FROM pilot.memberships m JOIN pilot.tenants t ON t.id=m.tenant_id
        WHERE m.identity_id=$1 AND m.active AND t.active ORDER BY t.name,t.id`, [context.identityId])).rows;
      return renderPortal(context, tenants, csrf);
    });
    response.type('html').send(page);
  });
  app.post('/customer/switch', async (request, response) => {
    const binding = customerRequest(request, ['tenantId', 'csrf']); const { token } = binding;
    const result = await transaction(async db => {
      const rotated = await rotateCustomerSession(db, token, request.body.tenantId, () => new Date(), inspect);
      await requireBoundCsrf(db, binding);
      const session = (await db.query('SELECT expires_at FROM pilot.sessions WHERE token_hash=$1', [tokenHash(rotated.token)])).rows[0];
      return { ...rotated, expires: session.expires_at as Date };
    });
    response.cookie('__Host-session', result.token, { ...cookieOptions, expires: result.expires });
    response.cookie('__Host-csrf', result.csrf, { ...cookieOptions, expires: result.expires });
    response.redirect(303, '/customer');
  });
  app.get<{ locationId?: string }>(['/customer/facts', '/customer/facts/:locationId'], async (request, response) => {
    const binding = customerRequest(request);
    const page = await transaction(async db => renderFacts(db, await requireCustomerRequest(db, binding, () => new Date(), inspect), request.params.locationId));
    response.type('html').send(page);
  });
  // #221 owns the public link and real identity proof. Only the isolated fixture supplies this binding.
  if (privateInvitationPreview) app.get('/customer/invitations/preview', async (request, response) => {
    response.set('Referrer-Policy', 'no-referrer');
    const token = invitationToken(request.headers.cookie);
    let tenantName: string | undefined;
    if (token) {
      try {
        const binding = customerRequest(request);
        tenantName = await transaction(async db => {
          const { subject } = await requireCustomerRequest(db, binding, () => new Date(), inspect, 'read-only');
          const email = privateInvitationPreview.recipientBySubject.get(subject);
          return email === undefined ? undefined : previewEmployeeInvitation(db, token, email);
        });
      } catch (error) {
        if (!(error instanceof Error) || error.message !== 'Denied') throw error;
      }
    }
    response.status(tenantName === undefined ? 404 : 200).type('html').send(renderInvitationPreview(tenantName));
  });
  app.get('/customer/drafts', async (request, response) => {
    const binding = customerRequest(request);
    const page = await transaction(async db => renderDrafts(db, await requireCustomerRequest(db, binding, () => new Date(), inspect)));
    response.type('html').send(page);
  });
  app.get('/customer/drafts/new', async (request, response) => {
    const binding = customerRequest(request);
    const page = await transaction(async db => renderNewDraft(db, await requireCustomerRequest(db, binding, () => new Date(), inspect), binding.csrf));
    response.type('html').send(page);
  });
  app.post('/customer/drafts', async (request, response) => {
    const binding = customerRequest(request, ['text', 'locationId', 'csrf']);
    const { text, locationId } = request.body;
    const draftId = await transaction(async db => {
      const context = await requireCustomerRequest(db, binding, () => new Date(), inspect);
      return saveDraft(() => createDraft(db, context, locationId, text),
        invalidText => renderNewDraft(db, context, binding.csrf, { text: invalidText, locationId }));
    });
    response.redirect(303, `/customer/drafts/${draftId}`);
  });
  app.get('/customer/drafts/:draftId', async (request, response) => {
    const binding = customerRequest(request);
    const page = await transaction(async db => renderDraft(db, await requireCustomerRequest(db, binding, () => new Date(), inspect), request.params.draftId, binding.csrf));
    response.type('html').send(page);
  });
  app.get('/customer/occurrences/:occurrenceId', async (request, response) => {
    const binding = customerRequest(request);
    const page = await transaction(async db => renderOccurrence(db, await requireCustomerRequest(db, binding, () => new Date(), inspect), request.params.occurrenceId));
    response.type('html').send(page);
  });
  app.post('/customer/drafts/:draftId', async (request, response) => {
    const binding = customerRequest(request, ['text', 'revisionId', 'csrf']);
    const { draftId } = request.params;
    const { text, revisionId } = request.body;
    await transaction(async db => {
      const context = await requireCustomerRequest(db, binding, () => new Date(), inspect);
      return saveDraft(() => editDraft(db, context, draftId, revisionId, text),
        invalidText => renderDraft(db, context, draftId, binding.csrf, invalidText));
    });
    response.redirect(303, `/customer/drafts/${draftId}`);
  });
  app.post('/customer/logout', async (request, response) => {
    const binding = customerRequest(request, ['csrf']); const { token } = binding;
    await transaction(async db => {
      const located = (await db.query('SELECT identity_id FROM pilot.sessions WHERE token_hash=$1', [tokenHash(token)])).rows[0];
      if (!located) deny(); await lockIdentities(db, [located.identity_id]);
      const current = (await db.query('SELECT identity_id FROM pilot.sessions WHERE token_hash=$1 FOR UPDATE', [tokenHash(token)])).rows[0];
      if (!current || current.identity_id !== located.identity_id) deny(); await requireBoundCsrf(db, binding);
      await db.query("UPDATE pilot.sessions SET revoked_at=COALESCE(revoked_at,$1) WHERE token_hash=$2 AND audience='customer'", [new Date(), tokenHash(token)]);
    });
    response.clearCookie('__Host-session', cookieOptions); response.clearCookie('__Host-csrf', cookieOptions); response.redirect(303, logoutRedirect);
  });
  app.use((_request, response) => { response.status(404).type('text').send('Not found.'); });
  app.use((error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    if (error instanceof DraftCorrection) { response.status(400).type('html').send(error.page); return; }
    if (error instanceof DraftConflict) {
      if (error.page !== undefined) response.status(409).type('html').send(error.page);
      else response.status(409).type('text').send('This draft changed. Reload the draft before editing again. Your text was not saved.');
      return;
    }
    const status = error.message === 'Denied' ? 403 : error.message === 'Invalid request' || 'type' in error ? 400 : 503;
    response.status(status).type('text').send(status === 503 ? 'Temporarily unavailable. Please try again.' : 'Request could not be completed.');
  });
  return app;
}
