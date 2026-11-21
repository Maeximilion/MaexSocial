import { appendFileSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// The fake records every call independently, including duplicates, then loses its reply.
function submitToFake(directory: string, job: string): never {
  appendFileSync(join(directory, 'fake-acceptances.jsonl'), JSON.stringify({ job }) + '\n', { flush: true });
  throw new Error('Fictional reply lost after acceptance');
}

function run(directory: string, command: string, job = '') {
  const database = join(directory, 'runner.sqlite');
  const readOnly = command === 'reconcile';
  if (readOnly && !lstatSync(database, { throwIfNoEntry: false })) return { stopped: false, attempt: null };
  const db = new DatabaseSync(database, { readOnly, timeout: 5000 });
  try {
    if (!readOnly) {
      db.exec(`CREATE TABLE IF NOT EXISTS attempts (job TEXT PRIMARY KEY);
               CREATE TABLE IF NOT EXISTS stop (id INTEGER PRIMARY KEY CHECK (id = 1));`);
    }
    if (command === 'stop') {
      db.exec('INSERT OR IGNORE INTO stop VALUES (1)');
      return { stopped: true };
    }
    if (command === 'submit') {
      // Commit the reservation before touching the fake. Reopening can never reclaim it.
      const claim = db.prepare(`INSERT INTO attempts (job)
        SELECT ? WHERE NOT EXISTS (SELECT 1 FROM stop) ON CONFLICT (job) DO NOTHING`).run(job);
      if (claim.changes === 1) {
        // Serialize the final stop check and dispatch with stop writers.
        db.exec('BEGIN IMMEDIATE');
        if (!db.prepare('SELECT 1 FROM stop').get()) submitToFake(directory, job);
        // Stop won the race before dispatch. Only the claimant reaches this branch.
        db.prepare('DELETE FROM attempts WHERE job = ?').run(job);
        db.exec('COMMIT');
      }
    }
    const state = db.prepare(`SELECT EXISTS (SELECT 1 FROM stop) AS stopped,
      EXISTS (SELECT 1 FROM attempts WHERE job = ?) AS reserved`).get(job)!;
    return {
      stopped: Boolean(state.stopped),
      attempt: state.reserved ? { job, outcome: 'unknown', charge: 'unknown', reservation: 'held' } : null,
    };
  } finally {
    db.close();
  }
}

const [directory, command, job, ...extra] = process.argv.slice(2);
if (!directory || !command || extra.length || !(command === 'stop' ? job === undefined :
    (command === 'submit' || command === 'reconcile') && job?.match(/^fictional-[a-z0-9-]{1,48}$/))) {
  throw new Error('Usage: video-replay <fixture-directory> <stop | submit fictional-ID | reconcile fictional-ID>');
}
console.log(JSON.stringify(run(directory, command, job)));
