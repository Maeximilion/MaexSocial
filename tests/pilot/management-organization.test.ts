import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { tokenHash } from '../../apps/web/src/server/session.js';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';
import { createOrganization, type ManagementOrganizationContext } from '../../packages/contracts/management-organization.js';
import { seedManagementSession, seedTenant } from './fixtures.js';

const now = new Date('2030-01-01T10:00:00Z');
const stepUp = new Date(now.getTime() - 300_000);
const reason = 'Confirmed local fixture';

test('private organization creation commits the new tenant and audit together', async t => {
  if (process.env.PILOT_CONTAINER !== '1') {
    console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/management-organization.test.js']));
    return;
  }

  const owner = await connectFixture(true);
  try {
    const existing = await seedTenant(owner);
    const proof: ManagementOrganizationContext = {
      ...await seedManagementSession(owner, now, stepUp), action: 'organization_create'
    };
    const membership = (await owner.query<{ id: string }>(`INSERT INTO pilot.memberships(tenant_id,identity_id,role)
      VALUES($1,$2,'Manager') RETURNING id`, [existing.tenant, proof.identityId])).rows[0]!;
    const customer = (await owner.query<{ id: string }>(`INSERT INTO pilot.sessions(token_hash,identity_id,identity_version,
      tenant_id,tenant_version,membership_id,membership_version,audience,created_at,last_seen_at,expires_at,mfa_at)
      VALUES($1,$2,1,$3,1,$4,1,'customer',$5,$6,$7,$8) RETURNING id`, [tokenHash(randomUUID()), proof.identityId,
      existing.tenant, membership.id, new Date(now.getTime() - 360_000), now,
      new Date(now.getTime() + 600_000), stepUp])).rows[0]!;
    const create = (name: string, why = reason, context = proof, at = now) =>
      createOrganization(connectFixture, context, name, why, () => at);
    const tenants = async () => (await owner.query('SELECT * FROM pilot.tenants ORDER BY id')).rows;
    const audits = async () => (await owner.query(`SELECT tenant_id,actor_id,device_id,action,reason,outcome,created_at
      FROM pilot.audit WHERE actor_id=$1`, [proof.identityId])).rows;
    const before = await tenants();
    const access = async () => (await owner.query(`SELECT
      (SELECT count(*) FROM pilot.identities) AS identities,
      (SELECT count(*) FROM pilot.pending_access) AS pending_access,
      (SELECT count(*) FROM pilot.invitations) AS invitations,
      (SELECT count(*) FROM pilot.memberships) AS memberships`)).rows[0];
    const expectedAccess = await access();

    await t.test('fresh authority creates an active empty organization with the database defaults', async () => {
      const name = '🌱'.repeat(200);
      const result = await create(`  ${name}  `, `  ${reason}  `);
      assert.ok(!before.some(tenant => tenant.id === result.tenantId));
      assert.deepEqual(result, { tenantId: result.tenantId, status: 'created' });
      const current = await tenants();
      assert.deepEqual(current.find(tenant => tenant.id === result.tenantId),
        { id: result.tenantId, name, active: true, version: 1 });
      assert.deepEqual(current.filter(tenant => tenant.id !== result.tenantId), before);
      assert.deepEqual(await audits(), [{ tenant_id: result.tenantId, actor_id: proof.identityId,
        device_id: proof.deviceId, action: 'organization_create', reason, outcome: 'created', created_at: now }]);
      assert.deepEqual(await access(), expectedAccess);
    });

    const current = await tenants(), priorAudit = await audits();
    await t.test('invalid requests and stale or customer authority leave the database unchanged', async () => {
      for (const name of [' \t ', '🌱'.repeat(201), 'Bad\0name', 'Bad\nname', '\ud800']) {
        await assert.rejects(create(name), /Denied/);
      }
      for (const why of [' ', 'x'.repeat(501), 'Bad\0reason']) {
        await assert.rejects(create('Fixture', why), /Denied/);
      }
      for (const override of [{ sessionId: customer.id }, { deviceVersion: 2 },
        { grantVersion: 2 }, { phishingResistantAt: now }]) {
        await assert.rejects(create('Fixture', reason, { ...proof, ...override }), /Denied/);
      }
      await assert.rejects(create('Fixture', reason, proof, new Date(now.getTime() + 1)), /Denied/);
      assert.deepEqual(await tenants(), current);
      assert.deepEqual(await audits(), priorAudit);
      assert.deepEqual(await access(), expectedAccess);
    });

    await t.test('audit failure rolls back creation and revocation prevents further writes', async () => {
      await owner.query("ALTER TABLE pilot.audit ADD CONSTRAINT test_organization_audit_failure CHECK (reason <> 'Fixture audit failure')");
      try {
        await assert.rejects(create('Fixture rollback', 'Fixture audit failure'),
          { code: '23514', constraint: 'test_organization_audit_failure' });
      } finally {
        await owner.query('ALTER TABLE pilot.audit DROP CONSTRAINT test_organization_audit_failure');
      }
      await owner.query('UPDATE pilot.sessions SET revoked_at=$2 WHERE id=$1', [proof.sessionId, now]);
      await assert.rejects(create('Fixture revoked session'), /Denied/);
      assert.deepEqual(await tenants(), current);
      assert.deepEqual(await audits(), priorAudit);
      assert.deepEqual(await access(), expectedAccess);
    });
  } finally {
    await owner.end();
  }
});
