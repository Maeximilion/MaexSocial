import type { Client } from 'pg';
import { connectFixture, loadFixture, runIsolatedFixture } from './fixture.js';
import { replayRestoreHistory } from './restore-history.js';

async function onRestoreTarget<T>(db: Client, id: string, operation: () => Promise<T>): Promise<T> {
  await db.query('BEGIN');
  try {
    // Serialize with fixture migrations and other recovery operations before checking the target.
    await db.query('SELECT pg_advisory_xact_lock(114, 1)');
    const target = await db.query(`SELECT 1 FROM public.fixture_identity
      WHERE id=$1 AND restore_target AND current_database()='pilot_fixture' AND current_user='pilot_owner'
        AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname='pilot_app' AND NOT rolcanlogin)
        AND NOT has_database_privilege('pilot_app', current_database(), 'CONNECT')
        AND NOT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND usename='pilot_app')
      FOR SHARE`, [id]);
    if (target.rowCount !== 1) throw new Error('Offline restore target required');
    const result = await operation();
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length && args[0] !== 'replay-history') throw new Error('Unexpected restore target argument');
  const fixture = await loadFixture();
  if (fixture.restoreTarget !== true) throw new Error('Restore target manifest required');
  if (process.env.PILOT_CONTAINER !== '1') {
    const { topology, output } = runIsolatedFixture(fixture, ['dist/pilot/ops/local/recover.js', ...args]);
    console.log(JSON.stringify({ ...JSON.parse(output), topology }));
    return;
  }

  const db = await connectFixture(true);
  try {
    const result = await onRestoreTarget(db, fixture.id, async () => {
      const { rows: [dispatch] } = await db.query<{ stopped: boolean }>(
        'UPDATE pilot.dispatch_control SET stopped=true WHERE singleton RETURNING stopped');
      if (dispatch?.stopped !== true) throw new Error('Dispatch stop not established');
      // Preserve terminal export and other pre-quarantine outcomes even without a complete history.
      await db.query('ALTER TABLE pilot.occurrences ADD COLUMN IF NOT EXISTS restore_previous_state text');
      const quarantined = await db.query(`UPDATE pilot.occurrences
        SET restore_previous_state=COALESCE(restore_previous_state,state), state='quarantined'
        WHERE restore_previous_state IS NULL OR state<>'quarantined'`);
      await db.query('UPDATE pilot.sessions SET revoked_at=statement_timestamp() WHERE revoked_at IS NULL');
      return { quarantined: quarantined.rowCount, stopped: dispatch.stopped, applicationLogin: false };
    });

    if (!args.length) {
      console.log(JSON.stringify(result));
      return;
    }

    // A failed or interrupted replay must leave the independently committed quarantine in place.
    const history = await onRestoreTarget(db, fixture.id, async () => {
      const held = await db.query(`SELECT 1 FROM pilot.dispatch_control WHERE singleton AND stopped
        AND NOT EXISTS (SELECT 1 FROM pilot.occurrences WHERE state<>'quarantined' OR restore_previous_state IS NULL)
        FOR SHARE`);
      if (held.rowCount !== 1) throw new Error('Restore quarantine required');
      return replayRestoreHistory(db, fixture.id, args);
    });
    console.log(JSON.stringify({ ...result, history }));
  } finally {
    await db.end();
  }
}

main().catch(() => {
  console.error('Fixture restore quarantine refused or failed.');
  process.exitCode = 1;
});
