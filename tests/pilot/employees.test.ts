import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createServer, request } from 'node:https';
import { test } from 'node:test';
import { setTimeout } from 'node:timers/promises';
import type { Client } from 'pg';
import { revokeEmployeeMembership } from '../../apps/web/src/routes/employee-revocation.js';
import { createCustomerApp } from '../../apps/web/src/server/customer.js';
import { lockIdentities, tokenHash } from '../../apps/web/src/server/session.js';
import type { CustomerRequest } from '../../apps/web/src/server/request.js';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';

test('private Employee revocation invalidates only the selected tenant grant and its pending invitations', async t => {
  if (process.env.PILOT_CONTAINER !== '1') {
    console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/employees.test.js']));
    return;
  }
  const db = await connectFixture();
  t.after(() => db.end());
  const owner = await connectFixture(true);
  t.after(() => owner.end());
  const now = new Date();
  const fresh = new Date(now.getTime() - 300_000);
  const inspect = async (subject: string) => ({
    subject, enabled: true, verified: true, requiredActions: [], credentials: [{ id: 'fixture-otp', type: 'otp' }]
  });
  const identity = async () => {
    const subject = randomUUID();
    const id = (await db.query<{ id: string }>('INSERT INTO pilot.identities(subject,verified) VALUES($1,true) RETURNING id', [subject])).rows[0]!.id;
    return { id, subject };
  };
  const [workspaceA, workspaceB] = (await db.query<{ id: string }>(
    "INSERT INTO pilot.tenants(name) VALUES('Revocation A'),('Revocation B') RETURNING id")).rows;
  assert.ok(workspaceA && workspaceB);
  const a = workspaceA.id, b = workspaceB.id;
  const manager = await identity(), otherManager = await identity(), employee = await identity(), admin = await identity();
  const membership = async (tenant: string, user: string, role: 'Employee' | 'Manager') =>
    (await db.query<{ id: string }>('INSERT INTO pilot.memberships(tenant_id,identity_id,role) VALUES($1,$2,$3) RETURNING id',
      [tenant, user, role])).rows[0]!.id;
  const managerA = await membership(a, manager.id, 'Manager');
  const managerB = await membership(b, manager.id, 'Manager');
  const targetA = await membership(a, employee.id, 'Employee');
  const targetB = await membership(b, employee.id, 'Employee');
  const managerTarget = await membership(a, otherManager.id, 'Manager');
  const session = async (tenant: string, id: string, member: string, mfaAt: Date | null = fresh, factor = 'fixture-otp', version = 1) => {
    const token = randomBytes(32).toString('hex'), csrf = randomBytes(32).toString('hex');
    await db.query(`INSERT INTO pilot.sessions(token_hash,csrf_hash,identity_id,identity_version,tenant_id,tenant_version,
      membership_id,membership_version,audience,created_at,last_seen_at,expires_at,mfa_at,mfa_credential_id)
      VALUES ($1,$2,$3,1,$4,1,$5,$10,'customer',$6,$6,$7,$8,$9)`, [tokenHash(token), tokenHash(csrf), id, tenant, member,
      new Date(now.getTime() - 600_000), new Date(now.getTime() + 3_600_000), mfaAt, factor, version]);
    return { token, csrf };
  };
  const managerSession = await session(a, manager.id, managerA);
  const staleSession = await session(a, manager.id, managerA, new Date(fresh.getTime() - 1));
  const missingProof = await session(a, manager.id, managerA, null);
  const wrongFactor = await session(a, manager.id, managerA, fresh, 'retired-factor');
  const employeeA = await session(a, employee.id, targetA);
  const employeeB = await session(b, employee.id, targetB);
  const recipient = 'employee-revocation@example.invalid';
  const recipientBySubject = new Map([[employee.subject, recipient]]);
  const grant = (await db.query<{ id: string }>('INSERT INTO pilot.platform_grants(identity_id) VALUES($1) RETURNING id',
    [admin.id])).rows[0]!.id;
  const invitation = async (tenant: string, issuer: string | null, options: {
    email?: string; state?: 'consumed' | 'revoked' | 'expired'; role?: 'Manager'; grant?: string
  } = {}, connection = db) => (await connection.query<{ id: string }>(`INSERT INTO pilot.invitations(tenant_id,email,role,purpose,issuer_membership_id,
    issuer_platform_grant_id,issuer_version,grant_version,token_hash,created_at,expires_at,consumed_at,revoked_at)
    VALUES($1,$2,$3,'membership',$4,$5,1,1,$6,$7,$8,$9,$10) RETURNING id`,
  [tenant, options.email ?? recipient, options.role ?? 'Employee', issuer, options.grant ?? null,
    tokenHash(randomBytes(32).toString('hex')), new Date(now.getTime() - 60_000),
    new Date(now.getTime() + (options.state === 'expired' ? -1 : 3_600_000)),
    options.state === 'consumed' ? now : null, options.state === 'revoked' ? now : null])).rows[0]!.id;
  const pending = await invitation(a, managerA);
  const otherIssuerPending = await invitation(a, managerTarget);
  const adminPending = await invitation(a, null, { grant });
  await invitation(a, managerA, { state: 'consumed' });
  await invitation(a, managerA, { state: 'revoked' });
  await invitation(a, managerA, { state: 'expired' });
  await invitation(a, managerA, { email: 'other-revocation@example.invalid' });
  await invitation(a, null, { grant, role: 'Manager' });
  await invitation(b, managerB);
  await db.query("INSERT INTO pilot.audit(tenant_id,actor_id,action,reason,outcome) VALUES($1,$2,'fixture_history','prior evidence','recorded')",
    [a, manager.id]);
  await db.query("INSERT INTO pilot.audit(tenant_id,actor_id,action,reason,outcome) VALUES($1,$2,'fixture_history','other tenant evidence','recorded')",
    [b, manager.id]);

  const snapshot = async () => ({
    memberships: (await db.query('SELECT * FROM pilot.memberships WHERE tenant_id=ANY($1::uuid[]) ORDER BY tenant_id,id', [[a, b]])).rows,
    invitations: (await db.query(`SELECT tenant_id,id,email,role,purpose,issuer_membership_id,issuer_platform_grant_id,
      issuer_version,grant_version,created_at,expires_at,consumed_at,revoked_at FROM pilot.invitations
      WHERE tenant_id=ANY($1::uuid[]) ORDER BY tenant_id,id`, [[a, b]])).rows,
    audit: (await db.query('SELECT * FROM pilot.audit WHERE tenant_id=ANY($1::uuid[]) ORDER BY tenant_id,id', [[a, b]])).rows,
    sessions: (await db.query('SELECT id,identity_id,tenant_id,membership_id,membership_version,revoked_at FROM pilot.sessions WHERE tenant_id=ANY($1::uuid[]) ORDER BY id',
      [[a, b]])).rows
  });
  const revoke = async (actor: CustomerRequest, target: string, connection = db, recipients: ReadonlyMap<string, string> = recipientBySubject) => {
    await connection.query('BEGIN');
    try {
      const result = await revokeEmployeeMembership(connection, actor, target, () => now, inspect, recipients);
      await connection.query('COMMIT');
      return result;
    } catch (error) {
      await connection.query('ROLLBACK');
      throw error;
    }
  };
  const cert = await readFile('work/pilot/customer.crt');
  const server = createServer({ cert, key: await readFile('work/pilot/customer.key') }, createCustomerApp(() => connectFixture(), inspect));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const status = (binding: CustomerRequest, path = '/customer', method = 'GET') => new Promise<number>((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port: address.port, servername: 'customer', path, method, ca: cert, timeout: 5000,
      headers: { host: 'customer:8443', origin: 'https://customer:8443', cookie: `__Host-session=${binding.token}; __Host-csrf=${binding.csrf}` }
    }, response => { response.resume(); response.on('end', () => resolve(response.statusCode!)); });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Protected read timed out')));
    req.end();
  });

  assert.equal(await status(employeeA), 200);
  assert.equal(await status(employeeB), 200);
  assert.equal(await status(managerSession, `/customer/employees/${targetA}`, 'DELETE'), 404);
  const before = await snapshot();
  for (const [actor, target] of [
    [managerSession, targetB], [managerSession, managerTarget], [employeeA, targetA], [staleSession, targetA],
    [missingProof, targetA], [wrongFactor, targetA], [{ ...managerSession, csrf: employeeA.csrf }, targetA]
  ] as const) await assert.rejects(revoke(actor, target), { message: 'Denied' });
  await assert.rejects(revoke(managerSession, targetA, db, new Map()), { message: 'Denied' });
  await assert.rejects(revoke(managerSession, targetA, db, new Map([[employee.subject, 'invalid@example..invalid']])),
    { message: 'Denied' });
  assert.deepEqual(await snapshot(), before);

  // The competing role change must be observed after the target identity lock is granted.
  const writer = await connectFixture();
  t.after(() => writer.end());
  const waiter = (await db.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
  const holder = (await writer.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')).rows[0]!.pid;
  const waitForWriter = async () => {
    for (let attempt = 0; attempt < 100; attempt++) {
      const blockers = (await owner.query<{ ids: number[] }>('SELECT pg_blocking_pids($1) AS ids', [waiter])).rows[0]!.ids;
      if (blockers.includes(holder)) return;
      await setTimeout(10);
    }
    assert.fail('Revocation must visibly wait for the competing transaction');
  };
  await writer.query('BEGIN');
  let denied: Promise<void> | undefined;
  try {
    await lockIdentities(writer, [employee.id]);
    await writer.query("UPDATE pilot.memberships SET role='Manager',version=version+1 WHERE tenant_id=$1 AND id=$2", [a, targetA]);
    denied = assert.rejects(revoke(managerSession, targetA), { message: 'Denied' });
    void denied.catch(() => {});
    await waitForWriter();
    await writer.query('COMMIT');
    await denied;
  } finally {
    await writer.query('ROLLBACK');
    await denied?.catch(() => {});
  }
  const promoted = await snapshot();
  assert.deepEqual(promoted, { ...before, memberships: before.memberships.map(row =>
    row.tenant_id === a && row.id === targetA ? { ...row, role: 'Manager', version: 2 } : row) });
  await writer.query("UPDATE pilot.memberships SET role='Employee',version=version+1 WHERE tenant_id=$1 AND id=$2", [a, targetA]);
  const currentEmployeeA = await session(a, employee.id, targetA, fresh, undefined, 3);
  assert.equal(await status(currentEmployeeA), 200);

  const ready = await snapshot();
  await owner.query("ALTER TABLE pilot.audit ADD CONSTRAINT fixture_reject_revocation CHECK (action <> 'employee_membership_revoked') NOT VALID");
  try {
    await assert.rejects(revoke(managerSession, targetA), { code: '23514', constraint: 'fixture_reject_revocation' });
    assert.deepEqual(await snapshot(), ready);
    assert.equal(await status(currentEmployeeA), 200);
  } finally { await owner.query('ALTER TABLE pilot.audit DROP CONSTRAINT fixture_reject_revocation'); }

  // Issuance that holds the tenant authority lock may commit first. Its invitation must still be canceled.
  await writer.query('BEGIN');
  let newPending: string;
  let revoking: Promise<boolean> | undefined;
  try {
    await lockIdentities(writer, [otherManager.id]);
    await writer.query('SELECT id FROM pilot.tenants WHERE id=$1 FOR SHARE', [a]);
    newPending = await invitation(a, managerTarget, {}, writer);
    revoking = revoke(managerSession, targetA);
    void revoking.catch(() => {});
    await waitForWriter();
    await writer.query('COMMIT');
    assert.equal(await revoking, true);
  } finally {
    await writer.query('ROLLBACK');
    await revoking?.catch(() => {});
  }
  const after = await snapshot();
  const affected = new Set([pending, otherIssuerPending, adminPending]);
  assert.deepEqual(after.memberships, ready.memberships.map(row =>
    row.tenant_id === a && row.id === targetA ? { ...row, active: false, version: 4 } : row));
  assert.deepEqual(after.invitations.filter(row => row.id !== newPending), ready.invitations.map(row =>
    row.tenant_id === a && affected.has(row.id) ? { ...row, revoked_at: now } : row));
  assert.deepEqual(after.invitations.find(row => row.id === newPending)?.revoked_at, now);
  assert.deepEqual(after.sessions, ready.sessions);
  assert.deepEqual(after.audit.filter(row => row.action !== 'employee_membership_revoked'), ready.audit);
  const events = after.audit.filter(row => row.action === 'employee_membership_revoked');
  assert.equal(events.length, 1);
  assert.equal(events[0].tenant_id, a);
  assert.equal(events[0].actor_id, manager.id);
  assert.match(events[0].reason, new RegExp(targetA));
  assert.equal(events[0].outcome, 'revoked');
  assert.equal(await status(currentEmployeeA), 403);
  assert.equal(await status(employeeB), 200);
  assert.equal(await revoke(managerSession, targetA), false);
  assert.deepEqual(await snapshot(), after);
  assert.equal(await status(managerSession), 200);
});
