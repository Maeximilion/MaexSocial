import { uuid } from '../../packages/contracts/management.js';
import { connectFixture, loadFixture, runIsolatedFixture, usesLocalDocker } from './fixture.js';

function requireAuditFixture(fixture: Awaited<ReturnType<typeof loadFixture>>) {
  if (fixture.purpose !== 'audit-retention' || fixture.restoreTarget || fixture.pairedRestore) {
    throw new Error('Dedicated audit retention fixture required');
  }
}

// Only the isolated drill injects a clock. The operational entry point uses database time.
export async function expireAuditEvent(tenant: string, event: string, clock?: () => string) {
  if (!uuid(tenant) || !uuid(event)) throw new Error('Exact tenant and event IDs required');
  const fixture = await loadFixture();
  requireAuditFixture(fixture);
  const db = await connectFixture(true);
  try {
    await db.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    await db.query('SELECT pg_advisory_xact_lock_shared(114, 1)');
    const marker = await db.query(`SELECT 1 FROM public.fixture_identity WHERE id=$1 AND purpose='audit-retention'
      AND NOT restore_target AND current_database()='pilot_fixture' AND current_user='pilot_owner' FOR SHARE`, [fixture.id]);
    if (marker.rowCount !== 1) throw new Error('Audit retention database marker mismatch');
    // UPDATE rechecks the committed incident disposition after a competing row lock.
    const permit = await db.query(`UPDATE pilot.fixture_audit_disposition d
      SET expiry_xid=pg_current_xact_id(),checked_at=t.instant
      FROM pilot.audit a, (SELECT COALESCE($4::timestamptz,statement_timestamp()) AS instant) t
      WHERE d.fixture_id=$1 AND d.tenant_id=$2 AND d.audit_id=$3 AND d.incident_state='clear'
        AND (a.tenant_id,a.id)=(d.tenant_id,d.audit_id)
        AND a.created_at=d.event_at AND isfinite(t.instant) AND t.instant-d.event_at >= interval '2160 hours'`,
    [fixture.id, tenant, event, clock?.() ?? null]);
    if (permit.rowCount === 1) {
      const deleted = await db.query('DELETE FROM pilot.audit WHERE tenant_id=$1 AND id=$2', [tenant, event]);
      if (deleted.rowCount !== 1) throw new Error('Audit expiry was not applied');
    }
    await db.query('COMMIT');
    return permit.rowCount === 1 ? 'expired' : 'ineligible';
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally { await db.end(); }
}

async function main() {
  const [, , tenant, event] = process.argv;
  if (process.argv.length !== 4 || !tenant || !event || !uuid(tenant) || !uuid(event)) {
    throw new Error('Expected exact tenant and audit event IDs');
  }
  if (process.env.PILOT_CONTAINER === '1') {
    console.log(await expireAuditEvent(tenant, event));
    return;
  }
  const fixture = await loadFixture();
  requireAuditFixture(fixture);
  if (!usesLocalDocker()) throw new Error('Audit retention requires a local Docker socket');
  console.log(runIsolatedFixture(fixture, ['dist/pilot/ops/local/audit-retention.js', tenant, event], true).output);
}

if (require.main === module) main().catch(() => {
  console.error('Fixture audit retention refused or failed.');
  process.exitCode = 1;
});
