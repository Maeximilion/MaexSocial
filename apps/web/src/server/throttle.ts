import type { Client } from 'pg';
import { tokenHash } from './session.js';

export type PublicFlow = 'login' | 'signup' | 'recovery' | 'resend';

// Caller commits this transaction even when denied; absent identities use the same path.
export async function allowAttempt(db: Client, flow: PublicFlow, account: string, source: string, now: Date): Promise<boolean> {
  if (!Number.isFinite(now.getTime()) || !account || !source || account.length > 254 || source.length > 200) throw new Error('Denied');
  const duration = flow === 'login' ? 900_000 : 3_600_000;
  const limits = flow === 'login' ? [5, 30] : [3, 10];
  let allowed = true;
  for (const [index, bucket] of ['account', 'source'].entries()) {
    const key = tokenHash(index === 0 ? account.trim().toLowerCase() : source);
    await db.query('INSERT INTO pilot.rate_windows(flow,bucket,key_hash,attempts) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING', [flow, bucket, key, []]);
    const saved: Date[] = (await db.query('SELECT attempts FROM pilot.rate_windows WHERE flow=$1 AND bucket=$2 AND key_hash=$3 FOR UPDATE', [flow, bucket, key])).rows[0].attempts;
    if (saved.some(time => time > now)) throw new Error('Denied');
    const current = saved.filter(time => time.getTime() > now.getTime() - duration);
    if (current.length >= limits[index]!) allowed = false;
    await db.query('UPDATE pilot.rate_windows SET attempts=$1 WHERE flow=$2 AND bucket=$3 AND key_hash=$4', [[...current, now].slice(-31), flow, bucket, key]);
  }
  return allowed;
}
