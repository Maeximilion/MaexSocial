import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import type { Client } from 'pg';

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const historyPath = 'work/pilot/restore-history.json';
type Event =
  | { kind: 'delete-facts'; tenantId: string; id: string }
  | { kind: 'revoke-grant'; tenantId: string; id: string; version: number }
  | { kind: 'revoke-device'; id: string; version: number };

function incompatible(): never {
  throw new Error('Missing, incomplete or incompatible restore history');
}

function parseEvent(value: unknown, seq: number): Event {
  if (!value || typeof value !== 'object') return incompatible();
  const row = value as Record<string, unknown>;
  const { kind, tenantId, id, version } = row;
  if (row.seq !== seq || typeof id !== 'string' || !uuid.test(id)) return incompatible();
  if (kind !== 'revoke-device' && (typeof tenantId !== 'string' || !uuid.test(tenantId))) return incompatible();
  if (kind === 'delete-facts') return { kind, id, tenantId: tenantId as string };
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1 || version >= 2_147_483_647) {
    return incompatible();
  }
  if (kind === 'revoke-device') return { kind, id, version };
  if (kind === 'revoke-grant') return { kind, id, tenantId: tenantId as string, version };
  return incompatible();
}

export async function replayRestoreHistory(db: Client, fixtureId: string, args: string[], paired: boolean) {
  const [mode, start, end, digest] = args;
  const after = Number(start), through = Number(end);
  if (args.length !== 4 || mode !== 'replay-history' || start !== String(after) || end !== String(through)
      || !Number.isSafeInteger(after) || !Number.isSafeInteger(through) || after < 0 || through < after
      || !digest || !/^[a-f0-9]{64}$/.test(digest)) return incompatible();

  const { rows: [anchor] } = await db.query<{ source: string | null; restore_history_digest: string | null }>(
    `SELECT ${paired ? 'restore_history_source_id' : 'id'} AS source, restore_history_digest
    FROM public.fixture_identity WHERE id=$1 AND restore_history_after=$2::bigint FOR SHARE`, [fixtureId, after]);
  if (!anchor?.source) return incompatible();

  const file = await open(historyPath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  let bytes: Buffer;
  try {
    const stat = await file.stat();
    const buffer = Buffer.alloc(65_537);
    if (!stat.isFile() || stat.size >= buffer.length) return incompatible();
    const { bytesRead } = await file.read(buffer);
    if (bytesRead !== stat.size || createHash('sha256').update(buffer.subarray(0, bytesRead)).digest('hex') !== digest) {
      return incompatible();
    }
    bytes = buffer.subarray(0, bytesRead);
  } finally { await file.close(); }
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (!value || typeof value !== 'object') return incompatible();
  const history = value as Record<string, unknown>;
  if (history.schema !== 1 || history.fixtureId !== anchor.source || history.after !== after || history.through !== through
      || !Array.isArray(history.records) || history.records.length !== through - after) return incompatible();
  const events = history.records.map((row, i) => parseEvent(row, after + i + 1));

  if (anchor.restore_history_digest !== null) {
    if (anchor.restore_history_digest !== digest) return incompatible();
    return { applied: 0 };
  }

  for (const event of events) {
    if (event.kind === 'delete-facts') {
      // Remove all revisions so recovery cannot expose an older fact as the latest.
      await db.query('ALTER TABLE pilot.business_fact_revisions DISABLE TRIGGER immutable_business_facts');
      await db.query('DELETE FROM pilot.business_fact_revisions WHERE tenant_id=$1 AND location_id=$2',
        [event.tenantId, event.id]);
      await db.query('ALTER TABLE pilot.business_fact_revisions ENABLE TRIGGER immutable_business_facts');
    } else if (event.kind === 'revoke-grant') {
      const revoked = await db.query(`UPDATE pilot.locations SET grant_active=false,version=version+1
        WHERE tenant_id=$1 AND id=$2 AND grant_active AND version=$3`, [event.tenantId, event.id, event.version]);
      if (revoked.rowCount !== 1) return incompatible();
    } else {
      const revoked = await db.query(`UPDATE pilot.devices SET active=false,version=version+1
        WHERE id=$1 AND active AND version=$2`, [event.id, event.version]);
      if (revoked.rowCount !== 1) return incompatible();
    }
  }

  await db.query('UPDATE public.fixture_identity SET restore_history_digest=$2 WHERE id=$1', [fixtureId, digest]);
  return { applied: events.length };
}
