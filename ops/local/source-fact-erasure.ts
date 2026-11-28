import { connectFixture, loadFixture } from './fixture.js';
import { readBoundHistory } from './restore-history.js';

// The independently issued database instruction pins the journal digest and the one permitted scope.
export async function applySourceFactErasure() {
  const fixture = await loadFixture();
  if (fixture.purpose !== 'backup' || fixture.restoreTarget || fixture.pairedRestore) {
    throw new Error('Disposable backup source required');
  }
  const db = await connectFixture(true);
  try {
    await db.query('BEGIN');
    await db.query('SELECT pg_advisory_xact_lock_shared(114,1)');
    const { rows: [permit] } = await db.query<{
      after: number; sequence: number; tenant_id: string; location_id: string; history_digest: string; applied: boolean;
    }>(`SELECT m.restore_history_after::int AS after, e.sequence::int, e.tenant_id, e.location_id,
      e.history_digest, e.applied_xid IS NOT NULL AS applied
      FROM public.fixture_identity m JOIN pilot.fixture_fact_erasure e ON e.fixture_id=m.id
      WHERE m.id=$1 AND m.purpose='backup' AND NOT m.restore_target AND m.disposable_backup
        AND current_database()='pilot_fixture' AND current_user='pilot_owner'
      FOR SHARE OF m FOR UPDATE OF e`, [fixture.id]);
    if (!permit) throw new Error('Source erasure instruction required');
    const events = await readBoundHistory(fixture.id, permit.after, permit.history_digest);
    const event = events[permit.sequence - permit.after - 1];
    if (event?.kind !== 'delete-facts' || event.tenantId !== permit.tenant_id || event.id !== permit.location_id) {
      throw new Error('Source erasure scope mismatch');
    }
    let removed = 0;
    if (!permit.applied) {
      const scope = [event.tenantId, event.id];
      const location = await db.query('SELECT 1 FROM pilot.locations WHERE tenant_id=$1 AND id=$2 FOR UPDATE', scope);
      if (location.rowCount !== 1) throw new Error('Source erasure location missing');
      await db.query('UPDATE pilot.fixture_fact_erasure SET applied_xid=pg_current_xact_id() WHERE fixture_id=$1', [fixture.id]);
      const deleted = await db.query('DELETE FROM pilot.business_fact_revisions WHERE tenant_id=$1 AND location_id=$2', scope);
      removed = deleted.rowCount!;
    }
    await db.query('COMMIT');
    return { sequence: permit.sequence, removed };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally { await db.end(); }
}
