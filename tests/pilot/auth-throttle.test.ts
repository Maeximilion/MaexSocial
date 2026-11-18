import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHmac, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fork } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { createAuthThrottle } from '../../apps/web/src/server/auth-throttle.js';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';

test('durable independent account/source throttles in actual PostgreSQL', async t => {
  if (process.env.PILOT_CONTAINER !== '1') {
    console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/auth-throttle.test.js'])); return;
  }
  const owner = await connectFixture(true), key = await readFile('work/pilot/throttle-key', 'utf8');
  const make = (flow: 'login' | 'signup' | 'recovery' | 'resend' = 'login') => createAuthThrottle(key, connectFixture, flow);
  const digest = (...parts: string[]) => createHmac('sha256', Buffer.from(key, 'hex'))
    .update(JSON.stringify(['auth-throttle-v1', ...parts])).digest('hex');
  const reset = () => owner.query('DELETE FROM pilot.auth_throttle_buckets');
  const rows = async () => (await owner.query('SELECT flow,dimension,bucket_key,attempts::text,expires_at::text FROM pilot.auth_throttle_buckets ORDER BY flow,dimension,bucket_key')).rows;
  const denied = (action: Promise<unknown>) => assert.rejects(action, error =>
    error instanceof Error && error.message === 'Throttle unavailable' && error.cause === undefined);
  const consume = (account = 'invented@example.invalid', ip = '192.0.2.1') => make().consume(account, ip);
  const count = async (dimension: string, id: string, flow = 'login') =>
    (await owner.query('SELECT cardinality(attempts) AS n FROM pilot.auth_throttle_buckets WHERE bucket_key=$1', [digest(flow, dimension, id)])).rows[0]?.n;
  const charge = async (flow: string, dimension: string, id: string, now: string) =>
    (await owner.query('SELECT pilot.charge_auth_throttle($1,$2,$3,$4::timestamptz) AS allowed', [flow, dimension, id, now])).rows[0].allowed;
  try {
    assert.equal((await owner.query("SELECT to_regclass('pilot.auth_throttle_buckets') AS name")).rows[0].name,
      'pilot.auth_throttle_buckets');
    await t.test('retained key/exhaustion survive new processes and retained fixture restart', async () => {
      const binding = (await owner.query('SELECT key_hash FROM pilot.auth_throttle_key')).rows[0];
      if (binding) {
        assert.equal(binding.key_hash, digest('key-binding'));
        const retained = (await owner.query(`SELECT cardinality(attempts) AS n,
          expires_at>clock_timestamp()+interval '10 seconds' AS active,
          expires_at<=clock_timestamp() AS expired FROM pilot.auth_throttle_buckets WHERE bucket_key=$1`,
          [digest('login', 'account', 'restart@example.invalid')])).rows[0];
        if (retained) {
          assert.equal(retained.n, 5);
          if (retained.active) assert.equal(await consume('restart@example.invalid'), false);
          if (retained.expired) assert.equal(await consume('restart@example.invalid'), true);
        }
      }
      await make().cleanup();
      assert.equal((await owner.query('SELECT key_hash FROM pilot.auth_throttle_key')).rows[0].key_hash, digest('key-binding'));
      await reset();
    });
    await t.test('SQL exact moving boundaries, denied suffix and all flow/dimension limits', async () => {
      for (const flow of ['login', 'signup', 'recovery', 'resend']) for (const dimension of ['account', 'source']) {
        await reset();
        const limit = flow === 'login' ? (dimension === 'account' ? 5 : 30) : (dimension === 'account' ? 3 : 10);
        const id = randomBytes(32).toString('hex'), start = '2030-01-01T00:00:00.123456Z';
        const end = flow === 'login' ? '2030-01-01T00:15:00.123456Z' : '2030-01-01T01:00:00.123456Z';
        for (let i = 0; i < limit; i++) assert.equal(await charge(flow, dimension, id, start), true);
        const before = (await owner.query("SELECT ($1::timestamptz-interval '1 microsecond')::text AS t", [end])).rows[0].t;
        assert.equal(await charge(flow, dimension, id, before), false);
        assert.equal((await owner.query('SELECT cardinality(attempts) AS n FROM pilot.auth_throttle_buckets')).rows[0].n, limit);
        assert.equal(await charge(flow, dimension, id, end), true, 'exactly W old expires; denied recent charge remains');
        assert.equal((await owner.query('SELECT cardinality(attempts) AS n FROM pilot.auth_throttle_buckets')).rows[0].n, 2);
        for (let i = 2; i < limit; i++) assert.equal(await charge(flow, dimension, id, end), true);
        assert.equal(await charge(flow, dimension, id, end), false);
      }
      await reset();
    });
    await t.test('both dimensions charge on denial, absent accounts and separate flows', async () => {
      for (const flow of ['login', 'signup', 'recovery', 'resend'] as const) {
        const limit = flow === 'login' ? 5 : 3, throttle = make(flow);
        for (let i = 0; i < limit; i++) assert.equal(await throttle.consume('absent@example.invalid', `192.0.2.${i + 1}`), true);
        assert.equal(await throttle.consume('absent@example.invalid', '192.0.2.99'), false);
        assert.equal(await count('source', '192.0.2.99', flow), 1);
        for (let i = 0; i < (flow === 'login' ? 30 : 10); i++) assert.equal(await throttle.consume(`nat${i}@example.invalid`, '198.51.100.1'), true);
        assert.equal(await throttle.consume('new-unknown@example.invalid', '198.51.100.1'), false);
        assert.equal(await count('account', 'new-unknown@example.invalid', flow), 1);
        assert.equal(await throttle.consume('positive@example.invalid', '203.0.113.1'), true);
      }
      const serialized = JSON.stringify(await rows());
      assert.ok(!serialized.includes('example.invalid') && !serialized.includes('192.0.2') && !serialized.includes(key));
      await reset();
    });
    await t.test('mail normalization and canonical IPv6/mapped IPv4 cannot split counters', async () => {
      for (const [first, alias, canonical] of [
        ['2001:0DB8:0000:0000:0000:0000:0000:0001', '2001:db8::1', '2001:db8::1'],
        ['::ffff:192.0.2.1', '0:0:0:0:0:FFFF:C000:0201', '192.0.2.1']
      ] as const) {
        await reset();
        assert.equal(await consume(' \tInvented@EXAMPLE.invalid\r\n', first), true);
        assert.equal(await consume('invented@example.invalid', alias), true);
        assert.equal((await rows()).length, 2);
        assert.equal(await count('account', 'invented@example.invalid'), 2);
        assert.equal(await count('source', canonical), 2);
      }
      await reset();
      assert.equal(await consume('a+b@example.invalid'), true); assert.equal(await consume('ab@example.invalid'), true);
      assert.equal((await owner.query("SELECT count(*)::int AS n FROM pilot.auth_throttle_buckets WHERE dimension='account'")).rows[0].n, 2);
      await reset();
    });
    await t.test('invalid inputs/configuration/database fail closed without raw error or mutation', async () => {
      for (const value of ['', 'a', 'a@@example.invalid', '.a@example.invalid', 'a..b@example.invalid', 'a@-bad.invalid',
        'a@bad_.invalid', 'a'.repeat(65) + '@example.invalid', 'k\u212a@example.invalid', 'a@exämple.invalid', 'a\0@example.invalid', null, {}]) await denied(consume(value as string));
      for (const value of ['', 'proxy', '192.168.001.1', '192.0.2.1, 198.51.100.1', '[::1]', 'fe80::1%eth0', '192.0.2.1:80', null, {}]) await denied(consume('a@example.invalid', value as string));
      for (const invalid of [undefined, '', 'a'.repeat(63), 'g'.repeat(64)]) assert.throws(() => createAuthThrottle(invalid as string, connectFixture, 'login'), /Throttle unavailable/);
      assert.throws(() => createAuthThrottle(key, connectFixture, 'tenant-login' as 'login'), /Throttle unavailable/);
      await denied(createAuthThrottle(key, async () => { throw new Error('raw credential error'); }, 'login').consume('a@example.invalid', '192.0.2.1'));
      assert.deepEqual(await rows(), []); assert.equal(await consume(), true);
      const before = await rows();
      await denied(createAuthThrottle(randomBytes(32).toString('hex'), connectFixture, 'login').consume('a@example.invalid', '192.0.2.2'));
      assert.deepEqual(await rows(), before); await reset();
    });
    await t.test('independent connections/processes cannot overspend account or source', async () => {
      await reset();
      const accountResults = await Promise.all(Array.from({ length: 12 }, (_, i) => consume('race@example.invalid', `192.0.2.${i + 1}`)));
      assert.equal(accountResults.filter(Boolean).length, 5);
      assert.equal((await owner.query("SELECT sum(cardinality(attempts))::int AS n FROM pilot.auth_throttle_buckets WHERE dimension='source'")).rows[0].n, 12);
      await reset();
      const sourceResults = await Promise.all(Array.from({ length: 36 }, (_, i) => consume(`race${i}@example.invalid`, '192.0.2.1')));
      assert.equal(sourceResults.filter(Boolean).length, 30);
      assert.equal((await owner.query("SELECT count(*)::int AS n FROM pilot.auth_throttle_buckets WHERE dimension='account'")).rows[0].n, 36);
      await reset();
      const results = await Promise.all(Array.from({ length: 8 }, () => new Promise<boolean>((resolve, reject) => {
        const child = fork('dist/pilot/tests/pilot/auth-throttle-process.js', [], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
        let result: unknown;
        child.on('message', message => { result = message; }); child.on('error', reject);
        child.on('exit', code => code === 0 && typeof result === 'boolean' ? resolve(result) : reject(new Error('Throttle process failed')));
      })));
      assert.equal(results.filter(Boolean).length, 5); assert.equal(await count('source', '192.0.2.1'), 8); await reset();
    });
    await t.test('database clock follows actual lock wait and elapsed window permits use', async () => {
      const blocker = await connectFixture(true), waiting = await connectFixture();
      let pending: Promise<boolean> | undefined;
      try {
        for (let i = 0; i < 5; i++) await consume();
        await blocker.query('BEGIN'); await blocker.query('SELECT pg_advisory_xact_lock(154,1)');
        await owner.query("UPDATE pilot.auth_throttle_buckets SET attempts=array_fill(t-interval '15 minutes',ARRAY[5]),expires_at=t FROM (SELECT clock_timestamp()+interval '400 milliseconds' AS t) AS stamp");
        const pid = (await waiting.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        pending = createAuthThrottle(key, async () => waiting, 'login').consume('invented@example.invalid', '192.0.2.1');
        let blocked = false;
        for (let i = 0; i < 100; i++) {
          if ((await owner.query('SELECT cardinality(pg_blocking_pids($1)) AS n', [pid])).rows[0].n > 0) { blocked = true; break; }
          await delay(10);
        }
        assert.ok(blocked); await delay(500);
        const releasedAt = (await owner.query('SELECT clock_timestamp()::text AS t')).rows[0].t;
        await blocker.query('COMMIT'); assert.equal(await pending, true);
        assert.deepEqual((await owner.query('SELECT bool_and(attempts[1]>=$1::timestamptz) AS fresh,max(cardinality(attempts)) AS n FROM pilot.auth_throttle_buckets', [releasedAt])).rows[0], { fresh: true, n: 1 });
      } finally { await blocker.query('ROLLBACK'); await blocker.end(); if (pending) await pending.catch(() => {}); else await waiting.end(); }
      await reset();
    });
    await t.test('second charge failure, future timestamps and capacity roll back both dimensions', async () => {
      await consume(); const before = await rows();
      await owner.query(`CREATE FUNCTION pilot.throttle_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN IF NEW.dimension='source' THEN RAISE EXCEPTION 'raw input must not escape'; END IF; RETURN NEW; END $$;
        CREATE TRIGGER throttle_test_fail BEFORE INSERT OR UPDATE ON pilot.auth_throttle_buckets FOR EACH ROW EXECUTE FUNCTION pilot.throttle_test_fail()`);
      try { await denied(consume()); assert.deepEqual(await rows(), before); }
      finally { await owner.query('DROP TRIGGER throttle_test_fail ON pilot.auth_throttle_buckets; DROP FUNCTION pilot.throttle_test_fail()'); }
      assert.equal(await consume(), true);
      await owner.query("UPDATE pilot.auth_throttle_buckets SET attempts=ARRAY['2099-01-01'::timestamptz],expires_at='2099-01-01'::timestamptz+interval '15 minutes'");
      const future = await rows(); await denied(consume()); assert.deepEqual(await rows(), future); await reset();
      await owner.query(`INSERT INTO pilot.auth_throttle_buckets(flow,dimension,bucket_key,attempts,expires_at)
        SELECT 'login','account',lpad(to_hex(n),64,'0'),ARRAY[t],t+interval '15 minutes'
        FROM generate_series(1,4095) AS n CROSS JOIN (SELECT clock_timestamp() AS t) AS clock`);
      await denied(consume());
      assert.equal((await owner.query('SELECT count(*)::int AS n FROM pilot.auth_throttle_buckets')).rows[0].n, 4095);
      await reset(); assert.equal(await consume(), true); await reset();
    });
    await t.test('physical cleanup, retained key protection and durable restart canary', async () => {
      await consume();
      await owner.query("UPDATE pilot.auth_throttle_buckets SET attempts=ARRAY['2000-01-01'::timestamptz],expires_at='2000-01-01'::timestamptz+interval '15 minutes' WHERE dimension='account'");
      assert.equal((await rows()).length, 2, 'expiry alone does not physically delete idle rows');
      await make().cleanup(); assert.deepEqual((await rows()).map(row => row.dimension), ['source']);
      const app = await connectFixture();
      try { await assert.rejects(app.query('DELETE FROM pilot.auth_throttle_key'), { code: '42501' }); }
      finally { await app.end(); }
      assert.equal(await consume(), true); await reset();
      for (let i = 0; i < 5; i++) assert.equal(await consume('restart@example.invalid'), true);
      assert.equal(await consume('restart@example.invalid'), false);
    });
  } finally { await owner.end(); }
});
