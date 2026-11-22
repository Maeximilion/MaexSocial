import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { test } from 'node:test';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';
import { reserveSyntheticJob, seedTenant, settleSyntheticJob } from './fixtures.js';

test('ADS-01: competing synthetic reservations and settlement preserve the budget', async t => {
  if (process.env.PILOT_CONTAINER !== '1') {
    console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/budget.test.js']));
    return;
  }

  const connect = async (owner = false) => {
    const db = await connectFixture(owner);
    t.after(() => db.end());
    return db;
  };
  const owner = await connect(true);
  const first = await connect(), second = await connect();
  const a = await seedTenant(owner), b = await seedTenant(owner);
  const firstKey = randomUUID(), secondKey = randomUUID();
  const reservations = async (tenantId: string) => (await owner.query(`SELECT operation_key,units,state,settled_units
    FROM pilot.budget_reservations WHERE tenant_id=$1 ORDER BY operation_key`, [tenantId])).rows;

  assert.equal(await reserveSyntheticJob(first, b.tenant, firstKey, 1), false);
  await owner.query('INSERT INTO pilot.budgets(tenant_id,synthetic_units) VALUES ($1,5),($2,0)', [a.tenant, b.tenant]);
  assert.equal(await reserveSyntheticJob(first, b.tenant, firstKey, 1), false);
  assert.deepEqual(await reservations(b.tenant), []);

  const pids = await Promise.all([first, second].map(async db =>
    (await db.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid));
  await owner.query('BEGIN');
  const keys = [firstKey, secondKey];
  let outcomes: Promise<PromiseSettledResult<boolean>[]>;
  try {
    await owner.query('SELECT tenant_id FROM pilot.budgets WHERE tenant_id=$1 FOR UPDATE', [a.tenant]);
    outcomes = Promise.allSettled([reserveSyntheticJob(first, a.tenant, firstKey, 4),
      reserveSyntheticJob(second, a.tenant, secondKey, 4)]);
    let waiting = 0;
    for (let i = 0; i < 80 && waiting < 2; i++) {
      waiting = (await owner.query<{ count: number }>(`SELECT count(DISTINCT pid)::int AS count FROM pg_locks
        WHERE pid=ANY($1::int[]) AND NOT granted`, [pids])).rows[0]!.count;
      if (waiting < 2) await setTimeout(25);
    }
    assert.equal(waiting, 2);
  } finally { await owner.query('ROLLBACK'); }
  const results = (await outcomes).map(result => {
    if (result.status === 'rejected') throw result.reason;
    return result.value;
  });
  assert.equal(results.filter(Boolean).length, 1);
  const winner = keys[results.indexOf(true)]!, loser = keys[results.indexOf(false)]!;
  const held = { operation_key: winner, units: '4', state: 'reserved', settled_units: null };
  assert.deepEqual(await reservations(a.tenant), [held]);

  assert.equal(await settleSyntheticJob(first, b.tenant, winner, 2), false);
  assert.equal(await settleSyntheticJob(first, a.tenant, winner, 5), false);
  assert.equal(await settleSyntheticJob(first, a.tenant, winner, null), true);
  assert.equal(await settleSyntheticJob(second, a.tenant, winner, null), false);
  assert.equal(await reserveSyntheticJob(second, a.tenant, loser, 2), false);
  assert.deepEqual(await reservations(a.tenant), [{ ...held, state: 'unknown' }]);

  const settled = await Promise.all([settleSyntheticJob(first, a.tenant, winner, 2),
    settleSyntheticJob(second, a.tenant, winner, 2)]);
  assert.deepEqual(settled.sort(), [false, true]);
  assert.equal(await settleSyntheticJob(second, a.tenant, winner, 0), false);
  assert.equal(await settleSyntheticJob(second, a.tenant, winner, null), false);
  const charged = { ...held, state: 'settled', settled_units: '2' };
  assert.deepEqual(await reservations(a.tenant), [charged]);

  assert.equal(await reserveSyntheticJob(second, a.tenant, winner, 3), false);
  assert.equal(await reserveSyntheticJob(second, a.tenant, loser, 4), false);
  assert.equal(await reserveSyntheticJob(second, a.tenant, loser, 3), true);
  assert.equal(await reserveSyntheticJob(first, a.tenant, randomUUID(), 1), false);
  assert.deepEqual(await reservations(a.tenant), [charged, {
    operation_key: loser, units: '3', state: 'reserved', settled_units: null
  }].sort((left, right) => left.operation_key.localeCompare(right.operation_key)));
  assert.deepEqual((await owner.query('SELECT synthetic_units FROM pilot.budgets WHERE tenant_id=$1',
    [a.tenant])).rows, [{ synthetic_units: '5' }]);
  assert.deepEqual(await reservations(b.tenant), []);
});
