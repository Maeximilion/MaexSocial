import { connectFixture, loadFixture, runIsolatedFixture } from './fixture.js';
import { eraseBoundDraft, readBoundHistory } from './restore-history.js';

export async function applySourceDraftErasure(sequence: number) {
  const f = await loadFixture();
  if (f.purpose !== 'backup' || f.restoreTarget || f.pairedRestore || !Number.isSafeInteger(sequence) || sequence <= 0) {
    throw new Error('Disposable source and positive instruction sequence required');
  }
  const db = await connectFixture(true);
  try {
    await db.query('BEGIN');
    await db.query('SELECT pg_advisory_xact_lock_shared(114,1)');
    const { rows: [permit] } = await db.query(`SELECT m.restore_history_after::int AS after,e.history_digest
      FROM public.fixture_identity m JOIN pilot.fixture_draft_erasure e ON e.source_id=m.id
      WHERE m.id=$1 AND e.sequence=$2 AND m.purpose='backup' AND m.disposable_backup AND NOT m.restore_target
        AND current_user='pilot_owner' AND current_database()='pilot_fixture' FOR SHARE OF m`, [f.id, sequence]);
    if (!permit) throw new Error('Source draft erasure instruction required');
    const history = await readBoundHistory(f.id, permit.after, permit.history_digest);
    const event = history[sequence - permit.after - 1];
    if (event?.kind !== 'erase-draft') throw new Error('Source draft erasure instruction mismatch');
    const removed = await eraseBoundDraft(db, f.id, sequence, event, permit.history_digest);
    await db.query('COMMIT');
    // On the issuing database's clock this observation bounds actual completion, including the commit.
    const { rows: [observation] } = await db.query('SELECT clock_timestamp() AS confirmed');
    return { sequence, removed, authorizedAt: event.authorizedAt, confirmedBy: observation.confirmed.toISOString() as string };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally { await db.end(); }
}

async function main() {
  const [arg, ...extra] = process.argv.slice(2);
  if (!arg || !/^[1-9][0-9]*$/.test(arg) || extra.length) throw new Error('Expected one instruction sequence');
  if (process.env.PILOT_CONTAINER !== '1') {
    console.log(runIsolatedFixture(await loadFixture(), ['dist/pilot/ops/local/source-draft-erasure.js', arg]).output);
  } else {
    console.log(JSON.stringify(await applySourceDraftErasure(Number(arg))));
  }
}
if (require.main === module) main().catch(() => {
  console.error('Fixture draft erasure refused or failed.');
  process.exitCode = 1;
});
