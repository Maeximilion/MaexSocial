import { request } from 'node:https';
import type { InspectIdentity } from '../../../../packages/contracts/pilot.js';

const unavailable = (): never => { throw new Error('Identity status unavailable'); };
const record = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return unavailable();
  return value as Record<string, unknown>;
};
const identifier = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/.test(value);
const label = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const list = (value: unknown): unknown[] => {
  if (!Array.isArray(value) || value.length > 32) return unavailable();
  return value;
};

// Server composition only; no browser route accepts this configuration or its token.
export function createIdentityInspector(config: { issuer: string; clientId: string; clientSecret: string; ca: string }): InspectIdentity {
  let issuer: URL;
  try { issuer = new URL(config.issuer); } catch { return unavailable(); }
  if (issuer.protocol !== 'https:' || issuer.username || issuer.password || issuer.search || issuer.hash
    || issuer.pathname !== '/realms/pilot' || !identifier(config.clientId)
    || !/^[A-Za-z0-9._~-]{1,512}$/.test(config.clientSecret)
    || typeof config.ca !== 'string' || !config.ca.length || config.ca.length > 32768) return unavailable();
  const origin = issuer.origin, ca = config.ca;
  const authorization = `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`;

  return async subject => {
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 5000);
    try {
      if (!identifier(subject)) return unavailable();
      // One deadline includes DNS, TLS, headers and bodies across all three calls.
      const json = (path: string, auth: string, body?: string): Promise<unknown> => new Promise((resolve, reject) => {
        const req = request(new URL(path, origin), { method: body === undefined ? 'GET' : 'POST', ca,
          rejectUnauthorized: true, agent: false, signal: controller.signal, maxHeaderSize: 8192,
          headers: { authorization: auth, accept: 'application/json', 'accept-encoding': 'identity',
            ...(body === undefined ? {} : { 'content-type': 'application/x-www-form-urlencoded', 'content-length': Buffer.byteLength(body) }) } }, res => {
          const fail = () => { res.destroy(); req.destroy(); reject(new Error('Identity status unavailable')); };
          res.on('error', fail); res.on('aborted', fail);
          if (res.statusCode !== 200 || !/^application\/json(?:\s*;|$)/i.test(res.headers['content-type'] ?? '')
            || (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity')
            || (res.headers['content-length'] !== undefined && (!/^\d+$/.test(res.headers['content-length'])
              || Number(res.headers['content-length']) > 65536))) { fail(); return; }
          const chunks: Buffer[] = []; let bytes = 0;
          res.on('data', (chunk: Buffer) => {
            bytes += chunk.length;
            if (bytes > 65536) { fail(); return; }
            chunks.push(chunk);
          });
          res.on('end', () => {
            try { resolve(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)))); }
            catch { fail(); }
          });
        });
        req.on('error', () => reject(new Error('Identity status unavailable')));
        req.end(body);
      });
      const token = record(await json('/realms/pilot/protocol/openid-connect/token', authorization, 'grant_type=client_credentials'));
      if (typeof token.access_token !== 'string' || token.access_token.length > 16384 || !/^[A-Za-z0-9._~+\/-]+={0,2}$/.test(token.access_token)
        || typeof token.token_type !== 'string' || token.token_type.toLowerCase() !== 'bearer'
        || !Number.isSafeInteger(token.expires_in) || Number(token.expires_in) <= 0 || Number(token.expires_in) > 86400) return unavailable();
      const bearer = `Bearer ${token.access_token}`;
      const path = `/admin/realms/pilot/users/${encodeURIComponent(subject)}`;
      const user = record(await json(path, bearer));
      if (user.id !== subject || typeof user.emailVerified !== 'boolean' || typeof user.enabled !== 'boolean') return unavailable();
      const requiredActions = list(user.requiredActions).map(action => { if (!label(action)) return unavailable(); return action; });
      const credentials = list(await json(`${path}/credentials`, bearer)).map(value => {
        const credential = record(value);
        if (!identifier(credential.id) || !label(credential.type)) return unavailable();
        return { id: credential.id, type: credential.type };
      });
      if (new Set(credentials.map(c => c.id)).size !== credentials.length || controller.signal.aborted) return unavailable();
      // Separate reads are not an atomic lifecycle snapshot or proof of MFA use/freshness.
      return { subject, verified: user.emailVerified, enabled: user.enabled, requiredActions, credentials };
    } catch { return unavailable(); }
    finally { clearTimeout(deadline); controller.abort(); }
  };
}
