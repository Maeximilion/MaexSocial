import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { lstat, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { approveOccurrence, readApprovalProposal } from '../../apps/web/src/routes/content.js';
import { claimExport } from '../../apps/web/src/server/occurrence-export.js';
import { requireCustomerRequest, type CustomerRequest } from '../../apps/web/src/server/request.js';
import { tokenHash } from '../../apps/web/src/server/session.js';
import { claimDispatch } from '../../apps/worker/src/dispatch.js';
import { capture } from '../../ops/local/backup.js';
import { compose, connectFixture, loadFixture, runIsolatedFixture, safeDiagnostics, type Fixture } from '../../ops/local/fixture.js';
import { restore } from '../../ops/local/restore.js';
import type { InspectIdentity } from '../../packages/contracts/pilot.js';
import { FakeGbp } from './fake-gbp.js';
import { occurrence, seedTenant } from './fixtures.js';

const clock = () => new Date('2020-01-01T10:00:00Z');
const inspect: InspectIdentity = async subject => ({
  subject, verified: true, enabled: true, requiredActions: [], credentials: [{ id: 'synthetic-otp', type: 'otp' }],
});
const command = 'dist/pilot/tests/pilot/restore-before-effects.js';
const inputPath = 'work/restore-before-effects.json';
const fixturePath = 'work/pilot';
const pairPath = fixturePath + '/cold-backup/pair.json';
const binding = () => ({ token: randomBytes(32).toString('hex'), csrf: randomBytes(32).toString('hex') });

interface Case {
  id: string;
  approvalId: string;
  tenant: string;
  user: string;
  revision: string;
}

async function seed(request: CustomerRequest, grant: boolean): Promise<Case> {
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
    const app = await connectFixture();
    const proposal = await (async () => {
      try {
        await app.query('BEGIN');
        return await readApprovalProposal(app, await requireCustomerRequest(app, request, clock, inspect, 'read-only'), id);
      } finally { await app.end(); }
    })();
    const approvalId = await approveOccurrence(connectFixture, request, proposal, clock, inspect);
    return { id, approvalId, tenant: f.tenant, user: f.user, revision: f.revision };
  } finally { await owner.end(); }
}

async function readState(c: Case, target: boolean) {
  const db = await connectFixture(true);
  try {
    await db.query('BEGIN READ ONLY');
    const { rows: [row] } = await db.query(`SELECT o.id, o.state, o.tenant_id, o.approval_id, a.revision_id,
      (SELECT stopped FROM pilot.dispatch_control) AS stopped
      ${target ? ', o.restore_previous_state' : ''}
      FROM pilot.occurrences o JOIN pilot.approvals a
        ON a.tenant_id=o.tenant_id AND a.occurrence_id=o.id AND a.id=o.approval_id WHERE o.id=$1`, [c.id]);
    assert.equal(row?.tenant_id, c.tenant);
    assert.equal(row.approval_id, c.approvalId);
    assert.equal(row.revision_id, c.revision);
    const { rows: attempts } = await db.query('SELECT id, approval_id, outcome FROM pilot.attempts WHERE occurrence_id=$1', [c.id]);
    const { rows: effects } = await db.query(`SELECT actor_id, action, outcome FROM pilot.audit
      WHERE occurrence_id=$1 AND action IN ('dispatch_claim','occurrence_export') ORDER BY id`, [c.id]);
    return { row, attempts, effects };
  } finally { await db.end(); }
}

