import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { claimExport } from '../../apps/web/src/server/occurrence-export.js';
import { claimDispatch } from '../../apps/worker/src/dispatch.js';
import { reconcileOccurrence } from '../../apps/worker/src/reconcile.js';
import { compose, connectFixture, loadFixture, safeDiagnostics, usesLocalDocker, verifyContainers } from '../../ops/local/fixture.js';
import { binding, clock, inspect, seedDispatchApproval, type Case } from './dispatch-fixture.js';
import { FakeGbp } from './fake-gbp.js';

const control = 'dist/pilot/ops/local/dispatch-control.js';
const stack = 'dist/pilot/ops/local/stack.js';
const entry = 'dist/pilot/tests/pilot/dispatch-recovery.js';
const node = (file: string, action: string) => execFileSync(process.execPath, [file, action], {
  encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180_000,
}).trim();
const command = (action: string) => JSON.parse(node(control, action)) as { stopped: boolean; outstandingAttempts: number };
const refused = () => {
  const result = spawnSync(process.execPath, [control, 'reopen'], { encoding: 'utf8', timeout: 20_000 });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /Fixture dispatch command refused or failed/);
};
const denied = (operation: Promise<unknown>) => assert.rejects(operation, { message: 'Denied' });

async function isolated(stage: string, saved: string | undefined) {
  const owner = await connectFixture(true);
  try {
    if (stage === 'guards') {
      const { id } = await loadFixture();
      for (const [change, restore, params] of [
        ["UPDATE public.fixture_identity SET id='wrong-fixture'", "UPDATE public.fixture_identity SET id=$1", [id]],
        ['UPDATE public.fixture_identity SET restore_target=true', 'UPDATE public.fixture_identity SET restore_target=false'],
        ["UPDATE public.fixture_identity SET purpose='backup'", "UPDATE public.fixture_identity SET purpose='ordinary'"],
        ['ALTER TABLE public.fixture_identity RENAME COLUMN purpose TO prior_purpose',
          'ALTER TABLE public.fixture_identity RENAME COLUMN prior_purpose TO purpose'],
        ['ALTER TABLE pilot.approvals RENAME COLUMN grant_active_at_approval TO prior_grant_flag',
          'ALTER TABLE pilot.approvals RENAME COLUMN prior_grant_flag TO grant_active_at_approval'],
      ] satisfies [string, string, string[]?][]) {
        await owner.query(change);
        try {
          refused();
          assert.deepEqual((await owner.query('SELECT stopped FROM pilot.dispatch_control')).rows, [{ stopped: true }]);
        } finally { await owner.query(restore, params); }
      }
      console.log(JSON.stringify({ refusedDatabaseTargets: 5, stopped: true }));
      return;
    }
    const fake = new FakeGbp('/fake', { frames: [{ afterMs: 0, candidates: ['LIVE'] }] });
    const state = async (c: Case, expected: string, attempts: number, creates: number) => {
      const row = (await owner.query(`SELECT state,
        (SELECT count(*)::int FROM pilot.attempts WHERE occurrence_id=$1) AS attempts,
        (SELECT count(*)::int FROM pilot.audit WHERE occurrence_id=$1 AND action='occurrence_export') AS exports
        FROM pilot.occurrences WHERE id=$1`, [c.id])).rows[0];
      assert.deepEqual(row, { state: expected, attempts, exports: 0 });
      assert.equal(fake.createCount(c.tenant, c.id), creates);
    };
    try {
      if (stage === 'stop') {
        const aBinding = binding();
        const a = await seedDispatchApproval(aBinding, true);
        const b = await seedDispatchApproval(binding(), true);
        let enter!: () => void, proceed!: () => void;
        const entered = new Promise<void>(resolve => { enter = resolve; });
        const release = new Promise<void>(resolve => { proceed = resolve; });
        const baseline = command('status');
        assert.equal(baseline.stopped, false);
        const inFlight = claimDispatch(connectFixture, a.id, {
          policy: fake.policy,
          async create(intent) {
            enter();
            await release;
            return fake.create(intent);
          },
        });
        try {
          await Promise.race([entered, inFlight.then(() => assert.fail('Expected the post-commit barrier'))]);
          await state(a, 'in_flight', 1, 0);
          assert.deepEqual(command('stop'), { stopped: true, outstandingAttempts: baseline.outstandingAttempts + 1 });
          await denied(claimDispatch(connectFixture, b.id, fake));
          await owner.query('UPDATE pilot.locations SET grant_active=false, version=version+1 WHERE tenant_id=$1', [a.tenant]);
          await denied(claimExport(connectFixture, aBinding, a.id, clock, inspect));
          await state(b, 'approved', 0, 0);
        } finally {
          proceed();
          await inFlight;
        }
        assert.equal(await reconcileOccurrence(connectFixture, a.id, fake), 'confirmed');
        await state(a, 'confirmed', 1, 1);
        await state(b, 'approved', 0, 0);
        assert.deepEqual(command('status'), { ...baseline, stopped: true });
        console.log(JSON.stringify({ a, b, baseline }));
        return;
      }
      assert.ok(stage === 'retained' || stage === 'reopened');
      const { a, b, baseline } = JSON.parse(saved!) as { a: Case; b: Case; baseline: ReturnType<typeof command> };
      await state(a, 'confirmed', 1, 1);
      await state(b, 'approved', 0, 0);
      assert.deepEqual(command('status'), { ...baseline, stopped: stage === 'retained' });
      if (stage === 'retained') {
        await denied(claimDispatch(connectFixture, b.id, fake));
      } else {
        const c = await seedDispatchApproval(binding(), true);
        assert.equal((await claimDispatch(connectFixture, c.id, fake)).state, 'in_flight');
        assert.equal(await reconcileOccurrence(connectFixture, c.id, fake), 'confirmed');
        await state(c, 'confirmed', 1, 1);
      }
      await state(a, 'confirmed', 1, 1);
      await state(b, 'approved', 0, 0);
      console.log(JSON.stringify({ phase: stage, aCreates: 1, bCreates: 0, controlCreates: Number(stage === 'reopened'), exports: 0 }));
    } finally { fake.close(); }
  } finally { await owner.end(); }
}

