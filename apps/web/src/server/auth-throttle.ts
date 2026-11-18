import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import type { Client } from 'pg';

type Flow = 'login' | 'signup' | 'recovery' | 'resend';
const unavailable = (): never => { throw new Error('Throttle unavailable'); };

function accountKey(value: string): string {
  if (typeof value !== 'string' || value.length > 320 || /[^\x00-\x7f]/.test(value)) return unavailable();
  const normalized = value.replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '').toLowerCase();
  const parts = normalized.split('@'), local = parts[0]!, domain = parts[1];
  if (normalized.length > 254 || parts.length !== 2 || !domain || local.length > 64
    || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)
    || local.startsWith('.') || local.endsWith('.') || local.includes('..')
    || domain.split('.').some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return unavailable();
  return normalized;
}

function sourceKey(value: string): string {
  if (typeof value !== 'string' || value.length > 45 || value.includes('%')) return unavailable();
  const version = isIP(value);
  if (version === 4) return value;
  if (version !== 6) return unavailable();
  const normalized = new URL(`http://[${value}]/`).hostname.slice(1, -1);
  const mapped = /^::ffff:([a-f0-9]+):([a-f0-9]+)$/.exec(normalized);
  if (!mapped) return normalized;
  const high = parseInt(mapped[1]!, 16), low = parseInt(mapped[2]!, 16);
  return [high >>> 8, high & 255, low >>> 8, low & 255].join('.');
}

// Private composition only: connect opens a NEW client; source is the trusted transport peer, never a header.
export function createAuthThrottle(key: string, connect: () => Promise<Client>, flow: Flow) {
  if (typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key)
    || !['login', 'signup', 'recovery', 'resend'].includes(flow)) return unavailable();
  const secret = Buffer.from(key, 'hex');
  const digest = (...parts: string[]) => createHmac('sha256', secret).update(JSON.stringify(['auth-throttle-v1', ...parts])).digest('hex');
  const keyHash = digest('key-binding');

  async function transaction<T>(work: (db: Client, now: string) => Promise<T>): Promise<T> {
    try {
      const db = await connect();
      try {
        await db.query('BEGIN');
        await db.query("SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='5s'");
        // shortcut: one global lock bounds the local pilot; measure contention before public integration.
        await db.query('SELECT pg_advisory_xact_lock(154,1)');
        await db.query('INSERT INTO pilot.auth_throttle_key(singleton,key_hash) VALUES(true,$1) ON CONFLICT DO NOTHING', [keyHash]);
        if ((await db.query('SELECT key_hash FROM pilot.auth_throttle_key WHERE singleton')).rows[0]?.key_hash !== keyHash) unavailable();
        const now: string = (await db.query('SELECT clock_timestamp()::text AS now')).rows[0].now;
        await db.query('DELETE FROM pilot.auth_throttle_buckets WHERE expires_at<=$1::timestamptz', [now]);
        const result = await work(db, now);
        await db.query('COMMIT');
        return result;
      } catch { await db.query('ROLLBACK'); return unavailable(); }
      finally { await db.end(); }
    } catch { return unavailable(); }
  }

  return {
    async consume(account: string, trustedSourceIp: string): Promise<boolean> {
      try {
        const keys = [digest(flow, 'account', accountKey(account)), digest(flow, 'source', sourceKey(trustedSourceIp))];
        return await transaction(async (db, now) => {
          const accountResult = await db.query('SELECT pilot.charge_auth_throttle($1,$2,$3,$4::timestamptz) AS allowed',
            [flow, 'account', keys[0], now]);
          const sourceResult = await db.query('SELECT pilot.charge_auth_throttle($1,$2,$3,$4::timestamptz) AS allowed',
            [flow, 'source', keys[1], now]);
          if ((await db.query('SELECT count(*)::int AS n FROM pilot.auth_throttle_buckets')).rows[0].n > 4096) unavailable();
          return accountResult.rows[0].allowed === true && sourceResult.rows[0].allowed === true;
        });
      } catch { return unavailable(); }
    },
    // No timer: inactive rows remain until this or consumption runs. Key binding deliberately survives.
    async cleanup(): Promise<void> { await transaction(async () => {}); }
  };
}
