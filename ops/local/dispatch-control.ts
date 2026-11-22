import { connectFixture, runIsolated } from './fixture.js';

async function main(): Promise<void> {
  const action = process.argv[2];
  if ((action !== 'stop' && action !== 'status') || process.argv.length !== 3) {
    throw new Error('Expected stop or status');
  }
  if (process.env.PILOT_CONTAINER !== '1') {
    console.log(await runIsolated(['dist/pilot/ops/local/dispatch-control.js', action]));
    return;
  }

  const db = await connectFixture(true);
  try {
    if (action === 'stop') {
      // Future dispatch claims must lock this row before recording an attempt.
      const result = await db.query('UPDATE pilot.dispatch_control SET stopped = true WHERE singleton');
      if (result.rowCount !== 1) throw new Error('Missing dispatch control');
    }
    // A fresh snapshot includes attempts committed by a claim that held the stop row first.
    const { rows } = await db.query<{ stopped: boolean; outstandingAttempts: number }>(`
      SELECT stopped, (SELECT count(*)::int FROM pilot.attempts WHERE outcome IN ('unknown', 'pending'))
        AS "outstandingAttempts"
      FROM pilot.dispatch_control WHERE singleton
    `);
    if (!rows[0]) throw new Error('Missing dispatch control');
    console.log(JSON.stringify(rows[0]));
  } finally { await db.end(); }
}

main().catch(() => {
  console.error('Fixture dispatch command refused or failed.');
  process.exitCode = 1;
});
