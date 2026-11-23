import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { GbpAttempt, GbpCreateIntent, GbpObservation, GbpProviderState, GbpReadback } from '../../../packages/contracts/pilot.js';

type Frame = { afterMs: number; candidates: readonly GbpProviderState[] };

interface Scenario {
  clock?: () => number;
  frames?: readonly Frame[];
  loseReply?: boolean;
}

export const providerStateDirectory = 'work/pilot/provider-state';

export class FakeGbp implements GbpReadback {
  readonly policy = 'synthetic-organic-text';
  private readonly db: DatabaseSync;
  private readonly clock: () => number;
  private readonly framesJson: string;
  private readonly loseReply: boolean;

  constructor(directory = providerStateDirectory, scenario: Scenario = {}) {
    const frames = scenario.frames ?? [{ afterMs: 0, candidates: ['PROCESSING'] }];
    if (frames[0]?.afterMs !== 0 || frames.some((frame, index) =>
      !Number.isSafeInteger(frame.afterMs) || (index > 0 && frame.afterMs <= frames[index - 1]!.afterMs))) {
      throw new Error('Fake frames must start at zero and increase in milliseconds');
    }
    this.clock = scenario.clock ?? Date.now;
    this.framesJson = JSON.stringify(frames);
    this.loseReply = scenario.loseReply ?? false;
    this.db = new DatabaseSync(join(directory, 'fake-gbp.sqlite'), { timeout: 5000 });
    this.db.exec(`CREATE TABLE IF NOT EXISTS calls (
      id INTEGER PRIMARY KEY, tenant TEXT NOT NULL, occurrence TEXT NOT NULL,
      attempt TEXT NOT NULL, location TEXT NOT NULL, accepted_at INTEGER NOT NULL, frames TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS call_intents (
      call_id INTEGER PRIMARY KEY REFERENCES calls(id), intent TEXT NOT NULL
    ) STRICT`);
  }

  async create(intent: GbpAttempt | GbpCreateIntent) {
    const { tenantId, occurrenceId, attemptId, location } = intent;
    if (![tenantId, occurrenceId, attemptId, location].every(id => typeof id === 'string' && id.trim())) {
      throw new Error('Fake create requires tenant, occurrence, attempt and location identifiers');
    }
    this.db.exec('BEGIN IMMEDIATE');
    let callId: number | bigint;
    try {
      const { lastInsertRowid } = this.db.prepare(`INSERT INTO calls
        (tenant, occurrence, attempt, location, accepted_at, frames) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(tenantId, occurrenceId, attemptId, location, this.clock(), this.framesJson);
      callId = lastInsertRowid;
      if ('text' in intent) {
        this.db.prepare('INSERT INTO call_intents VALUES (?, ?)').run(callId, JSON.stringify(intent));
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    // Each insert commits independently, including an acceptance whose reply is lost.
    if (this.loseReply) throw new Error('Fake GBP reply lost after acceptance');
    return { attemptId, location, resourceName: resourceName(location, callId, 0) };
  }

  createCount(tenantId: string, occurrenceId: string): number {
    const row = this.db.prepare('SELECT count(*) AS total FROM calls WHERE tenant = ? AND occurrence = ?')
      .get(tenantId, occurrenceId)!;
    return Number(row.total);
  }

  async readback(attempt: GbpAttempt & { resourceName?: string }): Promise<GbpObservation> {
    const { tenantId, occurrenceId, attemptId, location } = attempt;
    const observedAt = this.clock();
    const rows = this.db.prepare(`SELECT id, accepted_at, frames FROM calls
      WHERE tenant = ? AND occurrence = ? AND attempt = ? AND location = ? AND accepted_at <= ? ORDER BY id`)
      .all(tenantId, occurrenceId, attemptId, location, observedAt);
    const candidates = rows.flatMap(row => {
      const frames: Frame[] = JSON.parse(String(row.frames));
      const frame = frames.findLast(f => f.afterMs <= observedAt - Number(row.accepted_at))!;
      return frame.candidates.map((state, index) => ({
        resourceName: resourceName(location, Number(row.id), index), state,
      }));
    }).filter(candidate => attempt.resourceName === undefined || candidate.resourceName === attempt.resourceName);
    return { location, observedAt, candidates,
      correlation: candidates.length === 0 ? 'missing' : candidates.length === 1 ? 'unique' : 'ambiguous' };
  }

  close(): void {
    this.db.close();
  }
}

function resourceName(location: string, call: number | bigint, index: number): string {
  return `${location}/localPosts/fake-${call}-${index}`;
}
