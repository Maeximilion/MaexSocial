import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { tokenHash } from '../../apps/web/src/server/session.js';
import type { ManagementContext, ManagementSessionContext } from '../../packages/contracts/management.js';

export async function withProbeView(db: Client, check: () => Promise<void>): Promise<void> {
  let created = false;
  try {
    await db.query("CREATE MATERIALIZED VIEW pilot.saved AS SELECT 'retained synthetic fixture' AS value");
    created = true;
    await check();
  } finally { if (created) await db.query('DROP MATERIALIZED VIEW pilot.saved'); }
}

export async function seedTenant(db: Client) {
  const tenant = randomUUID();
  const user = randomUUID();
  const membership = randomUUID();
  const location = randomUUID();
  const draft = randomUUID();
  const revision = randomUUID();
  await db.query('INSERT INTO pilot.tenants(id, name) VALUES ($1,$2)', [tenant, 'Invented fixture business']);
  await db.query('INSERT INTO pilot.identities(id, subject) VALUES ($1,$2)', [user, `fixture-${user}`]);
  await db.query("INSERT INTO pilot.memberships(tenant_id,id,identity_id,role) VALUES ($1,$2,$3,'Manager')", [tenant, membership, user]);
  const employee = randomUUID();
  await db.query('INSERT INTO pilot.identities(id, subject) VALUES ($1,$2)', [employee, `fixture-${employee}`]);
  await db.query("INSERT INTO pilot.memberships(tenant_id,identity_id,role) VALUES ($1,$2,'Employee')", [tenant, employee]);
  await db.query('INSERT INTO pilot.locations(tenant_id,id,provider_location) VALUES ($1,$2,$3)', [tenant, location, 'fake-location']);
  await db.query('INSERT INTO pilot.drafts(tenant_id,id) VALUES ($1,$2)', [tenant, draft]);
  await db.query("INSERT INTO pilot.draft_revisions(tenant_id,id,draft_id,revision,text) VALUES ($1,$2,$3,1,'Invented plain text')", [tenant, revision, draft]);
  return { tenant, user, membership, location, draft, revision };
}

export async function occurrence(db: Client, f: Awaited<ReturnType<typeof seedTenant>>, key = randomUUID()) {
  const result = await db.query(`INSERT INTO pilot.occurrences(tenant_id,draft_id,location_id,creation_key,due_at,timezone)
    VALUES ($1,$2,$3,$4,'2030-01-01T12:00:00Z','Europe/Berlin') RETURNING id`, [f.tenant, f.draft, f.location, key]);
  return result.rows[0].id as string;
}

export async function reserveSyntheticJob(db: Client, tenantId: string, operationKey: string, units: number): Promise<boolean> {
  if (!Number.isSafeInteger(units) || units <= 0) throw new RangeError('Invalid synthetic reservation units');
  await db.query('BEGIN ISOLATION LEVEL READ COMMITTED');
  try {
    // Read the ledger in a fresh statement after competing reservations release the budget lock.
    const budget = await db.query<{ synthetic_units: string }>(
      'SELECT synthetic_units FROM pilot.budgets WHERE tenant_id=$1 FOR UPDATE', [tenantId]);
    let reserved = false;
    if (budget.rowCount === 1) {
      const result = await db.query(`INSERT INTO pilot.budget_reservations(tenant_id,operation_key,units)
        SELECT $1,$2,$3::bigint WHERE $3::bigint + (
          SELECT COALESCE(SUM(CASE WHEN state='settled' THEN COALESCE(settled_units,units) ELSE units END),0)
          FROM pilot.budget_reservations WHERE tenant_id=$1 AND state <> 'released'
        ) <= $4::bigint ON CONFLICT (tenant_id,operation_key) DO NOTHING`,
      [tenantId, operationKey, units, budget.rows[0]!.synthetic_units]);
      reserved = result.rowCount === 1;
    }
    await db.query('COMMIT');
    return reserved;
  } catch (error) { await db.query('ROLLBACK'); throw error; }
}

export async function settleSyntheticJob(db: Client, tenantId: string, operationKey: string, cost: number | null): Promise<boolean> {
  if (cost !== null && (!Number.isSafeInteger(cost) || cost < 0)) throw new RangeError('Invalid synthetic settlement cost');
  // Settlement never increases the units counted against the cap by a concurrent reservation.
  const result = await db.query(`UPDATE pilot.budget_reservations
    SET state=CASE WHEN observed.cost IS NULL THEN 'unknown' ELSE 'settled' END, settled_units=observed.cost
    FROM (VALUES ($3::bigint)) AS observed(cost)
    WHERE tenant_id=$1 AND operation_key=$2
      AND (state='reserved' OR (state='unknown' AND observed.cost IS NOT NULL))
      AND (observed.cost IS NULL OR observed.cost <= units)`, [tenantId, operationKey, cost]);
  return result.rowCount === 1;
}

// Only isolated tests seed the context normally produced by the private listener.
export async function seedManagementContext(db: Client, tenantId: string, now: Date, stepUp: Date): Promise<ManagementContext> {
  return { ...await seedManagementSession(db, now, stepUp), tenantId, tenantVersion: 1 };
}

export async function seedManagementSession(db: Client, now: Date, stepUp: Date): Promise<ManagementSessionContext> {
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
  return { sessionId, identityId, deviceId, deviceVersion: 1, grantId, grantVersion: 1, phishingResistantAt: stepUp };
}
