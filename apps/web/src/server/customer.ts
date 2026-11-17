import express from 'express';
import type { Client } from 'pg';
import type { InspectIdentity } from '../../../../packages/contracts/pilot.js';
import { lockIdentities, requireCsrf, requireCustomer, rotateCustomerSession, tokenHash } from './session.js';
import { renderPortal } from '../routes/portal.js';

const origin = 'https://customer:8443';
const cookieOptions = { secure: true, httpOnly: true, sameSite: 'lax' as const, path: '/' };
const deny = (): never => { throw new Error('Denied'); };

function cookies(request: express.Request): { token: string; csrf: string } {
  const values = new Map<string, string>();
  for (const part of (request.headers.cookie ?? '').split(';')) {
    const [name, ...parts] = part.trim().split('=');
    if (name !== '__Host-session' && name !== '__Host-csrf') continue;
    if (values.has(name)) deny();
    values.set(name, parts.join('='));
  }
  const token = values.get('__Host-session') ?? '', csrf = values.get('__Host-csrf') ?? '';
  if (!/^[a-f0-9]{64}$/.test(token) || !/^[a-f0-9]{64}$/.test(csrf)) deny();
  return { token, csrf };
}

function fields(request: express.Request, expected: string[]): void {
  if (!request.body || typeof request.body !== 'object' || Array.isArray(request.body)
    || Object.keys(request.body).length !== expected.length || expected.some(key => typeof request.body[key] !== 'string')) throw new Error('Invalid request');
}

async function boundCsrf(db: Client, token: string, csrf: string): Promise<void> {
  const row = (await db.query("SELECT csrf_hash FROM pilot.sessions WHERE token_hash=$1 AND audience='customer'", [tokenHash(token)])).rows[0];
  if (!row) deny();
  requireCsrf(origin, tokenHash(csrf), origin, row.csrf_hash ?? '');
}

export function createCustomerApp(connect: () => Promise<Client>, inspect: InspectIdentity): express.Express {
  const app = express();
  app.disable('x-powered-by'); app.set('trust proxy', false);
  app.use((request, response, next) => {
    response.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'same-origin', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'" });
    if (!request.secure || request.headers.host !== 'customer:8443') { response.status(400).type('text').send('HTTPS required.'); return; }
    next();
  });
  app.use(express.urlencoded({ extended: false, limit: '2kb', parameterLimit: 4 }));
  async function transaction<T>(work: (db: Client) => Promise<T>): Promise<T> {
    const db = await connect();
    try { await db.query('BEGIN'); const value = await work(db); await db.query('COMMIT'); return value; }
    catch (error) { await db.query('ROLLBACK'); throw error; }
    finally { await db.end(); }
  }
  app.get('/customer', async (request, response) => {
    const { token, csrf } = cookies(request);
    const page = await transaction(async db => {
      const context = await requireCustomer(db, token, new Date(), inspect); await boundCsrf(db, token, csrf);
      const tenants = (await db.query(`SELECT t.id,t.name FROM pilot.memberships m JOIN pilot.tenants t ON t.id=m.tenant_id
        WHERE m.identity_id=$1 AND m.active AND t.active ORDER BY t.name,t.id`, [context.identityId])).rows;
      return renderPortal(context, tenants, csrf);
    });
    response.type('html').send(page);
  });
  app.post('/customer/switch', async (request, response) => {
    fields(request, ['tenantId', 'csrf']); const { token, csrf } = cookies(request);
    requireCsrf(request.headers.origin, request.body.csrf, origin, csrf);
    const result = await transaction(async db => {
      await boundCsrf(db, token, csrf);
      const rotated = await rotateCustomerSession(db, token, request.body.tenantId, new Date(), inspect);
      await boundCsrf(db, token, csrf);
      const session = (await db.query('SELECT expires_at FROM pilot.sessions WHERE token_hash=$1', [tokenHash(rotated.token)])).rows[0];
      return { ...rotated, expires: session.expires_at as Date };
    });
    response.cookie('__Host-session', result.token, { ...cookieOptions, expires: result.expires });
    response.cookie('__Host-csrf', result.csrf, { ...cookieOptions, expires: result.expires });
    response.redirect(303, '/customer');
  });
  app.post('/customer/logout', async (request, response) => {
    fields(request, ['csrf']); const { token, csrf } = cookies(request);
    requireCsrf(request.headers.origin, request.body.csrf, origin, csrf);
    await transaction(async db => {
      const located = (await db.query('SELECT identity_id FROM pilot.sessions WHERE token_hash=$1', [tokenHash(token)])).rows[0];
      if (!located) deny(); await lockIdentities(db, [located.identity_id]);
      const current = (await db.query('SELECT identity_id FROM pilot.sessions WHERE token_hash=$1 FOR UPDATE', [tokenHash(token)])).rows[0];
      if (!current || current.identity_id !== located.identity_id) deny(); await boundCsrf(db, token, csrf);
      await db.query("UPDATE pilot.sessions SET revoked_at=COALESCE(revoked_at,$1) WHERE token_hash=$2 AND audience='customer'", [new Date(), tokenHash(token)]);
    });
    response.clearCookie('__Host-session', cookieOptions); response.clearCookie('__Host-csrf', cookieOptions); response.redirect(303, '/');
  });
  app.use((_request, response) => { response.status(404).type('text').send('Not found.'); });
  app.use((error: Error, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    const status = error.message === 'Denied' ? 403 : error.message === 'Invalid request' || 'type' in error ? 400 : 503;
    response.status(status).type('text').send(status === 503 ? 'Temporarily unavailable. Please try again.' : 'Request could not be completed.');
  });
  return app;
}