async function runStage(stage: string) {
  const input = JSON.parse(await readFile(inputPath, 'utf8')) as { a: CustomerRequest; b: CustomerRequest; cases: [Case, Case] };
  if (stage === 'seed') {
    const cases = [await seed(input.a, true), await seed(input.b, false)];
    assert.notEqual(cases[0]!.id, cases[1]!.id);
    console.log(JSON.stringify(cases));
    return;
  }
  const [a, b] = input.cases;
  if (stage === 'deliver') {
    const owner = await connectFixture(true);
    try {
      assert.equal((await loadFixture()).restoreTarget, undefined);
      assert.deepEqual((await owner.query('UPDATE pilot.dispatch_control SET stopped=false WHERE singleton AND stopped RETURNING stopped')).rows,
        [{ stopped: false }]);
    } finally { await owner.end(); }
    const fake = new FakeGbp('/fake');
    try {
      const result = await claimDispatch(connectFixture, a.id, fake);
      assert.equal(result.state, 'in_flight');
      const exported = await claimExport(connectFixture, input.b, b.id, clock, inspect);
      assert.ok(exported.state === 'exported' && exported.text === 'Invented plain text', 'Unexpected source export');
      console.log(JSON.stringify({ attemptId: result.attemptId }));
    } finally { fake.close(); }
    return;
  }
  const target = stage === 'target';
  const authDenials: string[] = [];
  if (target) {
    assert.equal((await loadFixture()).pairedRestore, true);
    let creates = 0;
    const fake = { policy: 'synthetic-organic-text' as const, async create() { creates++; throw new Error('Unexpected create'); } };
    const denied = (error: { code?: string }) => {
      assert.ok(error.code === '28000' || error.code === '28P01', 'Expected PostgreSQL authentication refusal');
      authDenials.push(error.code);
      return true;
    };
    await assert.rejects(claimDispatch(connectFixture, a.id, fake), denied);
    await assert.rejects(claimExport(connectFixture, input.b, b.id, clock, inspect), denied);
    assert.equal(creates, 0);
  }
  const states = await Promise.all([readState(a, target), readState(b, target)]);
  console.log(JSON.stringify(target ? { authDenials, states } : states));
}

function node(script: string, ...args: string[]) {
  return execFileSync(process.execPath, [script, ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 300_000,
  }).trim();
}

async function freshWorktree(cwd: string) {
  const git = (...args: string[]) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
  assert.equal(git('status', '--porcelain'), '', 'The drill requires clean worktrees');
  await assert.rejects(lstat(resolve(cwd, fixturePath)), { code: 'ENOENT' });
  await lstat(resolve(cwd, command));
  return git('rev-parse', 'HEAD');
}

