import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';
import { consumeIdentityCompletion } from '../../apps/web/src/server/identity.js';

test('completion binds exact identity/generation/purpose/grant and consumes once with domain commit', async () => {
  if (process.env.PILOT_CONTAINER !== '1') { console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/completion.test.js'])); return; }
  const db = await connectFixture(), other = await connectFixture(); const now = new Date();
  try {
    const subject = randomUUID(), generation = randomUUID(), binding = randomUUID(), email = `${randomUUID()}@example.invalid`;
    const identity = (await db.query("INSERT INTO pilot.identities(subject,email,generation,verified,lifecycle) VALUES($1,$2,$3,true,'active') RETURNING id", [subject, email, generation])).rows[0].id;
    const challenge = (await db.query(`INSERT INTO pilot.pending_access(identity_id,email,purpose,token_hash,expires_at,consumed_at)
      VALUES($1,$2,'signup',$3,now()+interval '1 day',now()) RETURNING id`, [identity, email, randomUUID().replaceAll('-', '').repeat(2)])).rows[0].id;
    const operation = (await db.query(`INSERT INTO pilot.identity_operations(identity_id,challenge_id,purpose,binding_id,generation,old_subject,new_subject,phase,created_at,expires_at)
      VALUES($1,$2,'signup',$3,$4,$5,$5,'complete',$6,$6::timestamptz+interval '1 day') RETURNING id`, [identity, challenge, binding, generation, subject, now])).rows[0].id;
    const completion = (await db.query(`INSERT INTO pilot.identity_completions(operation_id,identity_id,identity_version,subject,generation,email,first_name,last_name,previously_verified,purpose,binding_id,expires_at)
      VALUES($1,$2,1,$3,$4,$5,'Invented','Customer',false,'signup',$6,$7) RETURNING id`, [operation, identity, subject, generation, email, binding, new Date(now.getTime() + 900_000)])).rows[0].id;
    for (const [purpose, target, time] of [['invitation', binding, now], ['signup', randomUUID(), now], ['signup', binding, new Date(now.getTime() + 900_000)]] as const) {
      await db.query('BEGIN'); await assert.rejects(consumeIdentityCompletion(db, completion, purpose, target, time), /Denied/); await db.query('ROLLBACK');
    }
    for (const assignment of ["generation=gen_random_uuid()", "subject='changed-subject'", "lifecycle='recovering'", 'verified=false']) {
      await db.query('BEGIN'); await db.query(`UPDATE pilot.identities SET ${assignment},version=version+1 WHERE id=$1`, [identity]);
      await assert.rejects(consumeIdentityCompletion(db, completion, 'signup', binding, now), /Denied/); await db.query('ROLLBACK');
    }
    await db.query('BEGIN'); await db.query("UPDATE pilot.identity_operations SET phase='prepared' WHERE id=$1", [operation]);
    await assert.rejects(consumeIdentityCompletion(db, completion, 'signup', binding, now), /Denied/); await db.query('ROLLBACK');
    await db.query('BEGIN'); await db.query('UPDATE pilot.pending_access SET revoked_at=now() WHERE id=$1', [challenge]);
    await assert.rejects(consumeIdentityCompletion(db, completion, 'signup', binding, now), /Denied/); await db.query('ROLLBACK');
    await db.query('BEGIN'); const proof = await consumeIdentityCompletion(db, completion, 'signup', binding, now); assert.equal(proof.subject, subject); assert.equal(proof.email, email); await db.query('ROLLBACK');
    assert.equal((await db.query('SELECT consumed_at FROM pilot.identity_completions WHERE id=$1', [completion])).rows[0].consumed_at, null);
    await db.query('BEGIN'); await consumeIdentityCompletion(db, completion, 'signup', binding, now);
    await other.query('BEGIN'); const competing = assert.rejects(consumeIdentityCompletion(other, completion, 'signup', binding, now), /Denied/);
    await db.query('COMMIT'); await competing; await other.query('ROLLBACK');
    assert.ok((await db.query('SELECT consumed_at FROM pilot.identity_completions WHERE id=$1', [completion])).rows[0].consumed_at instanceof Date);
  } finally { await db.query('ROLLBACK'); await other.query('ROLLBACK'); await db.end(); await other.end(); }
});
