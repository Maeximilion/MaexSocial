import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import type { Client } from 'pg';

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const historyPath = 'work/pilot/restore-history.json';
type Event =
  | { kind: 'delete-facts'; tenantId: string; id: string }
  | { kind: 'erase-draft'; tenantId: string; id: string; authorizedAt: string }
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
  if (kind === 'erase-draft') {
    const at = row.authorizedAt;
    if (typeof at !== 'string' || !Number.isFinite(Date.parse(at)) || new Date(at).toISOString() !== at) return incompatible();
    return { kind, id, tenantId: tenantId as string, authorizedAt: at };
  }
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1 || version >= 2_147_483_647) {
    return incompatible();
  }
  if (kind === 'revoke-device') return { kind, id, version };
  if (kind === 'revoke-grant') return { kind, id, tenantId: tenantId as string, version };
  return incompatible();
}

export async function readBoundHistory(source: string, after: number, digest: string): Promise<Event[]> {
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
  if (history.schema !== 1 || history.fixtureId !== source || history.after !== after || !Number.isSafeInteger(history.through) || Number(history.through) < after
      || !Array.isArray(history.records) || history.records.length !== Number(history.through) - after) return incompatible();
  return history.records.map((row, i) => parseEvent(row, after + i + 1));
}

// Caller owns the transaction. Claim, download, edit and approval use this same draft lock.
export async function eraseBoundDraft(db: Client, source: string, sequence: number,
  event: Extract<Event, { kind: 'erase-draft' }>, digest: string) {
  const scope = [event.tenantId, event.id];
  const draft = await db.query('SELECT id FROM pilot.drafts WHERE tenant_id=$1 AND id=$2 FOR UPDATE', scope);
  if (draft.rowCount !== 1) return incompatible();
  const binding = [source, sequence, ...scope, event.authorizedAt, digest];
  const permit = await db.query(`SELECT applied_xid IS NOT NULL AS applied FROM pilot.fixture_draft_erasure
    WHERE source_id=$1 AND sequence=$2 AND tenant_id=$3 AND draft_id=$4 AND authorized_at=$5 AND history_digest=$6
    FOR UPDATE`, binding);
  if (!permit.rowCount) return incompatible();
  if (permit.rows[0].applied) return 0;
  await db.query('UPDATE pilot.fixture_draft_erasure SET applied_xid=pg_current_xact_id() WHERE source_id=$1 AND sequence=$2',
    [source, sequence]);
  const result = await db.query('UPDATE pilot.draft_revisions SET text=NULL WHERE tenant_id=$1 AND draft_id=$2 AND text IS NOT NULL', scope);
  if (!result.rowCount) return incompatible();
  await db.query(`UPDATE pilot.approvals SET mfa_at=NULL,created_at=NULL,grant_version=NULL,grant_active_at_approval=NULL
    WHERE tenant_id=$1 AND draft_id=$2 AND mfa_at IS NOT NULL`, scope);
  return result.rowCount;
}

export async function replayRestoreHistory(db: Client, fixtureId: string, args: string[]) {
  const [mode, start, end, digest] = args;
  const after = Number(start), through = Number(end);
  if (args.length !== 4 || mode !== 'replay-history' || start !== String(after) || end !== String(through)
      || !Number.isSafeInteger(after) || !Number.isSafeInteger(through) || after < 0 || through < after
      || !digest || !/^[a-f0-9]{64}$/.test(digest)) return incompatible();

  // Imported targets have a source column, including legacy pairs whose source remains unbound.
  const { rows: [anchor] } = await db.query<{ source: string | null; restore_history_digest: string | null }>(
    `SELECT CASE WHEN to_jsonb(marker) ? 'restore_history_source_id'
      THEN to_jsonb(marker)->>'restore_history_source_id' ELSE id END AS source, restore_history_digest
    FROM public.fixture_identity AS marker WHERE id=$1 AND restore_history_after=$2::bigint FOR SHARE`, [fixtureId, after]);
  if (!anchor?.source) return incompatible();

  const events = await readBoundHistory(anchor.source, after, digest);
  if (events.length !== through - after) return incompatible();

  if (anchor.restore_history_digest !== null) {
    if (anchor.restore_history_digest !== digest) return incompatible();
    return { applied: 0 };
  }

  for (const [index, event] of events.entries()) {
    if (event.kind === 'delete-facts') {
      // Remove all revisions so recovery cannot expose an older fact as the latest.
      await db.query('ALTER TABLE pilot.business_fact_revisions DISABLE TRIGGER immutable_business_facts');
      await db.query('DELETE FROM pilot.business_fact_revisions WHERE tenant_id=$1 AND location_id=$2',
        [event.tenantId, event.id]);
      await db.query('ALTER TABLE pilot.business_fact_revisions ENABLE TRIGGER immutable_business_facts');
    } else if (event.kind === 'erase-draft') {
      const { rows: [target] } = await db.query(`SELECT EXISTS (
          SELECT 1 FROM pilot.drafts WHERE tenant_id=$1 AND id=$2) AS present
        FROM public.fixture_identity m WHERE m.id=$3 AND m.restore_target
          AND to_jsonb(m)->>'disposable_backup'='true' AND to_jsonb(m)->>'restore_history_source_id'=$4
          AND $5::timestamptz<=clock_timestamp()`, [event.tenantId, event.id, fixtureId, anchor.source, event.authorizedAt]);
      if (!target) return incompatible();
      // The independent history can include a draft first created after this snapshot.
      if (!target.present) continue;
      const seq = after + index + 1;
      await db.query(`INSERT INTO pilot.fixture_draft_erasure(source_id,sequence,tenant_id,draft_id,authorized_at,history_digest)
        VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`, [anchor.source, seq, event.tenantId, event.id, event.authorizedAt, digest]);
      await eraseBoundDraft(db, anchor.source, seq, event, digest);
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
