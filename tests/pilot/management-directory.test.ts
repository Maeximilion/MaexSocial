import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { tokenHash } from '../../apps/web/src/server/session.js';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';
import { listOrganizations, type ManagementDirectoryContext } from '../../packages/contracts/management-directory.js';
import { createOrganization } from '../../packages/contracts/management-organization.js';
import { holdOccurrence } from '../../packages/contracts/occurrence.js';
import { occurrence, seedManagementSession, seedTenant } from './fixtures.js';

const now = new Date('2030-01-01T10:00:00Z');
const assertion = new Date(now.getTime() - 300_000);
const expiredStepUp = new Date(now.getTime() + 1);
const name = 'Invented fixture business';

test('the private directory lists minimal state under current management session authority', async t => {
  if (process.env.PILOT_CONTAINER !== '1') {
    console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/management-directory.test.js']));
    return;
  }

  const owner = await connectFixture(true);
  try {
    const active = await seedTenant(owner);
    const inactive = await seedTenant(owner);
    const target = await occurrence(owner, active);
    await owner.query('UPDATE pilot.tenants SET active=false,version=2 WHERE id=$1', [inactive.tenant]);
    await owner.query('INSERT INTO pilot.tenants(name) SELECT $1 FROM generate_series(1,51)', [name]);

    const proof: ManagementDirectoryContext = {
      ...await seedManagementSession(owner, now, assertion), action: 'organization_list'
    };
    const membership = (await owner.query<{ id: string }>(`INSERT INTO pilot.memberships(tenant_id,identity_id,role)
      VALUES($1,$2,'Manager') RETURNING id`, [active.tenant, proof.identityId])).rows[0]!.id;
    const customerSession = (await owner.query<{ id: string }>(`INSERT INTO pilot.sessions(token_hash,identity_id,
      identity_version,tenant_id,tenant_version,membership_id,membership_version,audience,created_at,last_seen_at,
      expires_at,mfa_at) VALUES($1,$2,1,$3,1,$4,1,'customer',$5,$6,$7,$8) RETURNING id`, [
      tokenHash(randomUUID()), proof.identityId, active.tenant, membership, new Date(now.getTime() - 360_000),
      now, new Date(now.getTime() + 600_000), assertion])).rows[0]!.id;
    const list = (overrides: Partial<ManagementDirectoryContext> = {}, at = expiredStepUp, after: string | null = null) =>
      listOrganizations(connectFixture, { ...proof, ...overrides }, () => at, after);
    const state = async () => (await owner.query(`SELECT
      (SELECT jsonb_agg(t ORDER BY id) FROM pilot.tenants t) AS tenants,
      (SELECT jsonb_agg(s ORDER BY id) FROM pilot.sessions s) AS sessions,
      (SELECT jsonb_agg(i ORDER BY id) FROM pilot.identities i) AS identities,
      (SELECT jsonb_agg(d ORDER BY id) FROM pilot.devices d) AS devices,
      (SELECT jsonb_agg(g ORDER BY id) FROM pilot.platform_grants g) AS grants,
      (SELECT jsonb_agg(m ORDER BY tenant_id,id) FROM pilot.memberships m) AS memberships,
      (SELECT jsonb_agg(a ORDER BY tenant_id,id) FROM pilot.approvals a) AS approvals,
      (SELECT jsonb_agg(o ORDER BY tenant_id,id) FROM pilot.occurrences o) AS occurrences,
      (SELECT jsonb_agg(a ORDER BY tenant_id,id) FROM pilot.audit a) AS audit`)).rows[0];
    const before = await state();

    await t.test('pages are capped, deterministic and distinguish equal names and states', async () => {
      const expected = (await owner.query('SELECT id AS "tenantId",name,active FROM pilot.tenants ORDER BY id')).rows;
      const first = await list();
      assert.equal(first.organizations.length, 50);
      assert.equal(first.nextAfter, first.organizations.at(-1)?.tenantId);
      assert.deepEqual(await list(), first);
      const all = [...first.organizations];
      let after: string | null = first.nextAfter;
      while (after !== null) {
        const page = await list({}, expiredStepUp, after);
        assert.ok(page.organizations.length > 0 && page.organizations.length <= 50);
        if (page.nextAfter !== null) assert.ok(page.nextAfter > after);
        all.push(...page.organizations);
        after = page.nextAfter;
      }
      assert.deepEqual(all, expected);
      assert.deepEqual(all.find(row => row.tenantId === active.tenant), { tenantId: active.tenant, name, active: true });
      assert.deepEqual(all.find(row => row.tenantId === inactive.tenant), { tenantId: inactive.tenant, name, active: false });
      assert.deepEqual(await list({}, expiredStepUp, all.at(-1)!.tenantId), { organizations: [], nextAfter: null });

      await assert.rejects(createOrganization(connectFixture, { ...proof, action: 'organization_create' },
        'Fixture organization', 'Fixture confirmation', () => expiredStepUp), /^Error: Denied$/);
      await assert.rejects(holdOccurrence(connectFixture, { ...proof, tenantId: inactive.tenant,
        tenantVersion: 2, occurrenceId: target }, active.tenant, target, 'Fixture confirmation', () => now),
      /^Error: Denied$/);
      assert.deepEqual(await state(), before);
    });

    await t.test('customer audience, wrong binding and invalid proof or cursor return no data', async () => {
      for (const invalid of [{ sessionId: customerSession }, { sessionId: randomUUID() }, { deviceId: randomUUID() },
        { deviceVersion: 2 }, { grantId: randomUUID() }, { grantVersion: 2 }, { phishingResistantAt: now },
        { phishingResistantAt: new Date(NaN) }]) {
        await assert.rejects(list(invalid), /^Error: Denied$/);
      }
      await assert.rejects(list({}, new Date(now.getTime() - 1)), /^Error: Denied$/);
      await assert.rejects(list({}, expiredStepUp, 'invalid-page-cursor'), /^Error: Denied$/);
      const wrongAction = { ...proof, action: 'organization_create' };
      await assert.rejects(listOrganizations(connectFixture, wrongAction as ManagementDirectoryContext, () => now),
        /^Error: Denied$/);
      assert.deepEqual(await state(), before);
    });

    await t.test('each continuation rechecks current identity, device, session and grant authority', async () => {
      const cases = [
        ['UPDATE pilot.sessions SET revoked_at=$2 WHERE id=$1', 'sessionId', now],
        ['UPDATE pilot.devices SET active=false,version=version+1 WHERE id=$1', 'deviceId'],
        ['UPDATE pilot.platform_grants SET active=false,version=version+1 WHERE id=$1', 'grantId'],
        ['UPDATE pilot.identities SET verified=false,version=version+1 WHERE id=$1', 'identityId'],
        ['UPDATE pilot.sessions SET mfa_at=NULL WHERE id=$1', 'sessionId']
      ] as const;
      for (const [change, id, timestamp] of cases) {
        const binding = await seedManagementSession(owner, now, assertion);
        const { nextAfter } = await list(binding);
        assert.ok(nextAfter);

        await owner.query(change, timestamp ? [binding[id], timestamp] : [binding[id]]);
        const revoked = await state();
        await assert.rejects(list(binding, now, nextAfter), /^Error: Denied$/);
        assert.deepEqual(await state(), revoked);

        // Match the new versions to exercise the active and verified checks independently.
        if (id === 'deviceId') {
          await owner.query('UPDATE pilot.sessions SET device_version=2 WHERE id=$1', [binding.sessionId]);
          binding.deviceVersion = 2;
        } else if (id === 'grantId') {
          binding.grantVersion = 2;
        } else if (id === 'identityId') {
          await owner.query('UPDATE pilot.sessions SET identity_version=2 WHERE id=$1', [binding.sessionId]);
        } else {
          continue;
        }
        const current = await state();
        await assert.rejects(list(binding, now, nextAfter), /^Error: Denied$/);
        assert.deepEqual(await state(), current);
      }
    });

    await t.test('session expiry, idle and absolute deadlines apply at their exact boundaries', async () => {
      const cases = [
        ['UPDATE pilot.sessions SET expires_at=$2 WHERE id=$1', now, now],
        ['UPDATE pilot.sessions SET expires_at=$2 WHERE id=$1', new Date(now.getTime() + 900_000),
          new Date(now.getTime() + 600_000)],
        ['UPDATE pilot.sessions SET created_at=$2 WHERE id=$1', new Date(now.getTime() - 3_600_000), now]
      ] as const;
      for (const [change, timestamp, at] of cases) {
        const binding = await seedManagementSession(owner, now, assertion);
        await owner.query(change, [binding.sessionId, timestamp]);
        const bounded = await state();
        await assert.rejects(list(binding, at), /^Error: Denied$/);
        assert.deepEqual(await state(), bounded);
      }
    });
  } finally {
    await owner.end();
  }
});
