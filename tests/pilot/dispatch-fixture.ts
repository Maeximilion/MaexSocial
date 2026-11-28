import { randomBytes } from 'node:crypto';
import { approveOccurrence, readApprovalProposal } from '../../apps/web/src/routes/content.js';
import { requireCustomerRequest, type CustomerRequest } from '../../apps/web/src/server/request.js';
import { tokenHash } from '../../apps/web/src/server/session.js';
import { connectFixture } from '../../ops/local/fixture.js';
import type { InspectIdentity } from '../../packages/contracts/pilot.js';
import { occurrence, seedTenant } from './fixtures.js';

export const clock = () => new Date('2020-01-01T10:00:00Z');
export const inspect: InspectIdentity = async subject => ({
  subject, verified: true, enabled: true, requiredActions: [], credentials: [{ id: 'synthetic-otp', type: 'otp' }],
});
export const binding = () => ({ token: randomBytes(32).toString('hex'), csrf: randomBytes(32).toString('hex') });

export interface Case {
  id: string;
  approvalId: string;
  tenant: string;
  user: string;
  revision: string;
}

export async function seedDispatchApproval(request: CustomerRequest, grant: boolean): Promise<Case> {
  const owner = await connectFixture(true);
  try {
    const f = await seedTenant(owner);
    const id = await occurrence(owner, f);
    await owner.query("UPDATE pilot.occurrences SET due_at='2020-01-01T12:00Z' WHERE id=$1", [id]);
    if (grant) await owner.query('UPDATE pilot.locations SET grant_active=true,version=version+1 WHERE id=$1', [f.location]);
    await owner.query('UPDATE pilot.identities SET verified=true,version=version+1 WHERE id=$1', [f.user]);
    await owner.query(`INSERT INTO pilot.sessions(token_hash,csrf_hash,identity_id,identity_version,tenant_id,tenant_version,
      membership_id,membership_version,audience,created_at,last_seen_at,expires_at,mfa_at,mfa_credential_id)
      VALUES($1,$2,$3,2,$4,1,$5,1,'customer','2020-01-01T09:55Z','2020-01-01T09:56Z',
        '2020-01-01T11:00Z','2020-01-01T09:59Z','synthetic-otp')`,
    [tokenHash(request.token), tokenHash(request.csrf), f.user, f.tenant, f.membership]);
    const approvalId = await approveDispatchOccurrence(request, id);
    return { id, approvalId, tenant: f.tenant, user: f.user, revision: f.revision };
  } finally { await owner.end(); }
}

export async function approveDispatchOccurrence(request: CustomerRequest, id: string) {
  const app = await connectFixture();
  const proposal = await (async () => {
    try {
      await app.query('BEGIN');
      return await readApprovalProposal(app, await requireCustomerRequest(app, request, clock, inspect, 'read-only'), id);
    } finally { await app.end(); }
  })();
  return approveOccurrence(connectFixture, request, proposal, clock, inspect);
}
