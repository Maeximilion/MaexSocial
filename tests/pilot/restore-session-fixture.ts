import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import type { Client } from 'pg';
import { tokenHash } from '../../apps/web/src/server/session.js';
import { seedManagementSession, seedTenant } from './fixtures.js';

export async function seedRestoreSessions(db: Client, tenant: Awaited<ReturnType<typeof seedTenant>>) {
  const { rows: [clock] } = await db.query<{ now: Date }>('SELECT clock_timestamp() AS now');
  const now = clock!.now;
  const prior = new Date(now.getTime() - 60_000);
  await db.query('UPDATE pilot.identities SET verified=true WHERE id=$1', [tenant.user]);
  for (const revokedAt of [null, prior]) {
    const { sessionId } = await seedManagementSession(db, now, prior);
    if (revokedAt) await db.query('UPDATE pilot.sessions SET revoked_at=$2 WHERE id=$1', [sessionId, revokedAt]);
    await db.query(`INSERT INTO pilot.sessions
      (audience,token_hash,csrf_hash,identity_id,identity_version,tenant_id,tenant_version,
       membership_id,membership_version,created_at,last_seen_at,expires_at,revoked_at)
      VALUES ('customer',$1,$2,$3,1,$4,1,$5,$6::timestamptz-interval '6 minutes',$6,$6::timestamptz+interval '10 minutes',$7)`,
    [tokenHash(randomBytes(32).toString('hex')), tokenHash(randomBytes(32).toString('hex')),
      tenant.user, tenant.tenant, tenant.membership, now, revokedAt]);
  }
}

export async function readRestoreSessions(db: Client) {
  return (await db.query<{ audience: string; bindings: string; revocations: (string | null)[] }>(`SELECT audience,
    encode(sha256(convert_to(jsonb_agg(to_jsonb(s)-'revoked_at' ORDER BY id)::text,'UTF8')),'hex') AS bindings,
    array_agg(revoked_at::text ORDER BY id) AS revocations
    FROM pilot.sessions s GROUP BY audience ORDER BY audience`)).rows;
}

type Sessions = Awaited<ReturnType<typeof readRestoreSessions>>;

export function assertRestoredSessions(before: Sessions, after: Sessions) {
  assert.deepEqual(before.map(row => row.audience), ['customer', 'management']);
  assert.deepEqual(after.map(row => row.audience), ['customer', 'management']);
  for (const [index, row] of before.entries()) {
    assert.equal(row.revocations.length, 2);
    assert.equal(row.revocations.filter(value => value === null).length, 1);
    assert.equal(after[index]!.bindings, row.bindings);
    assert.equal(after[index]!.revocations.length, 2);
    for (const [slot, prior] of row.revocations.entries()) {
      const restored = after[index]!.revocations[slot]!;
      if (prior === null) assert.ok(restored !== null && Date.parse(restored) > Date.parse(row.revocations.find(v => v !== null)!));
      else assert.equal(restored, prior);
    }
  }
}

export const denySessionRevocation = `ALTER TABLE pilot.sessions ADD CONSTRAINT fixture_revocation_fault
  CHECK (revoked_at IS NULL) NOT VALID`;
