import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';

test('access migration provides durable operations without credential storage', async () => {
  if (process.env.PILOT_CONTAINER !== '1') {
    console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/access-storage.test.js']));
    return;
  }
  const db = await connectFixture();
  try {
    for (const name of ['identity_operations', 'identity_completions', 'browser_flows', 'public_sessions', 'rate_windows']) {
      assert.equal((await db.query('SELECT to_regclass($1) AS name', [`pilot.${name}`])).rows[0].name, `pilot.${name}`);
    }
    const columns = await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema='pilot'");
    assert.ok(!columns.rows.some(r => /password|totp_secret|access_token|refresh_token/.test(r.column_name)));
    const authority = await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema='pilot' AND table_name='identities'");
    assert.ok(['email', 'generation', 'lifecycle'].every(name => authority.rows.some(r => r.column_name === name)));
    await db.query('BEGIN');
    const subject = randomUUID(), generation = randomUUID(), binding = randomUUID();
    const identity = (await db.query('INSERT INTO pilot.identities(subject) VALUES($1) RETURNING id', [subject])).rows[0].id;
    const challenge = (await db.query(`INSERT INTO pilot.pending_access(identity_id,email,purpose,token_hash,expires_at)
      VALUES($1,'invented@example.invalid','signup',$2,now()+interval '1 day') RETURNING id`, [identity, randomUUID().replaceAll('-', '').repeat(2)])).rows[0].id;
    const operation = (await db.query(`INSERT INTO pilot.identity_operations(identity_id,challenge_id,purpose,binding_id,generation,old_subject,phase,created_at,expires_at)
      VALUES($1,$2,'signup',$3,$4,$5,'complete',now(),now()+interval '1 day') RETURNING id`, [identity, challenge, binding, generation, subject])).rows[0].id;
    const completion = (await db.query(`INSERT INTO pilot.identity_completions(operation_id,identity_id,identity_version,subject,generation,email,first_name,last_name,previously_verified,purpose,binding_id,expires_at)
      VALUES($1,$2,1,$3,$4,'invented@example.invalid','Invented','Customer',false,'signup',$5,now()+interval '1 day') RETURNING id`, [operation, identity, subject, generation, binding])).rows[0].id;
    const refuses = async (sql: string) => {
      await db.query('SAVEPOINT invalid'); await assert.rejects(db.query(sql, [completion]), { code: '23514' }); await db.query('ROLLBACK TO SAVEPOINT invalid');
    };
    await refuses("UPDATE pilot.identity_completions SET purpose='invitation' WHERE id=$1");
    await refuses("UPDATE pilot.identity_completions SET generation=gen_random_uuid() WHERE id=$1");
    await db.query('UPDATE pilot.identity_completions SET consumed_at=now() WHERE id=$1', [completion]);
    await refuses('UPDATE pilot.identity_completions SET consumed_at=NULL WHERE id=$1');
    await db.query('ROLLBACK');
  } finally { await db.end(); }
});