async function drill(targetDir: string) {
  const source = process.cwd();
  const target = resolve(targetDir);
  assert.notEqual(source.toLowerCase(), target.toLowerCase());
  const revision = await freshWorktree(source);
  assert.equal(await freshWorktree(target), revision, 'Source and target builds must use the same revision');
  const input = { a: binding(), b: binding(), cases: [] as Case[] };
  const fakeDir = resolve('work/restore-before-effects-fake');
  const save = (flag: 'w' | 'wx') => writeFile(inputPath, JSON.stringify(input), { flag, mode: 0o600 });
  const stage = (fixture: Fixture, name: string) => JSON.parse(runIsolatedFixture(fixture, [command, name]).output);
  await mkdir('work', { recursive: true });
  await mkdir(fakeDir);
  await save('wx');
  let targetInput = false;
  let sourceFixture: Fixture | undefined, targetFixture: Fixture | undefined;
  let phase = 'cold capture';
  try {
    await capture(true, f => {
      sourceFixture = f;
      input.cases = stage(f, 'seed');
    });
    await save('w');
    const pair = await readFile(pairPath);
    const f = await loadFixture();
    phase = 'continued source';
    compose(f, ['start', '--wait', '--wait-timeout', '120']);
    const before = stage(f, 'source');
    for (const c of before) {
      assert.equal(c.row.state, 'approved');
      assert.equal(c.row.stopped, true);
      assert.deepEqual([c.attempts, c.effects], [[], []]);
    }
    const { attemptId } = JSON.parse(compose(f, ['run', '--rm', '--no-deps', '--pull', 'never',
      '--volume', fakeDir + ':/fake', 'runner', 'node', command, 'deliver']));
    const after = stage(f, 'source');
    const [a, b] = input.cases as [Case, Case];
    assert.deepEqual(after, [
      { row: { ...before[0].row, state: 'in_flight', stopped: false },
        attempts: [{ id: attemptId, approval_id: a.approvalId, outcome: 'unknown' }],
        effects: [{ actor_id: a.user, action: 'dispatch_claim', outcome: 'in_flight' }] },
      { row: { ...before[1].row, state: 'exported', stopped: false }, attempts: [],
        effects: [{ actor_id: b.user, action: 'occurrence_export', outcome: 'exported' }] },
    ]);
    const checkFake = () => {
      const fake = new DatabaseSync(resolve(fakeDir, 'fake-gbp.sqlite'), { readOnly: true });
      try {
        const rows = fake.prepare('SELECT tenant, occurrence, attempt, intent FROM calls JOIN call_intents ON id=call_id').all();
        assert.equal(fake.prepare('SELECT count(*) AS total FROM calls').get()!.total, 1);
        assert.equal(rows.length, 1);
        const [receipt] = rows;
        assert.deepEqual([receipt!.tenant, receipt!.occurrence, receipt!.attempt], [a.tenant, a.id, attemptId]);
        const intent = JSON.parse(String(receipt!.intent));
        assert.deepEqual([intent.approvalId, intent.revisionId], [a.approvalId, a.revision]);
      } finally { fake.close(); }
    };
    checkFake();
    const archive = resolve(fixturePath);
    phase = 'offline paired restore';
    process.chdir(target);
    await mkdir('work', { recursive: true });
    await save('wx');
    targetInput = true;
    const restored = await restore(archive, f => { targetFixture = f; });
    const t = await loadFixture();
    const topology = { internalNetworks: 2, publishedHostPorts: 0 };
    const quarantine = { stopped: true, applicationLogin: false, topology };
    assert.deepEqual(restored, { verifiedDatabases: 2, quarantined: 5, ...quarantine });
    assert.equal(compose(t, ['exec', '-T', '--user', 'postgres', 'identity-db', 'psql', '-XAt',
      '-U', 'identity_owner', '-d', 'identity_fixture', '-c', "SELECT NOT rolcanlogin FROM pg_roles WHERE rolname='keycloak'"]), 't');
    const expected = before.map((c: typeof before[number]) => ({
      ...c, row: { ...c.row, state: 'quarantined', restore_previous_state: 'approved' },
    }));
    phase = 'unprivileged repeat and repeated quarantine';
    const first = stage(t, 'target');
    assert.deepEqual(first.states, expected);
    assert.equal(first.authDenials.length, 2);
    assert.deepEqual(JSON.parse(node('dist/pilot/ops/local/recover.js')), { quarantined: 0, ...quarantine });
    const repeated = stage(t, 'target');
    assert.deepEqual(repeated.states, expected);
    assert.equal(repeated.authDenials.length, 2);

    phase = 'archive, source and fake comparison';
    process.chdir(source);
    assert.deepEqual(stage(f, 'source'), after);
    checkFake();
    assert.ok((await readFile(pairPath)).equals(pair), 'Pair manifest changed');
    assert.equal(node('dist/pilot/ops/local/backup.js', 'verify'), 'Verified synthetic AppDB and IdP backup pair.');
    return { revision, source: after, target: expected, fakeCreates: 1,
      targetAuthDenials: [...first.authDenials, ...repeated.authDenials], ...quarantine };
  } catch (error) {
    console.error('Restore drill failed during ' + phase + '.');
    throw error;
  } finally {
    const stop = async (fixture?: Fixture) => {
      try { await unlink(inputPath); }
      finally {
        if (fixture) {
          assert.equal((await loadFixture(true)).id, fixture.id, 'Fixture ownership changed');
          compose(fixture, ['down']);
        }
      }
    };
    try {
      if (targetInput) {
        process.chdir(target);
        await stop(targetFixture);
      }
    } finally {
      process.chdir(source);
      await stop(sourceFixture);
    }
  }
}

const [argument, ...extra] = process.argv.slice(2);
const inRunner = process.env.PILOT_CONTAINER === '1';
if (!argument || extra.length || (inRunner && !['seed', 'deliver', 'source', 'target'].includes(argument))) {
  throw new Error('Run from a fresh built source worktree with one fresh built target worktree path.');
}
(inRunner ? runStage(argument) : drill(argument).then(result => console.log(JSON.stringify(result)))).catch(error => {
  const detail = error instanceof Error
    ? safeDiagnostics(String((error as { stderr?: string }).stderr || error.message)) : 'Unknown drill failure.';
  console.error(detail);
  process.exitCode = 1;
});
