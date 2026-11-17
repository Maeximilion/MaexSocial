import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';
import { allowAttempt, type PublicFlow } from '../../apps/web/src/server/throttle.js';

test('independent rolling account/source limits count unknown accounts and survive connections', async () => {
  if (process.env.PILOT_CONTAINER !== '1') { console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/throttle.test.js'])); return; }
  const db = await connectFixture(); const now = new Date();
  const attempt = async (flow: PublicFlow, account: string, source: string, time = now): Promise<boolean> => {
    await db.query('BEGIN');
    try { const allowed = await allowAttempt(db, flow, account, source, time); await db.query('COMMIT'); return allowed; }
    catch (e) { await db.query('ROLLBACK'); throw e; }
  };
  try {
    for (const flow of ['login', 'signup', 'recovery', 'resend'] as const) {
      const account = `${randomUUID()}@example.invalid`, source = randomUUID();
      const accountLimit = flow === 'login' ? 5 : 3, sourceLimit = flow === 'login' ? 30 : 10;
      for (let i = 0; i < accountLimit; i++) assert.equal(await attempt(flow, account, randomUUID()), true);
      assert.equal(await attempt(flow, account.toUpperCase(), randomUUID()), false);
      for (let i = 0; i < sourceLimit; i++) assert.equal(await attempt(flow, `${randomUUID()}@example.invalid`, source), true);
      assert.equal(await attempt(flow, `${randomUUID()}@example.invalid`, source), false);
      const duration = flow === 'login' ? 900_000 : 3_600_000;
      assert.equal(await attempt(flow, account, randomUUID(), new Date(now.getTime() + duration - 1)), false);
      assert.equal(await attempt(flow, account, randomUUID(), new Date(now.getTime() + duration)), true);
      const other = await connectFixture();
      try { await other.query('BEGIN'); assert.equal(await allowAttempt(other, flow, randomUUID(), source, now), false); await other.query('COMMIT'); }
      finally { await other.end(); }
    }
  } finally { await db.end(); }
});
