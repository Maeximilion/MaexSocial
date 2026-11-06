import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';
import { seedTenant, occurrence } from './fixtures.js';
import { migrate } from '../../scripts/pilot-db.js';

// Removing tenant FKs, immutable references or the unique creation key must fail these tests.
test('tenant references, immutable occurrence IDs and concurrent creation', async () => {
  if (process.env.PILOT_CONTAINER !== '1') {
    console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/storage.test.js']));
    return;
  }
  const owner = await connectFixture(true);
  const app = await connectFixture();
  try {
    const result = await owner.query("SELECT to_regclass('pilot.occurrences') AS name");
    assert.equal(result.rows[0].name, 'pilot.occurrences', 'migration must create durable occurrences');
    const a = await seedTenant(owner);
    const b = await seedTenant(owner);
    const aId = await occurrence(app, a);
    const bId = await occurrence(app, b);
    assert.notEqual(aId, bId);
    // Neither another tenant nor the application may choose/recycle a durable global ID.
    await assert.rejects(owner.query(`INSERT INTO pilot.occurrences(id,tenant_id,draft_id,location_id,creation_key,due_at,timezone)
      VALUES ($1,$2,$3,$4,$5,now(),'UTC')`, [aId, b.tenant, b.draft, b.location, randomUUID()]), { code: '23505' });
    await assert.rejects(app.query(`INSERT INTO pilot.occurrences(id,tenant_id,draft_id,location_id,creation_key,due_at,timezone)
      VALUES ($1,$2,$3,$4,$5,now(),'UTC')`, [randomUUID(), a.tenant, a.draft, a.location, randomUUID()]), { code: '42501' });
    await assert.rejects(occurrence(app, { ...a, location: b.location }), { code: '23503' });
    await assert.rejects(occurrence(app, { ...a, draft: b.draft }), { code: '23503' });
    const other = await connectFixture();
    try {
      const key = randomUUID();
      const raced = await Promise.allSettled([occurrence(app, a, key), occurrence(other, a, key)]);
      assert.equal(raced.filter(r => r.status === 'fulfilled').length, 1);
      assert.equal(raced.filter(r => r.status === 'rejected' && r.reason.code === '23505').length, 1);
      assert.equal((await owner.query('SELECT count(*)::int AS count FROM pilot.occurrences WHERE tenant_id=$1 AND creation_key=$2', [a.tenant, key])).rows[0].count, 1);
    } finally { await other.end(); }
    // Equal due instants still represent distinct occurrences when their creation keys differ.
    assert.notEqual(await occurrence(app, a), aId);
    const approvalSql = `INSERT INTO pilot.approvals(tenant_id,occurrence_id,draft_id,revision_id,location_id,
      membership_id,membership_version,grant_version,due_at,timezone,mfa_at)
      VALUES ($1,$2,$3,$4,$5,$6,1,1,'2030-01-01T12:00:00Z','Europe/Berlin',now()) RETURNING id`;
    const approvalValues = [a.tenant, aId, a.draft, a.revision, a.location, a.membership];
    for (const [index, foreign] of [[1, bId], [3, b.revision], [4, b.location], [5, b.membership]] as const) {
      const values = [...approvalValues]; values[index] = foreign;
      await assert.rejects(app.query(approvalSql, values), { code: '23503' });
    }
    const approval = (await app.query(approvalSql, approvalValues)).rows[0].id;
    await app.query('UPDATE pilot.occurrences SET approval_id=$1 WHERE tenant_id=$2 AND id=$3', [approval, a.tenant, aId]);
    await assert.rejects(app.query('UPDATE pilot.occurrences SET approval_id=$1 WHERE tenant_id=$2 AND id=$3', [approval, b.tenant, bId]), { code: '23503' });
    await assert.rejects(owner.query('UPDATE pilot.occurrences SET id=$1 WHERE id=$2', [randomUUID(), aId]), { code: '23514' });
    await assert.rejects(app.query("UPDATE pilot.draft_revisions SET text='rewritten' WHERE id=$1", [a.revision]), { code: '42501' });
    await assert.rejects(owner.query("UPDATE pilot.draft_revisions SET text='rewritten' WHERE id=$1", [a.revision]), { code: '23514' });
    await assert.rejects(owner.query('UPDATE pilot.approvals SET membership_version=2 WHERE id=$1', [approval]), { code: '23514' });
    await assert.rejects(app.query("UPDATE pilot.memberships SET role='Employee' WHERE id=$1", [a.membership]), { code: '23514' });
    await app.query("UPDATE pilot.memberships SET role='Employee',version=version+1 WHERE id=$1", [a.membership]);
    assert.equal((await app.query('SELECT membership_version FROM pilot.approvals WHERE id=$1', [approval])).rows[0].membership_version, 1);
    await assert.rejects(app.query('INSERT INTO pilot.attempts(tenant_id,occurrence_id,approval_id) VALUES ($1,$2,$3)', [b.tenant, bId, approval]), { code: '23503' });
    await app.query('INSERT INTO pilot.attempts(tenant_id,occurrence_id,approval_id) VALUES ($1,$2,$3)', [a.tenant, aId, approval]);
    await assert.rejects(app.query('INSERT INTO pilot.attempts(tenant_id,occurrence_id,approval_id) VALUES ($1,$2,$3)', [a.tenant, aId, approval]), { code: '23505' });
    await assert.rejects(app.query('DELETE FROM pilot.occurrences WHERE id=$1', [aId]), { code: '42501' });
    await assert.rejects(app.query('SELECT * FROM public.fixture_identity'), { code: '42501' });
    const sessionSql = `INSERT INTO pilot.sessions(token_hash,identity_id,tenant_id,membership_id,membership_version,identity_version,audience,expires_at)
      VALUES ($1,$2,$3,$4,$5,1,'customer',now()+interval '1 hour')`;
    await assert.rejects(app.query(sessionSql, ['a'.repeat(64), a.user, a.tenant, a.membership, null]), { code: '23514' });
    await assert.rejects(app.query(sessionSql, ['b'.repeat(64), b.user, a.tenant, a.membership, 2]), { code: '23503' });
    const invitationSql = `INSERT INTO pilot.invitations(tenant_id,email,role,purpose,issuer_membership_id,issuer_version,grant_version,token_hash,expires_at)
      VALUES ($1,'employee@example.invalid','Employee','membership',$2,2,1,$3,now()+interval '1 day') RETURNING id`;
    await assert.rejects(app.query(invitationSql, [a.tenant, b.membership, 'c'.repeat(64)]), { code: '23503' });
    const invite = (await app.query(invitationSql, [a.tenant, a.membership, randomUUID().replaceAll('-', '').repeat(2)])).rows[0].id;
    await app.query('UPDATE pilot.invitations SET consumed_at=now() WHERE id=$1', [invite]);
    await assert.rejects(app.query('UPDATE pilot.invitations SET consumed_at=NULL WHERE id=$1', [invite]), { code: '23514' });
    await assert.rejects(migrate('down'), /Populated fixture/);
    assert.equal((await app.query('SELECT count(*)::int AS count FROM pilot.occurrences WHERE tenant_id=$1', [a.tenant])).rows[0].count, 3);
    console.log('Tenant A/B references, generated immutable IDs, one durable concurrent occurrence, one attempt and versioned approval verified.');
  } finally { await app.end(); await owner.end(); }
});
