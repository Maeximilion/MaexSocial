import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open, readFile, unlink } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { tmpdir } from 'node:os';
import { connectFixture, requireWorkerFixtureDatabase } from '../../../ops/local/fixture.js';
import { uuid } from '../../../packages/contracts/management.js';
import type { GbpAttempt } from '../../../packages/contracts/pilot.js';

export interface GrantBinding { tenant: string; location: string; version: number }

export function grantDirectory(fixtureId: string, container: boolean) {
  if (!/^[a-f0-9]{32}$/.test(fixtureId)) throw new Error('Invalid disposable fixture');
  const name = 'maex-grants-' + fixtureId;
  return container ? posix.join('/dev/shm', name) : join(tmpdir(), name);
}

export function materialPath(fixtureId: string, { tenant, location, version }: GrantBinding) {
  if (!uuid(tenant) || !uuid(location) || !Number.isSafeInteger(version) || version < 1) {
    throw new Error('Invalid disposable binding');
  }
  return join(grantDirectory(fixtureId, true), `${tenant}-${location}-${version}`);
}

async function materialDigest(fixtureId: string, path: string) {
  // An absent mount is an unknown disposition, even when the version's file is also absent.
  if (await readFile(join(grantDirectory(fixtureId, true), 'fixture-id'), 'utf8') !== fixtureId) {
    throw new Error('Disposable store mismatch');
  }
  try {
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
      const stat = await file.stat();
      if (!stat.isFile() || stat.size !== 32 || (stat.mode & 0o777) !== 0o600) throw new Error('Invalid disposable material');
      return createHash('sha256').update(await file.readFile()).digest('hex');
    } finally { await file.close(); }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

// Lock the location and verifier through use. Take the verifier write lock up front for the readback counter.
// A committed revocation wins
// even if the dispatch claim committed earlier and has not yet reached create.
export async function withDisposableGrant<T>(fixtureId: string, attempt: GbpAttempt, operation: 'create' | 'readback',
  use: () => Promise<T>): Promise<T | null> {
  const db = await connectFixture(true);
  try {
    await db.query('BEGIN');
    await requireWorkerFixtureDatabase(db, fixtureId, 'grant-retirement');
    const { rows: [grant] } = await db.query<GrantBinding & { digest: string }>(`SELECT l.tenant_id AS tenant,
      l.id AS location,l.version,g.digest FROM pilot.attempts t
      JOIN pilot.approvals a ON (a.tenant_id,a.occurrence_id,a.id)=(t.tenant_id,t.occurrence_id,t.approval_id)
      JOIN pilot.locations l ON (l.tenant_id,l.id,l.version,l.provider_location)=
        (a.tenant_id,a.location_id,a.grant_version,a.provider_location)
      JOIN public.disposable_grants g ON (g.tenant,g.location,g.version)=(l.tenant_id,l.id,l.version)
      WHERE t.tenant_id=$1 AND t.occurrence_id=$2 AND t.id=$3 AND l.provider_location=$4
        AND l.grant_active AND g.revoked_at IS NULL FOR SHARE OF l FOR UPDATE OF g`,
    [attempt.tenantId, attempt.occurrenceId, attempt.attemptId, attempt.location]);
    if (!grant || await materialDigest(fixtureId, materialPath(fixtureId, grant)) !== grant.digest) return null;
    const result = await use();
    if (operation === 'readback') {
      await db.query('UPDATE public.disposable_grants SET readbacks=readbacks+1 WHERE tenant=$1 AND location=$2 AND version=$3',
        [grant.tenant, grant.location, grant.version]);
    }
    await db.query('COMMIT');
    return result;
  } finally { await db.end(); } // Closing also rolls back a refused or interrupted use.
}

export async function purgeDisposableGrant(fixtureId: string, binding: GrantBinding) {
  const path = materialPath(fixtureId, binding);
  const db = await connectFixture(true);
  try {
    await db.query('BEGIN');
    await requireWorkerFixtureDatabase(db, fixtureId, 'grant-retirement');
    const { rows: [grant] } = await db.query<{ digest: string }>(`SELECT g.digest FROM public.disposable_grants g
      JOIN pilot.locations l ON (l.tenant_id,l.id)=(g.tenant,g.location)
      WHERE g.tenant=$1 AND g.location=$2 AND g.version=$3 AND g.revoked_at IS NOT NULL AND l.version>g.version
      FOR SHARE OF l FOR UPDATE OF g`, [binding.tenant, binding.location, binding.version]);
    if (!grant) throw new Error('Unproven retirement');
    const digest = await materialDigest(fixtureId, path);
    if (digest !== null) {
      if (digest !== grant.digest) throw new Error('Disposable material mismatch');
      await unlink(path);
    }
    await db.query('COMMIT');
    return digest === null ? 'absent' : 'removed';
  } finally { await db.end(); }
}
