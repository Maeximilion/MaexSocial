import assert from 'node:assert/strict';
import { test } from 'node:test';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';
import { migrate } from '../../scripts/pilot-db.js';
import { withProbeView } from './fixtures.js';

test('down refuses an unknown populated materialized view and rolls back all teardown', async () => {
  if (process.env.PILOT_CONTAINER !== '1') {
    console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/migration-empty.js'])); return;
  }
  const db = await connectFixture(true);
  try {
    assert.equal((await db.query('SELECT count(*)::int AS count FROM pilot.tenants')).rows[0].count, 0, 'run before seeding');
    await withProbeView(db, async () => {
      await assert.rejects(migrate('down'), { code: '2BP01' });
      assert.equal((await db.query('SELECT value FROM pilot.saved')).rows[0].value, 'retained synthetic fixture');
      assert.equal((await db.query("SELECT to_regclass('pilot.occurrences') AS name")).rows[0].name, 'pilot.occurrences');
    });
  } finally { await db.end(); }
});
