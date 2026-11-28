import { eraseCustomer } from './customer-erasure.js';
import { connectFixture, loadFixture } from './fixture.js';
import { readBoundHistory } from './restore-history.js';

export async function applySourceCustomerErasure() {
  const fixture = await loadFixture();
  if (fixture.purpose !== 'backup' || fixture.restoreTarget || fixture.pairedRestore) {
    throw new Error('Disposable backup source required');
  }
  const db = await connectFixture(true);
  try {
    await db.query('BEGIN');
    await db.query('SELECT pg_advisory_xact_lock_shared(114,1)');
    const { rows: [permit] } = await db.query(`SELECT m.restore_history_after::int AS after,e.sequence::int,
      e.identity_id,e.subject_binding,e.identity_version,e.history_digest,e.applied_xid IS NOT NULL AS applied
      FROM public.fixture_identity m JOIN pilot.fixture_customer_erasure e ON e.fixture_id=m.id
      WHERE m.id=$1 AND m.purpose='backup' AND NOT m.restore_target AND m.disposable_backup
        AND current_database()='pilot_fixture' AND current_user='pilot_owner' AND e.authorized_at<=clock_timestamp()
      FOR SHARE OF m FOR UPDATE OF e`, [fixture.id]);
    if (!permit) throw new Error('Customer erasure instruction required');
    const events = await readBoundHistory(fixture.id, permit.after, permit.history_digest);
    const event = events[permit.sequence - permit.after - 1];
    if (event?.kind !== 'delete-customer' || event.id !== permit.identity_id
        || event.binding !== permit.subject_binding || event.version !== permit.identity_version) {
      throw new Error('Customer erasure scope mismatch');
    }
    const removed = permit.applied ? null : await eraseCustomer(db, fixture.id, event, false);
    if (removed) await db.query('UPDATE pilot.fixture_customer_erasure SET applied_xid=pg_current_xact_id() WHERE fixture_id=$1', [fixture.id]);
    await db.query('COMMIT');
    return removed;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally { await db.end(); }
}
