import { connectFixture, loadFixture, runIsolatedFixture } from './fixture.js';

async function main(): Promise<void> {
  if (process.argv.length !== 2) throw new Error('Unexpected restore target argument');
  const fixture = await loadFixture();
  if (fixture.restoreTarget !== true) throw new Error('Restore target manifest required');
  if (process.env.PILOT_CONTAINER !== '1') {
    const { topology, output } = runIsolatedFixture(fixture, ['dist/pilot/ops/local/recover.js']);
    console.log(JSON.stringify({ ...JSON.parse(output), topology }));
    return;
  }

  const db = await connectFixture(true);
  try {
    await db.query('BEGIN');
    // Serialize with fixture migrations before checking the isolated target and its schema.
    await db.query('SELECT pg_advisory_xact_lock(114, 1)');
    const target = await db.query(`SELECT 1 FROM public.fixture_identity
      WHERE id=$1 AND restore_target AND current_database()='pilot_fixture' AND current_user='pilot_owner'
        AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname='pilot_app' AND NOT rolcanlogin)
        AND NOT has_database_privilege('pilot_app', current_database(), 'CONNECT')
        AND NOT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND usename='pilot_app')
      FOR SHARE`, [fixture.id]);
    if (target.rowCount !== 1) throw new Error('Offline restore target required');
    const { rows: [dispatch] } = await db.query<{ stopped: boolean }>(
      'UPDATE pilot.dispatch_control SET stopped=true WHERE singleton RETURNING stopped');
    if (dispatch?.stopped !== true) throw new Error('Dispatch stop not established');
    // Preserve terminal export and other pre-quarantine outcomes even without a complete history.
    await db.query('ALTER TABLE pilot.occurrences ADD COLUMN IF NOT EXISTS restore_previous_state text');
    const quarantined = await db.query(`UPDATE pilot.occurrences
      SET restore_previous_state=COALESCE(restore_previous_state,state), state='quarantined'
      WHERE restore_previous_state IS NULL OR state<>'quarantined'`);
    await db.query('COMMIT');
    console.log(JSON.stringify({ quarantined: quarantined.rowCount, stopped: dispatch.stopped, applicationLogin: false }));
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    await db.end();
  }
}

main().catch(() => {
  console.error('Fixture restore quarantine refused or failed.');
  process.exitCode = 1;
});
