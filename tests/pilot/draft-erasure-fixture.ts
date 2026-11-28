import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { approveOccurrence, createDraft, editDraft, readApprovalProposal, renderDraft, renderDrafts, renderOccurrence } from '../../apps/web/src/routes/content.js';
import { requireCustomerRequest } from '../../apps/web/src/server/request.js';
import { claimExport } from '../../apps/web/src/server/occurrence-export.js';
import { claimDispatch } from '../../apps/worker/src/dispatch.js';
import { FakeGbp } from '../../apps/worker/src/fake-gbp.js';
import { wake } from '../../apps/worker/src/main.js';
import { connectFixture, loadFixture } from '../../ops/local/fixture.js';
import { eraseBoundDraft } from '../../ops/local/restore-history.js';
import { applySourceDraftErasure } from '../../ops/local/source-draft-erasure.js';
import { binding, clock, inspect, seedDispatchApproval } from './dispatch-fixture.js';

type Binding = ReturnType<typeof binding>;
type Proposal = Awaited<ReturnType<typeof readApprovalProposal>>;
type Draft = { draft: string; id: string; proposal: Proposal; hashes: string[] };
export type Samples = { auth: Binding; other: Binding; drafts: Draft[]; attempts: string[] };
const digest = (bytes: string) => createHash('sha256').update(bytes).digest('hex');

async function withContext<T>(auth: Binding, action: (db: Client, ctx: Awaited<ReturnType<typeof requireCustomerRequest>>) => Promise<T>) {
  const db = await connectFixture();
  try {
    await db.query('BEGIN');
    const value = await action(db, await requireCustomerRequest(db, auth, clock, inspect, 'read-only'));
    await db.query('COMMIT');
    return value;
  } finally { await db.end(); }
}

export async function seedSamples(): Promise<Samples> {
  const auth = binding(), other = binding();
  const a = await seedDispatchApproval(auth, true), b = await seedDispatchApproval(other, false);
  const drafts: Draft[] = [];
  // The first A destination permits dispatch. The other A destination permits private export.
  const owner = await connectFixture(true);
  try {
    const secondLocation = (await owner.query(`INSERT INTO pilot.locations(tenant_id,provider_location)
      VALUES($1,'local export only') RETURNING id`, [a.tenant])).rows[0].id;
    for (const [index, request] of [auth, auth, auth, other].entries()) {
      const location = index === 0 ? a.proposal.locationId : index === 3 ? b.proposal.locationId : secondLocation;
      const texts = [1, 2].map(n => 'Invented ' + index + '-' + n + ' ' + randomUUID());
      const sample = await withContext(request, async (db, ctx) => {
        const draft = await createDraft(db, ctx, location, texts[0]!);
        const first = (await db.query('SELECT id FROM pilot.draft_revisions WHERE tenant_id=$1 AND draft_id=$2',
          [ctx.tenantId, draft])).rows[0].id;
        await editDraft(db, ctx, draft, first, texts[1]!);
        const id: string = (await db.query(`INSERT INTO pilot.occurrences(tenant_id,draft_id,location_id,creation_key,due_at,timezone)
          VALUES($1,$2,$3,$4,'2020-01-01T09:00Z','UTC') RETURNING id`, [ctx.tenantId, draft, location, randomUUID()])).rows[0].id;
        return { draft, id, texts, proposal: await readApprovalProposal(db, ctx, id) };
      });
      await approveOccurrence(connectFixture, request, sample.proposal, clock, inspect);
      if (index !== 0) assert.ok((await claimExport(connectFixture, request, sample.id, clock, inspect)).text === texts[1]);
      drafts.push({ draft: sample.draft, id: sample.id, proposal: sample.proposal, hashes: texts.map(digest) });
    }
    await owner.query('UPDATE pilot.dispatch_control SET stopped=false WHERE singleton');
    const attempts = [];
    const fake = new FakeGbp(undefined, { frames: [{ afterMs: 0, candidates: ['LIVE'] }] });
    try {
      const d = drafts[0]!;
      for (let i = 0; i < 2; i++) {
        const p = await withContext(auth, async (db, ctx) => {
          const { rows: [o] } = await db.query(`INSERT INTO pilot.occurrences(tenant_id,draft_id,location_id,creation_key,due_at,timezone)
            VALUES($1,$2,$3,$4,'2020-01-01T10:00Z','UTC') RETURNING id`,
          [ctx.tenantId, d.draft, d.proposal.locationId, randomUUID()]);
          return readApprovalProposal(db, ctx, o.id);
        });
        await approveOccurrence(connectFixture, auth, p, clock, inspect);
        await claimDispatch(connectFixture, p.occurrenceId, fake);
        if (i === 0) assert.equal(await wake(p.occurrenceId), 'confirmed');
        attempts.push(p.occurrenceId);
      }
    } finally { fake.close(); }
    return { auth, other, drafts, attempts };
  } finally { await owner.end(); }
}

