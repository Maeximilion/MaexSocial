import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { compose, connectFixture, loadFixture, runIsolated } from '../../ops/local/fixture.js';
import { occurrence, seedTenant } from './fixtures.js';

const command = 'dist/pilot/ops/local/recover.js';
const testFile = 'dist/pilot/tests/pilot/restore-history.test.js';
const input = 'work/pilot/restore-history.json';
const run = (digest: string) => promisify(execFile)(process.execPath,
  [command, 'replay-history', '10', '13', digest], { timeout: 45_000 });
const sha = (bytes: string) => createHash('sha256').update(bytes).digest('hex');

if (process.env.PILOT_CONTAINER !== '1') {
  test('offline history replay commits once and keeps incompatible or missing history isolated', async () => {
    const fixture = await loadFixture();
    if (!fixture.restoreTarget) {
      await assert.rejects(run('0'.repeat(64)), { code: 1 });
      return;
    }
    // Exclusive creation leaves any pre-existing independent input intact.
    await writeFile(input, '', { flag: 'wx' });
    try {
      const phase = (name: string) => runIsolated(['--test', '--test-reporter=tap', `--test-name-pattern=^${name}$`, testFile]);
      const seed = await phase('seed');
      const records = JSON.parse(seed.match(/^# HISTORY (.*)$/m)![1]!);
      const history = { schema: 1, fixtureId: fixture.id, after: 10, through: 13, records };
      const complete = JSON.stringify(history);

      await writeFile(input, complete);
      await phase('mismarked');
      await rm(input);
      await assert.rejects(run(sha(complete)), { code: 1 });
      await phase('held');

      for (const bad of [
        { ...history, schema: 2 },
        { ...history, fixtureId: '0'.repeat(32) },
        { ...history, after: 9 },
        { ...history, records: [records[0], records[2], records[2]] },
        { ...history, records: records.slice(0, 2) },
        { ...history, records: [records[0], records[1], { ...records[2], version: 2 }] },
      ]) {
        const bytes = JSON.stringify(bad);
        await writeFile(input, bytes);
        await assert.rejects(run(sha(bytes)), { code: 1 });
        assert.equal(await readFile(input, 'utf8'), bytes);
        await phase('held');
      }

      await writeFile(input, complete);
      await assert.rejects(run('0'.repeat(64)), { code: 1 });
      await phase('held');
      await phase('interrupted');
      await phase('held');

      const first = JSON.parse((await run(sha(complete))).stdout);
      assert.deepEqual(first, { quarantined: 0, stopped: true, applicationLogin: false,
        history: { applied: 3 }, topology: { internalNetworks: 2, publishedHostPorts: 0 } });
      await phase('applied');
      assert.equal(JSON.parse((await run(sha(complete))).stdout).history.applied, 0);
      assert.equal(await readFile(input, 'utf8'), complete);

      const conflicting = JSON.stringify(history, null, 2);
      await writeFile(input, conflicting);
      await assert.rejects(run(sha(conflicting)), { code: 1 });
      await writeFile(input, complete);
      compose(fixture, ['stop', 'postgres']);
      compose(fixture, ['start', '--wait', '--wait-timeout', '45', 'postgres']);
      await phase('applied');
      assert.equal(JSON.parse((await run(sha(complete))).stdout).history.applied, 0);
      assert.equal(await readFile(input, 'utf8'), complete);
    } finally {
      await rm(input, { force: true });
    }
  });
} else {
  test('mismarked', async () => {
    const bytes = await readFile(input, 'utf8');
    const owner = await connectFixture(true);
    try {
      await owner.query('UPDATE public.fixture_identity SET restore_target=false');
      await assert.rejects(run(sha(bytes)), { code: 1 });
      assert.deepEqual((await owner.query(`SELECT stopped,
        (SELECT count(*)::int FROM pilot.business_fact_revisions) AS facts,
        (SELECT count(*)::int FROM pilot.locations WHERE grant_active) AS grants,
        (SELECT count(*)::int FROM pilot.devices WHERE active) AS devices,
        (SELECT count(*)::int FROM pilot.occurrences WHERE state='draft') AS drafts
        FROM pilot.dispatch_control`)).rows, [{ stopped: false, facts: 4, grants: 2, devices: 2, drafts: 2 }]);
    } finally {
      await owner.query('UPDATE public.fixture_identity SET restore_target=true');
      await owner.end();
    }
  });

  test('seed', async () => {
    const owner = await connectFixture(true);
    try {
      assert.equal((await owner.query('SELECT id FROM pilot.occurrences LIMIT 1')).rowCount, 0);
      for (const [index, label] of ['target', 'control'].entries()) {
        const f = await seedTenant(owner);
        await occurrence(owner, f);
        await owner.query('UPDATE pilot.locations SET grant_active=true,version=2 WHERE tenant_id=$1 AND id=$2',
          [f.tenant, f.location]);
        for (const revision of [1, 2]) {
          await owner.query(`INSERT INTO pilot.business_fact_revisions
            (tenant_id,location_id,revision,text,source_note,evidence_kind,membership_id,membership_version,confirmed_at)
            VALUES($1,$2,$3,$4,'invented','synthetic_fixture',$5,1,now())`,
          [f.tenant, f.location, revision, label, f.membership]);
        }
        const grant = randomUUID(), device = randomUUID();
        await owner.query('INSERT INTO pilot.platform_grants(id,identity_id) VALUES ($1,$2)', [grant, f.user]);
        await owner.query(`INSERT INTO pilot.devices(id,platform_grant_id,identity_id,public_key)
          VALUES($1,$2,$3,$4)`, [device, grant, f.user, label]);
        if (index === 0) console.log('HISTORY ' + JSON.stringify([
          { seq: 11, kind: 'delete-facts', tenantId: f.tenant, id: f.location },
          { seq: 12, kind: 'revoke-grant', tenantId: f.tenant, id: f.location, version: 2 },
          { seq: 13, kind: 'revoke-device', id: device, version: 1 },
        ]));
      }
      await owner.query('UPDATE pilot.dispatch_control SET stopped=false');
    } finally { await owner.end(); }
  });

  for (const applied of [false, true]) {
    test(applied ? 'applied' : 'held', async () => {
      const owner = await connectFixture(true);
      try {
        assert.deepEqual((await owner.query(`SELECT text,count(*)::int AS count FROM pilot.business_fact_revisions
          GROUP BY text ORDER BY text`)).rows,
        applied ? [{ text: 'control', count: 2 }] : [{ text: 'control', count: 2 }, { text: 'target', count: 2 }]);
        assert.deepEqual((await owner.query('SELECT grant_active,version FROM pilot.locations ORDER BY grant_active,version')).rows,
          [{ grant_active: !applied, version: applied ? 3 : 2 }, { grant_active: true, version: 2 }]);
        assert.deepEqual((await owner.query('SELECT active,version FROM pilot.devices ORDER BY public_key')).rows,
          [{ active: true, version: 1 }, { active: !applied, version: applied ? 2 : 1 }]);
        assert.deepEqual((await owner.query(`SELECT o.state,o.restore_previous_state FROM pilot.occurrences o
          ORDER BY o.id`)).rows, Array(2).fill({ state: 'quarantined', restore_previous_state: 'draft' }));
        assert.deepEqual((await owner.query(`SELECT stopped,
          (SELECT rolcanlogin FROM pg_roles WHERE rolname='pilot_app') AS login,
          has_database_privilege('pilot_app', current_database(), 'CONNECT') AS can_connect
          FROM pilot.dispatch_control`)).rows, [{ stopped: true, login: false, can_connect: false }]);
        assert.deepEqual((await owner.query(`SELECT tgenabled FROM pg_trigger
          WHERE tgrelid='pilot.business_fact_revisions'::regclass AND tgname='immutable_business_facts'`)).rows,
        [{ tgenabled: 'O' }]);
      } finally { await owner.end(); }
    });
  }

  test('interrupted', async () => {
    const bytes = await readFile(input, 'utf8');
    const owner = await connectFixture(true);
    try {
      await owner.query('BEGIN');
      await owner.query("SELECT id FROM pilot.devices WHERE public_key='target' FOR UPDATE");
      const pending = assert.rejects(run(sha(bytes)), { code: 1 });
      try {
        const deadline = Date.now() + 3500;
        let pid: number | undefined;
        do {
          const result = await owner.query<{ pid: number }>(`SELECT pid FROM pg_stat_activity
            WHERE datname=current_database() AND pid<>pg_backend_pid() AND wait_event_type='Lock'
              AND query LIKE 'UPDATE pilot.devices%'`);
          pid = result.rows[0]?.pid;
          if (pid === undefined) await new Promise(resolve => setTimeout(resolve, 50));
          await owner.query('SELECT pg_stat_clear_snapshot()');
        } while (pid === undefined && Date.now() < deadline);
        assert.ok(pid, 'Replay must reach the blocked device update after its earlier writes');
        assert.equal((await owner.query('SELECT pg_terminate_backend($1) AS terminated', [pid])).rows[0].terminated, true);
      } finally {
        await owner.query('ROLLBACK');
        await pending;
      }
    } finally { await owner.end(); }
  });
}