async function drill() {
  assert.equal(process.argv.length, 2);
  assert.ok(usesLocalDocker());
  const f = await loadFixture();
  const fakePath = await mkdtemp(resolve('work/dispatch-recovery-'));
  const phase = (...args: string[]) => compose(f, ['run', '--rm', '-T', '--no-deps', '--pull', 'never',
    '--volume', fakePath + ':/fake', 'runner', 'node', entry, ...args]);
  try {
    assert.equal(command('status').stopped, true);
    console.log(phase('guards'));
    for (const service of ['identity-db', 'mailbox']) {
      compose(f, ['pause', service]);
      try {
        verifyContainers(f);
        refused();
        assert.equal(command('status').stopped, true);
        console.log(JSON.stringify({ phase: 'dependency-unavailable', service, reopenRefused: true, stopped: true }));
      } finally { compose(f, ['unpause', service]); }
    }

    const recoveryDeadline = performance.now() + 20_000;
    while (compose(f, ['ps', '--format', '{{.Health}}', 'identity-db']) !== 'healthy') {
      assert.ok(performance.now() < recoveryDeadline, 'Identity database did not become healthy');
      await setTimeout(500);
    }
    compose(f, ['run', '--rm', '-T', '--no-deps', '--pull', 'never', 'runner', 'node', stack, 'check']);
    assert.equal(command('reopen').stopped, false);
    const saved = phase('stop');
    console.log(JSON.stringify({ phase: 'post-commit-stop-and-reconcile', aCreates: 1, bCreates: 0, exports: 0 }));
    node(stack, 'down');
    node(stack, 'up');
    console.log(phase('retained', saved));
    assert.equal(command('reopen').stopped, false);
    console.log(phase('reopened', saved));
  } finally {
    try { command('stop'); }
    finally { await rm(fakePath, { recursive: true, force: true }); }
  }
}

(process.env.PILOT_CONTAINER === '1' ? isolated(process.argv[2]!, process.argv[3]) : drill()).catch(error => {
  console.error(safeDiagnostics(String(error)));
  process.exitCode = 1;
});
