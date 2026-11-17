import type { Client } from 'pg';
import { createHash, randomBytes } from 'node:crypto';
import { request } from 'node:https';
import * as oauth from 'oauth4webapi';

export interface OidcConfig {
  issuer: string; clientId: string; clientSecret: string; callback: string; ca: string;
  stepUp?: { expectedSubject: string; policy: string };
}
export interface OidcStepUpEvidence {
  issuer: string; clientId: string; subject: string; policy: string; acr: '2';
  factorTimeLowerBound: Date; verifiedAt: Date; validUntil: Date;
}
const unavailable = (): never => { throw new Error('OIDC unavailable'); };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const binding = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

// Private server composition only. connect must open a NEW connection, never a caller's transaction.
export function createOidcVerifier(config: OidcConfig, connect: () => Promise<Client>) {
  const stepUp = config.stepUp === undefined ? undefined : { ...config.stepUp };
  if (stepUp && (stepUp.policy !== 'keycloak-26.8.2-enrolled-otp-v1'
    || typeof stepUp.expectedSubject !== 'string' || !/^[\x21-\x7e]{1,255}$/.test(stepUp.expectedSubject))) return unavailable();
  let issuer: URL, callback: URL;
  try { issuer = new URL(config.issuer); callback = new URL(config.callback); } catch { return unavailable(); }
  for (const url of [issuer, callback]) {
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) return unavailable();
  }
  if (issuer.href !== config.issuer || issuer.pathname !== '/realms/pilot'
    || callback.href !== config.callback || callback.pathname !== '/oidc/callback'
    || !/^[A-Za-z0-9_-]{1,128}$/.test(config.clientId) || !/^[A-Za-z0-9._~-]{1,512}$/.test(config.clientSecret)
    || typeof config.ca !== 'string' || !config.ca.length || config.ca.length > 32768) return unavailable();
  // Copy configuration; later caller mutations cannot change an existing attempt's authority.
  const issuerUrl = issuer.href, callbackUrl = callback.href, ca = config.ca;
  const client: oauth.Client = { client_id: config.clientId, id_token_signed_response_alg: 'RS256', [oauth.clockTolerance]: 0 };
  const auth = oauth.ClientSecretBasic(config.clientSecret);
  const metadata: oauth.AuthorizationServer = { issuer: issuerUrl,
    authorization_endpoint: `${issuerUrl}/protocol/openid-connect/auth`, token_endpoint: `${issuerUrl}/protocol/openid-connect/token`,
    jwks_uri: `${issuerUrl}/protocol/openid-connect/certs`, id_token_signing_alg_values_supported: ['RS256'],
    authorization_response_iss_parameter_supported: true };
  const configHash = hash(JSON.stringify([issuerUrl, client.client_id, callbackUrl,
    ...(stepUp ? ['step-up', stepUp.expectedSubject, '2', stepUp.policy] : ['sign-in'])]));

  async function transaction<T>(work: (db: Client) => Promise<T>): Promise<T> {
    try {
      const db = await connect();
      try {
        await db.query('BEGIN');
        await db.query("SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='5s'");
        const result = await work(db); await db.query('COMMIT'); return result;
      } catch { await db.query('ROLLBACK'); return unavailable(); }
      finally { await db.end(); }
    } catch { return unavailable(); }
  }
  const cleanupRows = (db: Client) => db.query('DELETE FROM pilot.oidc_attempts WHERE expires_at<=clock_timestamp()');

  return {
    async start(): Promise<{ authorizationUrl: string; browserToken: string }> {
      try {
        const state = randomBytes(32).toString('hex'), nonce = randomBytes(32).toString('hex'), browserToken = randomBytes(32).toString('hex');
        const verifier = oauth.generateRandomCodeVerifier(), challenge = await oauth.calculatePKCECodeChallenge(verifier);
        await transaction(async db => {
          await db.query('SELECT pg_advisory_xact_lock(139,1)'); await cleanupRows(db);
          const inserted = await db.query(`INSERT INTO pilot.oidc_attempts(slot,state_hash,browser_hash,config_hash,nonce,verifier)
            SELECT slot,$1,$2,$3,$4,$5 FROM generate_series(1,256) AS slot
            WHERE NOT EXISTS (SELECT 1 FROM pilot.oidc_attempts a WHERE a.slot=slot.slot) ORDER BY slot LIMIT 1`,
          [hash(state), hash(browserToken), configHash, nonce, verifier]);
          if (inserted.rowCount !== 1) unavailable();
        });
        const url = new URL(metadata.authorization_endpoint!);
        url.search = new URLSearchParams({ client_id: client.client_id, redirect_uri: callbackUrl, response_type: 'code',
          scope: 'openid', state, nonce, code_challenge: challenge, code_challenge_method: 'S256' }).toString();
        if (stepUp) url.searchParams.set('claims', JSON.stringify({ id_token: { acr: { essential: true, values: ['2'] } } }));
        return { authorizationUrl: url.href, browserToken };
      } catch { return unavailable(); }
    },
    async complete(returnedUrl: string, browserToken: string): Promise<{ issuer: string; subject: string } | OidcStepUpEvidence> {
      const controller = new AbortController(); let deadline: NodeJS.Timeout | undefined;
      try {
        if (typeof returnedUrl !== 'string' || returnedUrl.length > 8192 || !binding(browserToken)) return unavailable();
        const url = new URL(returnedUrl);
        if (url.origin + url.pathname !== callbackUrl || url.username || url.password || url.hash) return unavailable();
        for (const name of url.searchParams.keys()) {
          if (!['state', 'code', 'iss', 'session_state', 'error', 'error_description', 'error_uri'].includes(name)
            || url.searchParams.getAll(name).length !== 1) return unavailable();
        }
        const state = url.searchParams.get('state'); if (!binding(state)) return unavailable();
        const attempt = await transaction(async db => {
          await cleanupRows(db);
          // Lock first; sample the database clock again after any lock wait before consuming.
          await db.query('SELECT slot FROM pilot.oidc_attempts WHERE state_hash=$1 AND browser_hash=$2 AND config_hash=$3 FOR UPDATE',
            [hash(state), hash(browserToken), configHash]);
          const claimed = await db.query(`DELETE FROM pilot.oidc_attempts WHERE state_hash=$1 AND browser_hash=$2 AND config_hash=$3
            AND created_at<=clock_timestamp() AND expires_at>clock_timestamp() RETURNING nonce,verifier,created_at,expires_at`, [hash(state), hash(browserToken), configHash]);
          return claimed.rows[0] as { nonce: string; verifier: string; created_at: Date; expires_at: Date } | undefined;
        });
        if (!attempt) return unavailable();
        const params = oauth.validateAuthResponse(metadata, client, url, state);
        const code = params.get('code');
        if (!code || code.length > 2048 || /[\u0000-\u0020\u007f]/.test(code)) return unavailable();
        deadline = setTimeout(() => controller.abort(), 5000);
        const transport: NonNullable<oauth.HttpRequestOptions<'GET' | 'POST', URLSearchParams | undefined>[typeof oauth.customFetch]> = async (input, init) => {
          const target = input.toString(), method = init?.method;
          if (!(target === metadata.token_endpoint && method === 'POST') && !(target === metadata.jwks_uri && method === 'GET')) return unavailable();
          const body = init?.body?.toString();
          return new Promise<Response>((resolve, reject) => {
            const headers = Object.fromEntries(new Headers(init?.headers).entries());
            headers['accept-encoding'] = 'identity';
            const req = request(target, { method, headers, ca, rejectUnauthorized: true, agent: false,
              signal: controller.signal, maxHeaderSize: 8192 }, res => {
              const fail = () => { res.destroy(); req.destroy(); reject(new Error('OIDC unavailable')); };
              res.on('error', fail); res.on('aborted', fail);
              if (res.statusCode !== 200 || !/^application\/json(?:\s*;|$)/i.test(res.headers['content-type'] ?? '')
                || (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity')
                || (res.headers['content-length'] !== undefined && (!/^\d+$/.test(res.headers['content-length']) || Number(res.headers['content-length']) > 65536))) { fail(); return; }
              const chunks: Buffer[] = []; let size = 0;
              res.on('data', (chunk: Buffer) => { size += chunk.length; if (size > 65536) { fail(); return; } chunks.push(chunk); });
              res.on('end', () => {
                try { const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
                  resolve(new Response(text, { status: 200, headers: { 'content-type': 'application/json' } })); }
                catch { fail(); }
              });
            });
            req.on('error', () => reject(new Error('OIDC unavailable'))); req.end(body);
          });
        };
        const options = { [oauth.customFetch]: transport, signal: controller.signal };
        const response = await oauth.authorizationCodeGrantRequest(metadata, client, auth, params, callbackUrl, attempt.verifier, options);
        const result = await oauth.processAuthorizationCodeResponse(metadata, client, response, { requireIdToken: true, expectedNonce: attempt.nonce });
        await oauth.validateApplicationLevelSignature(metadata, response, options);
        const claims = oauth.getValidatedIdTokenClaims(result)!;
        if (controller.signal.aborted || claims.iss !== issuerUrl || typeof claims.sub !== 'string' || !claims.sub.length
          || claims.sub.length > 255 || /[^\x21-\x7e]/.test(claims.sub)
          || (claims.azp !== undefined && claims.azp !== client.client_id)
          || !Number.isSafeInteger(claims.iat) || claims.iat! > Math.floor(Date.now() / 1000)
          || !Number.isSafeInteger(claims.exp) || claims.exp! <= Math.floor(Date.now() / 1000)) return unavailable();
        if (stepUp) {
          if (claims.sub !== stepUp.expectedSubject || claims.acr !== '2') return unavailable();
          const verifiedAt: Date = await transaction(async db => {
            const checked = await db.query(`SELECT clock_timestamp() AS now WHERE $1::timestamptz<=clock_timestamp()
              AND $2::timestamptz>clock_timestamp() AND $2::timestamptz<=$1::timestamptz+interval '5 minutes'`,
            [attempt.created_at, attempt.expires_at]);
            if (checked.rowCount !== 1) return unavailable();
            return checked.rows[0].now;
          });
          if (controller.signal.aborted) return unavailable();
          return { issuer: issuerUrl, clientId: client.client_id, subject: claims.sub, policy: stepUp.policy, acr: '2',
            factorTimeLowerBound: attempt.created_at, verifiedAt, validUntil: attempt.expires_at };
        }
        return { issuer: issuerUrl, subject: claims.sub };
      } catch { return unavailable(); }
      finally { if (deadline) clearTimeout(deadline); controller.abort(); }
    },
    // Expiry denies immediately; idle rows persist until this or the next operation runs.
    async cleanup(): Promise<void> { await transaction(async db => { await cleanupRows(db); }); }
  };
}
