import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { test } from 'node:test';
import type { Client } from 'pg';
import { holdOccurrence, type ManagementHoldContext } from '../../packages/contracts/occurrence.js';
import { tokenHash } from '../../apps/web/src/server/session.js';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';
import { occurrence, seedTenant } from './fixtures.js';

const now = new Date('2030-01-01T10:00:00Z');
const stepUp = new Date(now.getTime() - 300_000);

async function seedOperator(db: Client, tenantId: string, occurrenceId: string): Promise<ManagementHoldContext> {
  const identityId = randomUUID(), grantId = randomUUID(), deviceId = randomUUID(), sessionId = randomUUID();
  await db.query('INSERT INTO pilot.identities(id,subject,verified) VALUES($1,$2,true)', [identityId, randomUUID()]);
  await db.query('INSERT INTO pilot.platform_grants(id,identity_id) VALUES($1,$2)', [grantId, identityId]);
  await db.query("INSERT INTO pilot.devices(id,platform_grant_id,identity_id,public_key) VALUES($1,$2,$3,'synthetic device key')",
    [deviceId, grantId, identityId]);
  await db.query(`INSERT INTO pilot.sessions(id,token_hash,identity_id,identity_version,device_id,device_version,
    audience,created_at,last_seen_at,expires_at,mfa_at)
    VALUES($1,$2,$3,1,$4,1,'management',$5,$6,$7,$8)`,
  [sessionId, tokenHash(randomUUID()), identityId, deviceId, new Date(now.getTime() - 360_000), now,
    new Date(now.getTime() + 600_000), stepUp]);
  return { sessionId, identityId, deviceId, deviceVersion: 1, grantId, grantVersion: 1, tenantId, tenantVersion: 1,
    occurrenceId, phishingResistantAt: stepUp };
}

