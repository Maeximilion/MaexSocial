import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';
import { migrate } from '../../scripts/pilot-db.js';
import { occurrence, seedTenant, withProbeView } from './fixtures.js';

test('migration guards preserve populated state and upgrade a historical approval without backfilling authority', async () => {
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
      assert.equal((await db.query("SELECT to_regclass('pilot.business_fact_revisions') AS name")).rows[0].name, 'pilot.business_fact_revisions');
    });
    await db.query(await readFile('db/migrations/011_approval_tenant_version.down.sql', 'utf8'));
    const tenant = await seedTenant(db);
    const id = await occurrence(db, tenant);
    const { rows: [prior] } = await db.query(`WITH historical AS (
      INSERT INTO pilot.approvals(tenant_id,occurrence_id,draft_id,revision_id,location_id,membership_id,
        membership_version,grant_version,due_at,timezone,mfa_at)
      SELECT tenant_id,id,draft_id,$2,location_id,$3,1,1,due_at,timezone,now()
      FROM pilot.occurrences WHERE id=$1 RETURNING id
    ) UPDATE pilot.occurrences SET approval_id=historical.id,state='approved' FROM historical
      WHERE pilot.occurrences.id=$1 RETURNING approval_id,state`, [id, tenant.revision, tenant.membership]);
    await migrate('up');
    const read = `SELECT o.approval_id,o.state,a.tenant_version FROM pilot.occurrences o
      JOIN pilot.approvals a ON a.tenant_id=o.tenant_id AND a.occurrence_id=o.id AND a.id=o.approval_id
      WHERE o.id=$1`;
    const expected = [{ ...prior, tenant_version: null }];
    assert.deepEqual((await db.query(read, [id])).rows, expected);
    await assert.rejects(migrate('down'), /Populated fixture/);
    assert.deepEqual((await db.query(read, [id])).rows, expected);
  } finally { await db.end(); }
});
