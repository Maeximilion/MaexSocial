import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { setTimeout } from 'node:timers/promises';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';
import { lockIdentities, requireCustomer, rotateCustomerSession, tokenHash } from '../../apps/web/src/server/session.js';
import type { IdentityStatus } from '../../packages/contracts/pilot.js';

test('tenant switching rotates opaque session and CSRF without extending absolute expiry', async t => {
  if (process.env.PILOT_CONTAINER !== '1') { console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/session-rotation.test.js'])); return; }
  const db = await connectFixture(); const now = new Date();
  const status: IdentityStatus = { subject: randomUUID(),
    verified: true, enabled: true, requiredActions: [], credentials: [] };
  try {
    const identity = (await db.query("INSERT INTO pilot.identities(subject,verified) VALUES($1,true) RETURNING id", [status.subject])).rows[0].id;
    const tenants: string[] = [];
    for (const name of ['Synthetic A', 'Synthetic B', 'Not a member']) tenants.push((await db.query('INSERT INTO pilot.tenants(name) VALUES($1) RETURNING id', [name])).rows[0].id);
    const memberships: string[] = [];
    for (const tenant of tenants.slice(0, 2)) memberships.push((await db.query("INSERT INTO pilot.memberships(tenant_id,identity_id,role) VALUES($1,$2,'Employee') RETURNING id", [tenant, identity])).rows[0].id);
    const token = randomBytes(32).toString('hex'), csrf = randomBytes(32).toString('hex');
    const created = new Date(now.getTime() - 60_000), expires = new Date(created.getTime() + 28_800_000);
    await db.query(`INSERT INTO pilot.sessions(token_hash,csrf_hash,identity_id,identity_version,tenant_id,membership_id,membership_version,audience,tenant_version,created_at,last_seen_at,expires_at)
      VALUES($1,$2,$3,1,$4,$5,1,'customer',1,$6,$7,$8)`, [tokenHash(token), tokenHash(csrf), identity, tenants[0], memberships[0], created, now, expires]);
    const snapshot = async () => Number((await db.query('SELECT count(*) AS n FROM pilot.sessions WHERE identity_id=$1', [identity])).rows[0].n);
    const originalCount = await snapshot();
    await db.query('BEGIN'); await assert.rejects(rotateCustomerSession(db, token, tenants[2]!, now, async () => status), /Denied/); await db.query('ROLLBACK');
    assert.equal(await snapshot(), originalCount);
    await db.query('BEGIN'); const switched = await rotateCustomerSession(db, token, tenants[1]!, now, async () => status); await db.query('COMMIT');
    assert.notEqual(switched.token, token); assert.notEqual(switched.csrf, csrf); assert.match(switched.token, /^[a-f0-9]{64}$/);
    const saved = (await db.query('SELECT * FROM pilot.sessions WHERE token_hash=$1', [tokenHash(switched.token)])).rows[0];
    assert.equal(saved.csrf_hash, tokenHash(switched.csrf)); assert.equal(saved.created_at.getTime(), created.getTime()); assert.equal(saved.expires_at.getTime(), expires.getTime());
    await db.query('BEGIN'); await assert.rejects(requireCustomer(db, token, now, async () => status), /Denied/); await db.query('ROLLBACK');
    await db.query('BEGIN'); const context = await requireCustomer(db, switched.token, now, async () => status); await db.query('COMMIT');
    assert.equal(context.tenantId, tenants[1]); assert.equal(context.role, 'Employee');
    const independent = randomBytes(32).toString('hex');
    await db.query(`INSERT INTO pilot.sessions(token_hash,csrf_hash,identity_id,identity_version,tenant_id,membership_id,membership_version,audience,tenant_version,created_at,last_seen_at,expires_at)
      SELECT $1,csrf_hash,identity_id,identity_version,tenant_id,membership_id,membership_version,audience,tenant_version,created_at,last_seen_at,expires_at
      FROM pilot.sessions WHERE token_hash=$2`, [tokenHash(independent), tokenHash(token)]);
    await db.query('UPDATE pilot.memberships SET active=false,version=version+1 WHERE id=$1', [memberships[1]]);
    await db.query('BEGIN'); await assert.rejects(requireCustomer(db, switched.token, now, async () => status), /Denied/); await db.query('ROLLBACK');
    assert.equal((await db.query('SELECT active FROM pilot.memberships WHERE id=$1', [memberships[0]])).rows[0].active, true);
    await db.query('BEGIN'); assert.equal((await requireCustomer(db, independent, now, async () => status)).tenantId, tenants[0]); await db.query('COMMIT');
    await db.query('UPDATE pilot.tenants SET active=false,version=version+1 WHERE id=$1', [tenants[0]]);
    await db.query('UPDATE pilot.tenants SET active=true,version=version+1 WHERE id=$1', [tenants[0]]);
    await db.query('BEGIN'); await assert.rejects(requireCustomer(db, independent, now, async () => status), /Denied/); await db.query('ROLLBACK');
    for (const first of ['switch', 'removal']) await t.test(`${first} commits first at the switch/removal barrier`, async () => {
      const remover = await connectFixture(), observer = await connectFixture(true);
      const actor = (await db.query('INSERT INTO pilot.identities(subject,verified) VALUES($1,true) RETURNING id', [randomUUID()])).rows[0];
      const actorStatus = { ...status, subject: (await db.query('SELECT subject FROM pilot.identities WHERE id=$1', [actor.id])).rows[0].subject };
      const workspaces: string[] = [], grants: string[] = [];
      for (const name of ['Barrier A', 'Barrier B']) {
        const workspace = (await db.query('INSERT INTO pilot.tenants(name) VALUES($1) RETURNING id', [name])).rows[0].id;
        workspaces.push(workspace);
        grants.push((await db.query("INSERT INTO pilot.memberships(tenant_id,identity_id,role) VALUES($1,$2,'Employee') RETURNING id", [workspace, actor.id])).rows[0].id);
      }
      const source = randomBytes(32).toString('hex'), control = randomBytes(32).toString('hex');
      for (const value of [source, control]) await db.query(`INSERT INTO pilot.sessions(token_hash,csrf_hash,identity_id,identity_version,tenant_id,tenant_version,membership_id,membership_version,audience,created_at,last_seen_at,expires_at)
        VALUES($1,$1,$2,1,$3,1,$4,1,'customer',$5,$5,$6)`, [tokenHash(value), actor.id, workspaces[0], grants[0], now, expires]);
      const waitFor = async (waiter: number, blocker: number) => {
        for (let i = 0; i < 100; i++) {
          if ((await observer.query('SELECT $2::int=ANY(pg_blocking_pids($1)) AS waiting', [waiter, blocker])).rows[0].waiting) return;
          await setTimeout(10);
        }
        assert.fail('The competing AppDB transaction must wait for this authority holder');
      };
      const remove = async () => {
        await lockIdentities(remover, [actor.id]);
        await remover.query('SELECT id FROM pilot.tenants WHERE id=$1 FOR UPDATE', [workspaces[1]]);
        await remover.query('SELECT id FROM pilot.memberships WHERE id=$1 FOR UPDATE', [grants[1]]);
        await remover.query('UPDATE pilot.memberships SET active=false,version=version+1 WHERE id=$1', [grants[1]]);
      };
      try {
        const switchPid = (await db.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        const removePid = (await remover.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
        let rotated: { token: string; csrf: string } | undefined;
        await db.query('BEGIN'); await remover.query('BEGIN');
        if (first === 'switch') {
          rotated = await rotateCustomerSession(db, source, workspaces[1]!, now, async () => actorStatus);
          const removing = remove();
          await waitFor(removePid, switchPid); await db.query('COMMIT'); await removing; await remover.query('COMMIT');
        } else {
          await remove();
          const switching = assert.rejects(rotateCustomerSession(db, source, workspaces[1]!, now, async () => actorStatus), /Denied/);
          await waitFor(switchPid, removePid); await remover.query('COMMIT'); await switching; await db.query('ROLLBACK');
        }
        const rows = (await db.query('SELECT token_hash,tenant_id,revoked_at FROM pilot.sessions WHERE identity_id=$1', [actor.id])).rows;
        assert.equal(rows.length, first === 'switch' ? 3 : 2);
        assert.equal(rows.filter(row => row.tenant_id === workspaces[1]).length, first === 'switch' ? 1 : 0);
        assert.equal(Boolean(rows.find(row => row.token_hash === tokenHash(source))!.revoked_at), first === 'switch');
        assert.deepEqual((await db.query('SELECT active,version FROM pilot.memberships WHERE id=$1', [grants[1]])).rows[0], { active: false, version: 2 });
        await db.query('BEGIN');
        assert.equal((await requireCustomer(db, control, now, async () => actorStatus)).tenantId, workspaces[0]);
        await db.query('COMMIT');
        if (rotated) {
          await db.query('BEGIN'); await assert.rejects(requireCustomer(db, rotated.token, now, async () => actorStatus), /Denied/); await db.query('ROLLBACK');
          await remover.query('UPDATE pilot.memberships SET active=true,version=version+1 WHERE id=$1', [grants[1]]);
          await db.query('BEGIN'); await assert.rejects(requireCustomer(db, rotated.token, now, async () => actorStatus), /Denied/); await db.query('ROLLBACK');
        } else {
          await db.query('BEGIN'); assert.equal((await requireCustomer(db, source, now, async () => actorStatus)).tenantId, workspaces[0]); await db.query('COMMIT');
        }
      } finally { await db.query('ROLLBACK'); await remover.query('ROLLBACK'); await remover.end(); await observer.end(); }
    });
  } finally { await db.query('ROLLBACK'); await db.end(); }
});