export async function issue(db: Client, samples: Samples, after: number) {
  const f = await loadFixture();
  assert.ok(f.purpose === 'backup' && !f.restoreTarget);
  await db.query('BEGIN');
  try {
    const authorizedAt = (await db.query('SELECT transaction_timestamp() AS instant')).rows[0].instant.toISOString();
    const records = samples.drafts.slice(0, 2).map((d, i) => ({
      seq: after + 1 + i, kind: 'erase-draft', tenantId: d.proposal.tenantId, id: d.draft, authorizedAt,
    }));
    const history = JSON.stringify({ schema: 1, fixtureId: f.id, after, through: after + records.length, records });
    for (const e of records) {
      await db.query(`INSERT INTO pilot.fixture_draft_erasure(source_id,tenant_id,draft_id,sequence,authorized_at,history_digest)
        VALUES($1,$2,$3,$4,$5,$6)`, [f.id, e.tenantId, e.id, e.seq, authorizedAt, digest(history)]);
    }
    await db.query('COMMIT');
    return history;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

export async function state(db: Client, samples: Samples, erased: boolean, target: boolean) {
  for (const [i, d] of samples.drafts.entries()) {
    const removed = erased && i < 2;
    const request = i === 3 ? samples.other : samples.auth;
    const scope = [d.proposal.tenantId, d.draft];
    const { rows } = await db.query('SELECT revision,text FROM pilot.draft_revisions WHERE tenant_id=$1 AND draft_id=$2 ORDER BY revision', scope);
    assert.ok(rows.length === 2 && rows.every((r, n) => r.revision === n + 1 && (removed ? r.text === null : digest(r.text) === d.hashes[n])),
      'Revision payloads differ from scoped expectations');
    const proof = await db.query(`SELECT num_nonnulls(mfa_at,created_at,grant_version,grant_active_at_approval) AS fields
      FROM pilot.approvals WHERE tenant_id=$1 AND draft_id=$2`, scope);
    assert.equal(proof.rowCount, i === 0 ? 3 : 1);
    assert.ok(proof.rows.every(row => row.fields === (removed ? 0 : 4)));
    const { rows: [copies] } = await db.query(`SELECT count(*)::int AS n FROM (
        SELECT to_jsonb(a)::text AS body FROM pilot.approvals a WHERE tenant_id=$1 AND draft_id=$2
        UNION ALL SELECT to_jsonb(o)::text FROM pilot.occurrences o WHERE tenant_id=$1 AND draft_id=$2
        UNION ALL SELECT to_jsonb(a)::text FROM pilot.attempts a JOIN pilot.occurrences o
          ON o.tenant_id=a.tenant_id AND o.id=a.occurrence_id WHERE o.tenant_id=$1 AND o.draft_id=$2
        UNION ALL SELECT to_jsonb(a)::text FROM pilot.audit a JOIN pilot.occurrences o
          ON o.tenant_id=a.tenant_id AND o.id=a.occurrence_id WHERE o.tenant_id=$1 AND o.draft_id=$2
      ) rows WHERE strpos(body,$3)>0`, [...scope, 'Invented ' + i + '-']);
    assert.equal(copies.n, 0);
    const durable = (await db.query(`SELECT o.state,to_jsonb(o)->>'restore_previous_state' AS prior,
      (SELECT count(*)::int FROM pilot.approvals a WHERE a.tenant_id=o.tenant_id AND a.occurrence_id=o.id) AS approvals,
      (SELECT count(*)::int FROM pilot.attempts a WHERE a.tenant_id=o.tenant_id AND a.occurrence_id=o.id) AS attempts,
      (SELECT count(*)::int FROM pilot.audit a WHERE a.tenant_id=o.tenant_id AND a.occurrence_id=o.id) AS audit
      FROM pilot.occurrences o WHERE tenant_id=$1 AND draft_id=$2 AND id=$3`, [...scope, d.id])).rows[0];
    const before = i === 0 ? 'approved' : 'exported';
    assert.deepEqual(durable, { state: target ? 'quarantined' : before, prior: target ? before : null,
      approvals: 1, attempts: 0, audit: i === 0 ? 0 : 1 });
    if (target) {
      await assert.rejects(withContext(request, (db, ctx) => renderDraft(db, ctx, d.draft, 'local')),
        (e: { code?: string }) => e.code === '28P01' || e.code === '28000');
      await assert.rejects(claimExport(connectFixture, request, d.id, clock, inspect),
        (e: { code?: string }) => e.code === '28P01' || e.code === '28000');
      continue;
    }
    if (removed) {
      await assert.rejects(withContext(request, (db, ctx) => renderDraft(db, ctx, d.draft, 'local')), /Denied/);
      await assert.rejects(withContext(request, (db, ctx) => editDraft(db, ctx, d.draft, d.proposal.revisionId, 'later')), /Denied/);
      await assert.rejects(withContext(request, (db, ctx) => readApprovalProposal(db, ctx, d.id)), /Denied/);
      await assert.rejects(approveOccurrence(connectFixture, request, d.proposal, clock, inspect), /Denied/);
      await assert.rejects(withContext(request, app => app.query(
        "INSERT INTO pilot.draft_revisions(tenant_id,draft_id,revision,text) VALUES($1,$2,3,'later')", scope)), { code: '23514' });
      await assert.rejects(withContext(request, app => app.query(`INSERT INTO pilot.approvals
        (tenant_id,occurrence_id,draft_id,revision_id,location_id,membership_id,membership_version,grant_version,due_at,timezone,mfa_at)
        SELECT tenant_id,occurrence_id,draft_id,revision_id,location_id,membership_id,membership_version,1,due_at,timezone,now()
        FROM pilot.approvals WHERE tenant_id=$1 AND occurrence_id=$2`, [scope[0], d.id])), { code: '23514' });
      await assert.rejects(claimExport(connectFixture, request, d.id, clock, inspect), /Denied/);
      assert.equal(await wake(d.id), 'denied');
      const fake = new FakeGbp();
      try { assert.equal(fake.createCount(scope[0]!, d.id), 0); } finally { fake.close(); }
      await withContext(request, async (app, ctx) => {
        assert.ok(!(await renderDrafts(app, ctx)).includes(d.draft));
        const details = await renderOccurrence(app, ctx, d.id, 'local');
        assert.ok(!details.includes('Download approved text') && !details.includes('Invented ' + i + '-'));
      });
    } else {
      const page = await withContext(request, (db, ctx) => renderDraft(db, ctx, d.draft, 'local'));
      assert.ok(page.includes(rows[1].text));
      if (i !== 0) assert.ok(digest((await claimExport(connectFixture, request, d.id, clock, inspect)).text) === d.hashes[1]);
    }
  }
  for (const [i, id] of samples.attempts.entries()) {
    if (erased && !target) assert.equal(await wake(id), 'confirmed');
    const result = await db.query(`SELECT o.state, to_jsonb(o)->>'restore_previous_state' AS prior, a.outcome,
      (SELECT count(*)::int FROM pilot.audit WHERE occurrence_id=o.id AND action='dispatch_claim') AS claims
      FROM pilot.occurrences o JOIN pilot.attempts a ON a.occurrence_id=o.id WHERE o.id=$1`, [id]);
    const final = i === 0 || (erased && !target);
    const status = final ? 'confirmed' : 'in_flight';
    assert.deepEqual(result.rows, [{ state: target ? 'quarantined' : status, prior: target ? status : null,
      outcome: final ? 'confirmed' : 'unknown', claims: 1 }]);
    if (!target) {
      const fake = new FakeGbp();
      try { assert.equal(fake.createCount(samples.drafts[0]!.proposal.tenantId, id), 1); }
      finally { fake.close(); }
    }
  }
}

export async function abortPurge(db: Client, seq: number, samples: Samples) {
  const { rows: [instruction] } = await db.query('SELECT * FROM pilot.fixture_draft_erasure WHERE sequence=$1', [seq]);
  for (const control of samples.drafts.slice(2)) {
    await db.query('BEGIN');
    try {
      const crossed = { kind: 'erase-draft' as const, id: control.draft, tenantId: control.proposal.tenantId,
        authorizedAt: instruction.authorized_at.toISOString() };
      await assert.rejects(eraseBoundDraft(db, instruction.source_id, seq, crossed, instruction.history_digest), /incompatible restore history/);
    } finally { await db.query('ROLLBACK'); }
  }
  await assert.rejects(db.query('UPDATE pilot.fixture_draft_erasure SET sequence=sequence+100 WHERE sequence=$1', [seq]), { code: '23514' });
  await assert.rejects(db.query(
    'UPDATE pilot.fixture_draft_erasure SET applied_xid=pg_current_xact_id() WHERE sequence=$1', [seq]), { code: '23514' });
  const app = await connectFixture();
  try {
    await assert.rejects(app.query('SELECT * FROM pilot.fixture_draft_erasure'), { code: '42501' });
    await assert.rejects(app.query('UPDATE pilot.draft_revisions SET text=NULL'), { code: '42501' });
  } finally { await app.end(); }
  await db.query(`CREATE CONSTRAINT TRIGGER reject_draft_purge AFTER UPDATE ON pilot.fixture_draft_erasure
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pilot.reject_mutation()`);
  try { await assert.rejects(applySourceDraftErasure(seq), { code: '23514' }); }
  finally { await db.query('DROP TRIGGER reject_draft_purge ON pilot.fixture_draft_erasure'); }
  assert.equal((await db.query('SELECT count(*)::int AS n FROM pilot.fixture_draft_erasure WHERE applied_xid IS NOT NULL')).rows[0].n, 0);
}

async function waitForWaiter(observer: Client, blocker: number) {
  for (let i = 0; i < 100; i++) {
    const { rows: [waiter] } = await observer.query('SELECT pid FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))', [blocker]);
    if (waiter) return Number(waiter.pid);
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error('Expected database lock order was not observed');
}

export async function racePurge(db: Client, s: Samples, seq: number, i: number) {
  const d = s.drafts[i]!;
  const observer = await connectFixture(true);
  try {
    await db.query('BEGIN');
    const blocker = (await db.query('SELECT pg_backend_pid() AS pid FROM pilot.draft_revisions WHERE id=$1 FOR UPDATE',
      [d.proposal.revisionId])).rows[0].pid;
    const purge = applySourceDraftErasure(seq);
    try {
      const pid = await waitForWaiter(observer, blocker);
      const rival = i === 0 ? wake(d.id).then(result => assert.equal(result, 'denied'))
        : assert.rejects(claimExport(connectFixture, s.auth, d.id, clock, inspect), /Denied/);
      try { await waitForWaiter(observer, pid); } finally { await db.query('ROLLBACK'); }
      await rival;
    } finally { await db.query('ROLLBACK'); }
    return await purge;
  } finally { await observer.end(); }
}
