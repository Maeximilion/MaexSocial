import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';

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