test('unmounted management hold commits only the selected occurrence and its audit', async t => {
  if (process.env.PILOT_CONTAINER !== '1') {
    console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/occurrence-hold.test.js']));
    return;
  }

  const owner = await connectFixture(true);
  try {
    const a = await seedTenant(owner), b = await seedTenant(owner);
    const selected = await occurrence(owner, a), sibling = await occurrence(owner, a), foreign = await occurrence(owner, b);
    const proof = await seedOperator(owner, a.tenant, selected);
    const hold = (id: string, reason = 'Review requested', session = { ...proof, occurrenceId: id }, tenant = a.tenant,
      clock = () => now) => holdOccurrence(connectFixture, session, tenant, id, reason, clock);
    const read = async (id: string) => (await owner.query('SELECT * FROM pilot.occurrences WHERE id=$1', [id])).rows[0];
    const audit = async (id: string) => (await owner.query(`SELECT tenant_id,actor_id,device_id,occurrence_id,action,reason,outcome,created_at
      FROM pilot.audit WHERE occurrence_id=$1`, [id])).rows;
    const approve = async (id: string) => {
      const approvalId = randomUUID();
      await owner.query(`INSERT INTO pilot.approvals(tenant_id,id,occurrence_id,draft_id,revision_id,location_id,membership_id,
        membership_version,grant_version,due_at,timezone,mfa_at)
        SELECT tenant_id,$1,id,draft_id,$2,location_id,$3,1,1,due_at,timezone,$4 FROM pilot.occurrences WHERE id=$5`,
      [approvalId, a.revision, a.membership, stepUp, id]);
      await owner.query("UPDATE pilot.occurrences SET approval_id=$1,state='approved' WHERE id=$2", [approvalId, id]);
      return approvalId;
    };

    await t.test('the five-minute boundary holds one approved occurrence and concurrent retries leave one audit', async () => {
      await approve(selected);
      await approve(sibling);
      const before = await read(selected), other = await read(sibling), outside = await read(foreign);
      assert.deepEqual(await Promise.all([hold(selected, ' Review requested '), hold(selected)]), ['held', 'held']);
      assert.deepEqual(await read(selected), { ...before, state: 'held' });
      assert.deepEqual(await read(sibling), other);
      assert.deepEqual(await read(foreign), outside);
      assert.deepEqual(await audit(selected), [{ tenant_id: a.tenant, actor_id: proof.identityId, device_id: proof.deviceId,
        occurrence_id: selected, action: 'occurrence_hold', reason: 'Review requested', outcome: 'held', created_at: now }]);
      assert.deepEqual(await audit(sibling), []);
      assert.deepEqual(await audit(foreign), []);
    });

    await t.test('scope, reason, freshness and current authority checks deny without writes', async () => {
      const target = await read(sibling), outside = await read(foreign);
      await assert.rejects(hold(sibling, 'Review', proof), /Denied/);
      await assert.rejects(hold(foreign, 'Review', { ...proof, occurrenceId: foreign }), /Denied/);
      await assert.rejects(hold(foreign, 'Review', { ...proof, occurrenceId: foreign }, b.tenant), /Denied/);
      await assert.rejects(hold(randomUUID()), /Denied/);
      for (const reason of [' \t\n', 'x'.repeat(501), 'bad\0reason']) {
        await assert.rejects(hold(sibling, reason), /Denied/);
      }
      await assert.rejects(hold(sibling, 'Review', undefined, a.tenant, () => new Date(now.getTime() + 1)), /Denied/);
      for (const change of [{ sessionId: randomUUID() }, { deviceId: randomUUID() }, { grantId: randomUUID() },
        { deviceVersion: 2 }, { grantVersion: 2 }, { tenantVersion: 2 }, { phishingResistantAt: now }]) {
        await assert.rejects(hold(sibling, 'Review', { ...proof, occurrenceId: sibling, ...change }), /Denied/);
      }
      const customer = randomUUID(), member = randomUUID();
      await owner.query("INSERT INTO pilot.memberships(tenant_id,id,identity_id,role) VALUES($1,$2,$3,'Manager')",
        [a.tenant, member, proof.identityId]);
      await owner.query(`INSERT INTO pilot.sessions(id,token_hash,identity_id,identity_version,tenant_id,membership_id,membership_version,
        audience,created_at,last_seen_at,expires_at,mfa_at)
        SELECT $1,$2,identity_id,identity_version,$3,$4,1,'customer',created_at,last_seen_at,expires_at,mfa_at
        FROM pilot.sessions WHERE id=$5`, [customer, tokenHash(randomUUID()), a.tenant, member, proof.sessionId]);
      await assert.rejects(hold(sibling, 'Review', { ...proof, occurrenceId: sibling, sessionId: customer }), /Denied/);
      assert.deepEqual(await read(sibling), target);
      assert.deepEqual(await read(foreign), outside);
      assert.deepEqual(await audit(sibling), []);
      assert.deepEqual(await audit(foreign), []);
    });

    await t.test('a claimed occurrence keeps its original attempt and reports its observed status', async () => {
      const id = await occurrence(owner, a);
      const approvalId = await approve(id);
      const claimant = await connectFixture();
      try {
        const pid = (await claimant.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
        await claimant.query('BEGIN');
        await claimant.query("UPDATE pilot.occurrences SET state='in_flight' WHERE id=$1", [id]);
        await claimant.query('INSERT INTO pilot.attempts(tenant_id,occurrence_id,approval_id) VALUES($1,$2,$3)', [a.tenant, id, approvalId]);
        const result = Promise.allSettled([hold(id)]);
        try {
          const deadline = performance.now() + 2_500;
          while (!(await owner.query(`SELECT 1 FROM pg_stat_activity
            WHERE $1=ANY(pg_blocking_pids(pid))`, [pid])).rowCount) {
            assert.ok(performance.now() < deadline, 'hold did not wait for the occurrence lock');
            await setTimeout(10);
          }
          await claimant.query('COMMIT');
        } catch (error) {
          await claimant.query('ROLLBACK');
          await result;
          throw error;
        }
        assert.deepEqual(await result, [{ status: 'fulfilled', value: 'in_flight' }]);
      } finally {
        await claimant.end();
      }
      const before = await read(id);
      const attempt = async () => (await owner.query('SELECT * FROM pilot.attempts WHERE occurrence_id=$1', [id])).rows[0];
      const claimed = await attempt();
      assert.equal(claimed.approval_id, approvalId);
      assert.equal(claimed.outcome, 'unknown');
      assert.equal(await hold(id), 'in_flight');
      assert.deepEqual(await attempt(), claimed);
      await owner.query("UPDATE pilot.attempts SET outcome='confirmed',observed_at=$2 WHERE occurrence_id=$1", [id, now]);
      const confirmed = await attempt();
      assert.equal(await hold(id), 'confirmed');
      assert.deepEqual(await attempt(), confirmed);
      assert.deepEqual(await read(id), before);
      assert.deepEqual(await audit(id), []);
    });

    await t.test('failed audit rolls back the entire hold', async () => {
      const before = await read(sibling), priorAudit = await audit(sibling);
      await owner.query(`ALTER TABLE pilot.audit ADD CONSTRAINT test_hold_audit_failure CHECK (reason <> 'Synthetic audit failure')`);
      try {
        await assert.rejects(hold(sibling, 'Synthetic audit failure'), { code: '23514', constraint: 'test_hold_audit_failure' });
        assert.deepEqual(await read(sibling), before);
        assert.deepEqual(await audit(sibling), priorAudit);
      } finally {
        await owner.query('ALTER TABLE pilot.audit DROP CONSTRAINT test_hold_audit_failure');
      }
      assert.equal(await hold(sibling), 'held');
    });

    await t.test('revoked sessions, devices and grants deny independently', async () => {
      const id = await occurrence(owner, a);
      const before = await read(id);
      const revokedSession = await seedOperator(owner, a.tenant, id);
      const revokedDevice = await seedOperator(owner, a.tenant, id);
      const revokedGrant = await seedOperator(owner, a.tenant, id);
      await owner.query('UPDATE pilot.sessions SET revoked_at=$1 WHERE id=$2', [now, revokedSession.sessionId]);
      await owner.query('UPDATE pilot.devices SET active=false,version=version+1 WHERE id=$1', [revokedDevice.deviceId]);
      await owner.query('UPDATE pilot.platform_grants SET active=false,version=version+1 WHERE id=$1', [revokedGrant.grantId]);
      for (const operator of [revokedSession, revokedDevice, revokedGrant]) {
        await assert.rejects(hold(id, 'Review', operator), /Denied/);
      }
      assert.deepEqual(await read(id), before);
      assert.deepEqual(await audit(id), []);
    });
  } finally {
    await owner.end();
  }
});
