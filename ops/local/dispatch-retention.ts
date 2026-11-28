import { uuid } from '../../packages/contracts/management.js';
import { connectFixture, loadFixture, runIsolatedFixture, usesLocalDocker } from './fixture.js';

function requireRetentionFixture(fixture: Awaited<ReturnType<typeof loadFixture>>) {
  if (fixture.purpose !== 'dispatch-retention' || fixture.restoreTarget || fixture.pairedRestore) {
    throw new Error('Dedicated dispatch retention fixture required');
  }
}

// Only isolated tests supply a controlled expiry clock. The CLI uses PostgreSQL time.
export async function retireDispatchDetails(occurrenceId: string, clock?: () => string) {
  if (!uuid(occurrenceId)) throw new Error('Exact occurrence ID required');
  const fixture = await loadFixture();
  requireRetentionFixture(fixture);
  const db = await connectFixture(true);
  try {
    await db.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    await db.query('SELECT pg_advisory_xact_lock_shared(114, 1)');
    const marker = await db.query(`SELECT 1 FROM public.fixture_identity
      WHERE id=$1 AND purpose='dispatch-retention' AND NOT restore_target
        AND current_database()='pilot_fixture' AND current_user='pilot_owner' FOR SHARE`, [fixture.id]);
    if (marker.rowCount !== 1) throw new Error('Dispatch retention database marker mismatch');

    // Claim, export, hold and reconciliation all take the occurrence lock before inspecting the attempt.
    const occurrence = await db.query<{ tenant_id: string; state: string }>(`SELECT tenant_id,state
      FROM pilot.occurrences WHERE id=$1 FOR UPDATE`, [occurrenceId]);
    const target = occurrence.rows[0];
    const result = await (async () => {
      if (!target || (target.state !== 'confirmed' && target.state !== 'rejected')) return 'ineligible';
      const key = [target.tenant_id, occurrenceId, target.state];
      const attempt = await db.query<{ details_retired: boolean }>(`SELECT a.details_retired
        FROM pilot.attempts a WHERE a.tenant_id=$1 AND a.occurrence_id=$2 AND a.outcome=$3
          AND NOT EXISTS (SELECT 1 FROM pilot.occurrence_decisions h
            WHERE h.tenant_id=a.tenant_id AND h.occurrence_id=a.occurrence_id AND h.approval_id IS NULL)
        FOR UPDATE OF a`, key);
      if (!attempt.rows[0]) return 'ineligible';
      if (attempt.rows[0].details_retired) return 'already-retired';
      const update = await db.query(`UPDATE pilot.attempts a SET details_retired=true,
        id=NULL,approval_id=NULL,claimed_at=NULL,observed_at=NULL,resolved_at=NULL,resource_name=NULL
        FROM pilot.occurrences o JOIN pilot.approvals p
          ON p.tenant_id=o.tenant_id AND p.occurrence_id=o.id AND p.id=o.approval_id
            AND p.draft_id=o.draft_id AND p.location_id=o.location_id AND p.due_at=o.due_at AND p.timezone=o.timezone
        WHERE a.tenant_id=$1 AND a.occurrence_id=$2 AND a.outcome=$3
          AND o.tenant_id=a.tenant_id AND o.id=a.occurrence_id AND o.state=a.outcome AND p.id=a.approval_id
          AND isfinite(a.claimed_at) AND isfinite(a.observed_at) AND a.observed_at>=a.claimed_at
          AND a.resolved_at>=a.claimed_at AND (a.outcome='rejected' OR a.resource_name IS NOT NULL)
          AND a.resolved_at + interval '2160 hours' <= COALESCE($4::timestamptz,clock_timestamp())`,
      [...key, clock?.() ?? null]);
      return update.rowCount === 1 ? 'retired' : 'ineligible';
    })();
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  } finally { await db.end(); }
}

async function main() {
  const occurrenceId = process.argv[2];
  if (process.argv.length !== 3 || !occurrenceId || !uuid(occurrenceId)) {
    throw new Error('Usage: pilot:retire-dispatch-details -- <occurrence-id>');
  }
  if (process.env.PILOT_CONTAINER === '1') {
    console.log(await retireDispatchDetails(occurrenceId));
    return;
  }
  const fixture = await loadFixture();
  requireRetentionFixture(fixture);
  if (!usesLocalDocker()) throw new Error('Dispatch retention requires a local Docker socket');
  const { output } = runIsolatedFixture(fixture, ['dist/pilot/ops/local/dispatch-retention.js', occurrenceId], true);
  console.log(output);
}

if (require.main === module) main().catch(() => {
  console.error('Fixture dispatch retention refused or failed.');
  process.exitCode = 1;
});
