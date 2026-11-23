import type { Client } from 'pg';
import { installedPilotSchema } from '../../scripts/pilot-db.js';
import { connectFixture, loadFixture, requireOrdinaryFixtureDatabase, runIsolatedFixture, usesLocalDocker } from './fixture.js';
import { httpsReady } from './stack.js';

async function status(db: Client) {
  const { rows: [control] } = await db.query<{ stopped: boolean; outstandingAttempts: number }>(`
    SELECT stopped, (SELECT count(*)::int FROM pilot.attempts WHERE outcome IN ('unknown', 'pending'))
      AS "outstandingAttempts"
    FROM pilot.dispatch_control WHERE singleton
  `);
  if (!control) throw new Error('Missing dispatch control');
  return control;
}

async function reopen(db: Client, id: string) {
  if (!(await Promise.all([httpsReady('keycloak', false), httpsReady('mailbox', false)])).every(Boolean)) {
    throw new Error('Fixture HTTPS readiness failed');
  }
  const app = await connectFixture();
  await app.end();

  await db.query('BEGIN');
  try {
    // Use the migration lock while checking the schema that claims depend on.
    await db.query('SELECT pg_advisory_xact_lock(114, 1)');
    await requireOrdinaryFixtureDatabase(db, id);
    if (!Object.values(await installedPilotSchema(db)).every(Boolean)) {
      throw new Error('Current pilot schema required');
    }

    // Stop, reopen and claims serialize on the same control row.
    await db.query('UPDATE pilot.dispatch_control SET stopped=false WHERE singleton');
    const result = await status(db);
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

async function main(): Promise<void> {
  const action = process.argv[2];
  if ((action !== 'stop' && action !== 'status' && action !== 'reopen') || process.argv.length !== 3) {
    throw new Error('Expected stop, status or reopen');
  }
  const fixture = await loadFixture();
  if (action === 'reopen' && (fixture.purpose !== 'ordinary' || fixture.restoreTarget || fixture.pairedRestore)) {
    console.error('Dispatch reopen requires an ordinary fixture manifest.');
    process.exitCode = 1;
    return;
  }
  if (process.env.PILOT_CONTAINER !== '1') {
    if (action === 'reopen' && !usesLocalDocker()) throw new Error('Reopen requires a local Docker socket');
    const { output } = runIsolatedFixture(fixture, ['dist/pilot/ops/local/dispatch-control.js', action], action === 'reopen');
    console.log(output);
    return;
  }

  const db = await connectFixture(true);
  try {
    if (action === 'reopen') {
      console.log(JSON.stringify(await reopen(db, fixture.id)));
      return;
    }
    if (action === 'stop') {
      // Dispatch claims lock this row before recording an attempt.
      const result = await db.query('UPDATE pilot.dispatch_control SET stopped = true WHERE singleton');
      if (result.rowCount !== 1) throw new Error('Missing dispatch control');
    }
    // A fresh snapshot includes attempts committed by a claim that held the stop row first.
    console.log(JSON.stringify(await status(db)));
  } finally { await db.end(); }
}

main().catch(() => {
  console.error('Fixture dispatch command refused or failed.');
  process.exitCode = 1;
});
