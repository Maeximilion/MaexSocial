import type { Request } from 'express';
import type { Client } from 'pg';
import type { CustomerContext, InspectIdentity } from '../../../../packages/contracts/pilot.js';
import { requireCsrf, requireCustomer, tokenHash } from './session.js';

export const customerOrigin = 'https://customer:8443';
export interface CustomerRequest { token: string; csrf: string }
const deny = (): never => { throw new Error('Denied'); };

// Parse once at the HTTP boundary; authority and CSRF binding still require the transaction below.
export function customerRequest(request: Request, fields?: string[]): CustomerRequest {
  if (!request.secure || request.headers.host !== 'customer:8443') deny();
  const values = new Map<string, string>();
  for (const part of (request.headers.cookie ?? '').split(';')) {
    const [name, ...parts] = part.trim().split('=');
    if (name !== '__Host-session' && name !== '__Host-csrf') continue;
    if (values.has(name)) deny();
    values.set(name, parts.join('='));
  }
  const token = values.get('__Host-session') ?? '', csrf = values.get('__Host-csrf') ?? '';
  if (!/^[a-f0-9]{64}$/.test(token) || !/^[a-f0-9]{64}$/.test(csrf)) deny();
  if (fields) {
    if (request.method !== 'POST' || !fields.includes('csrf') || !request.body || typeof request.body !== 'object'
      || Array.isArray(request.body) || Object.keys(request.body).length !== fields.length
      || fields.some(key => typeof request.body[key] !== 'string')) throw new Error('Invalid request');
    requireCsrf(request.headers.origin, request.body.csrf, customerOrigin, csrf);
  } else if (request.method !== 'GET' && request.method !== 'HEAD') deny();
  return { token, csrf };
}

// Call under the session/authority locks; the caller rolls back on rejection.
export async function requireBoundCsrf(db: Client, request: CustomerRequest): Promise<void> {
  const row = (await db.query("SELECT csrf_hash FROM pilot.sessions WHERE token_hash=$1 AND audience='customer'", [tokenHash(request.token)])).rows[0];
  if (!row) deny();
  requireCsrf(customerOrigin, tokenHash(request.csrf), customerOrigin, row.csrf_hash ?? '');
}

export async function requireCustomerRequest(db: Client, request: CustomerRequest, now: Date, inspect: InspectIdentity): Promise<CustomerContext> {
  const context = await requireCustomer(db, request.token, now, inspect);
  await requireBoundCsrf(db, request);
  return context;
}
