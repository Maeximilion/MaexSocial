import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import type { Client } from 'pg';
import { eraseCustomer, pilotIssuer, verifyErasedCustomer, type CustomerErasure } from './customer-erasure.js';

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const historyPath = 'work/pilot/restore-history.json';
type Event =
  | CustomerErasure
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
  if (kind === 'delete-customer') {
    if (row.issuer !== pilotIssuer || tenantId !== undefined || typeof row.binding !== 'string'
        || !/^[a-f0-9]{64}$/.test(row.binding) || typeof version !== 'number' || !Number.isInteger(version)
        || version < 1 || version >= 2_147_483_647) return incompatible();
    return { kind, issuer: pilotIssuer, id, binding: row.binding, version };
  }
  if (kind !== 'revoke-device' && (typeof tenantId !== 'string' || !uuid.test(tenantId))) return incompatible();
  if (kind === 'delete-facts') return { kind, id, tenantId: tenantId as string };
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1 || version >= 2_147_483_647) {
    return incompatible();
  }
  if (kind === 'revoke-device') return { kind, id, version };
  if (kind === 'revoke-grant') return { kind, id, tenantId: tenantId as string, version };
  return incompatible();
}

async function readJournal(source: string, after: number) {
  const file = await open(historyPath, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
  let bytes: Buffer;
  try {
    const stat = await file.stat();
    const buffer = Buffer.alloc(65_537);
    if (!stat.isFile() || stat.size >= buffer.length) return incompatible();
    const { bytesRead } = await file.read(buffer);
    if (bytesRead !== stat.size) return incompatible();
    bytes = buffer.subarray(0, bytesRead);
  } finally { await file.close(); }
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  if (!value || typeof value !== 'object') return incompatible();
  const history = value as Record<string, unknown>;
  if (history.schema !== 1 || history.fixtureId !== source || history.after !== after || !Number.isSafeInteger(history.through) || Number(history.through) < after
      || !Array.isArray(history.records) || history.records.length !== Number(history.through) - after) return incompatible();
  const records = history.records;
  const events = records.map((row, i) => parseEvent(row, after + i + 1));
  const digest = createHash('sha256').update(bytes).digest('hex');
  const through = after + events.length;
  const ends = new Map<string, number>();
  function covers(issuedDigest: string, sequence: number) {
    if (sequence <= after || sequence > through) return false;
    if (issuedDigest === digest) return true;
    // The owner serializes each interval this way. Only append-only growth preserves its issued digest.
    if (!ends.size) {
      for (let n = 1; n < records.length; n++) {
        const prefix = JSON.stringify({ schema: 1, fixtureId: source, after, through: after + n, records: records.slice(0, n) });
        ends.set(createHash('sha256').update(prefix).digest('hex'), after + n);
      }
    }
    return (ends.get(issuedDigest) ?? after) >= sequence;
  }
  return { events, digest, covers };
}

export async function readBoundHistory(source: string, after: number, digest: string, issuedSequence?: number): Promise<Event[]> {
  const journal = await readJournal(source, after);
  if (issuedSequence === undefined ? journal.digest !== digest : !journal.covers(digest, issuedSequence)) return incompatible();
  return journal.events;
}

export async function replayRestoreHistory(db: Client, fixtureId: string, args: string[]) {
  const [mode, start, end, digest] = args;
  const after = Number(start), through = Number(end);
  if (args.length !== 4 || mode !== 'replay-history' || start !== String(after) || end !== String(through)
      || !Number.isSafeInteger(after) || !Number.isSafeInteger(through) || after < 0 || through < after
      || !digest || !/^[a-f0-9]{64}$/.test(digest)) return incompatible();

  // Imported targets have a source column, including legacy pairs whose source remains unbound.
  const { rows: [anchor] } = await db.query<{ source: string | null; restore_history_digest: string | null; disposable: boolean }>(
    `SELECT CASE WHEN to_jsonb(marker) ? 'restore_history_source_id'
      THEN to_jsonb(marker)->>'restore_history_source_id' ELSE id END AS source, restore_history_digest,
      (to_jsonb(marker)->>'restore_history_source_id' IS NOT NULL AND to_jsonb(marker)->>'purpose'='backup'
        AND to_jsonb(marker)->>'disposable_backup'='true') AS disposable
    FROM public.fixture_identity AS marker WHERE id=$1 AND restore_history_after=$2::bigint FOR SHARE`, [fixtureId, after]);
  if (!anchor?.source) return incompatible();

  const journal = await readJournal(anchor.source, after);
  const { events } = journal;
  if (journal.digest !== digest) return incompatible();
  if (events.length !== through - after || (events.some(event => event.kind === 'delete-customer') && !anchor.disposable)) return incompatible();

  // A continued pair carries the original owner instruction, even before the source has applied it.
  let appliedCustomerSequence: number | undefined;
  if ((await db.query("SELECT to_regclass('pilot.fixture_customer_erasure') IS NOT NULL AS present")).rows[0].present) {
    const permits = await db.query(`SELECT fixture_id, sequence, identity_id, identity_version, subject_binding,
      history_digest, applied_xid IS NOT NULL AS applied FROM pilot.fixture_customer_erasure`);
    for (const permit of permits.rows) {
      const sequence = Number(permit.sequence);
      const event = events[sequence - after - 1];
      if (!anchor.disposable || permit.fixture_id !== anchor.source || event?.kind !== 'delete-customer'
          || event.id !== permit.identity_id || event.version !== permit.identity_version
          || event.binding !== permit.subject_binding || !journal.covers(permit.history_digest, sequence)) return incompatible();
      if (permit.applied) appliedCustomerSequence = sequence;
    }
  }

  if (anchor.restore_history_digest !== null) {
    if (anchor.restore_history_digest !== digest) return incompatible();
    for (const event of events) {
      if (event.kind === 'delete-customer') await verifyErasedCustomer(db, event.id);
    }
    return { applied: 0 };
  }

  for (const [index, event] of events.entries()) {
    if (event.kind === 'delete-customer') {
      if (appliedCustomerSequence === after + index + 1) await verifyErasedCustomer(db, event.id);
      else await eraseCustomer(db, anchor.source, event, true);
    } else if (event.kind === 'delete-facts') {
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
