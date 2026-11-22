import type { Client } from 'pg';
import { deny, managementAssertion, readManagementSessionAuthority, requireValidManagementSession, uuid,
  type ManagementSessionContext } from './management.js';

export interface ManagementDirectoryContext extends ManagementSessionContext {
  action: 'organization_list';
}

interface OrganizationSummary {
  tenantId: string;
  name: string;
  active: boolean;
}

const pageSize = 50;

export async function listOrganizations(connect: () => Promise<Client>, proof: ManagementDirectoryContext,
  clock: () => Date, after: string | null = null): Promise<{
    organizations: OrganizationSummary[]; nextAfter: string | null;
  }> {
  proof = { ...proof };
  if (proof.action !== 'organization_list' || (after !== null && !uuid(after))) deny();
  const assertedAt = managementAssertion(proof);

  const db = await connect();
  try {
    // A single snapshot keeps each page consistent with the authority used to read it.
    await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const session = await readManagementSessionAuthority(db, proof);
    requireValidManagementSession(session, assertedAt, clock());
    const { rows } = await db.query<OrganizationSummary>(`
      SELECT id AS "tenantId",name,active FROM pilot.tenants
      WHERE ($1::uuid IS NULL OR id > $1) ORDER BY id LIMIT $2`, [after, pageSize + 1]);
    await db.query('COMMIT');

    const organizations = rows.slice(0, pageSize);
    return { organizations, nextAfter: rows.length > pageSize ? organizations.at(-1)!.tenantId : null };
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally {
    await db.end();
  }
}
