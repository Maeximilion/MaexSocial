import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { copyFile, lstat, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { capture, captureContinuedFixture, verifyPair, type Pair } from '../../ops/local/backup.js';
import { loadBackupKey } from '../../ops/local/backup-crypto.js';
import { compose, connectFixture, loadFixture, runIsolatedFixture, type Fixture } from '../../ops/local/fixture.js';
import { eraseCustomer } from '../../ops/local/customer-erasure.js';
import { restore } from '../../ops/local/restore.js';
import { applySourceCustomerErasure } from '../../ops/local/source-customer-erasure.js';
import { authorizeCase, exerciseSource, inspectCase, seedCase, type AccessCase } from './customer-erasure-case.js';

const input = 'work/customer-erasure-case.json';
const script = 'dist/pilot/tests/pilot/customer-erasure-drill.js';
const historyPath = 'work/pilot/restore-history.json';
const sha = (bytes: string) => createHash('sha256').update(bytes).digest('hex');
async function stage(name: string) {
  const f = await loadFixture();
  assert.ok(f.purpose === 'backup' || f.pairedRestore);
  const db = await connectFixture(true);
  try {
    if (name === 'seed' && f.purpose === 'backup' && !f.restoreTarget) return await seedCase(db, f.id);
    const c = JSON.parse(await readFile(input, 'utf8')) as AccessCase;
    if (name === 'before' || name === 'after') return await inspectCase(db, c, name === 'after', !!f.pairedRestore);
    if (name === 'tail') {
      const { rows: [grant] } = await db.query(`SELECT l.id,l.tenant_id AS "tenantId",l.version,l.grant_active
        FROM pilot.locations l JOIN pilot.tenants t ON t.id=l.tenant_id
        WHERE t.name='Cold Backup Orchard' AND l.provider_location='after-snapshot'`);
      return grant;
    }
    assert.ok(f.purpose === 'backup' && !f.restoreTarget);
    if (name === 'refuse-extension') {
      await assert.rejects(applySourceCustomerErasure, /incompatible restore history/);
      return null;
    }
    if (name === 'erase') return (await exerciseSource(db, c)).toISOString();
    assert.equal(name, 'authorize');
    const before = await inspectCase(db, c, false, false);
    await assert.rejects(applySourceCustomerErasure, /instruction required/);
    const digest = sha(await readFile(historyPath, 'utf8'));
    await authorizeCase(db, f.id, c, digest);
    for (const [column, wrong, original] of [
      ['fixture_id', randomUUID(), f.id],
      ['subject_binding', '0'.repeat(64), c.event.binding],
      ['identity_version', c.event.version - 1, c.event.version],
      ['identity_id', c.peerId, c.event.id],
      ['history_digest', '0'.repeat(64), digest]
    ] as const) {
      await db.query(`UPDATE pilot.fixture_customer_erasure SET ${column}=$1`, [wrong]);
      try {
        await assert.rejects(applySourceCustomerErasure, /instruction required|scope mismatch|restore history/);
      } finally {
        await db.query(`UPDATE pilot.fixture_customer_erasure SET ${column}=$1`, [original]);
      }
      assert.equal(await inspectCase(db, c, false, false), before);
    }
    for (const mode of ['changed subject', 'management grant']) {
      await db.query('BEGIN');
      try {
        if (mode === 'changed subject') {
          await db.query('UPDATE pilot.identities SET subject=$2,version=version+1 WHERE id=$1', [
            c.event.id,
            'changed-fixture-subject'
          ]);
          await assert.rejects(
            eraseCustomer(db, f.id, { ...c.event, version: c.event.version + 1 }, false),
            /binding mismatch/
          );
        } else {
          await db.query('INSERT INTO pilot.platform_grants(identity_id) VALUES($1)', [c.event.id]);
          await assert.rejects(eraseCustomer(db, f.id, c.event, false), /Customer-only/);
        }
      } finally {
        await db.query('ROLLBACK');
      }
    }
    // Issue one fresh committed instruction after the negative probes. Its start brackets the commit.
    await db.query('DELETE FROM pilot.fixture_customer_erasure WHERE fixture_id=$1 AND applied_xid IS NULL', [f.id]);
    const authorized = await authorizeCase(db, f.id, c, digest);
    return authorized.toISOString();
  } finally {
    await db.end();
  }
}

async function drill() {
  const fixtureDir = 'work/pilot',
    sourceDir = resolve('work/customer-erasure-source');
  for (const path of [fixtureDir, sourceDir, input]) await assert.rejects(lstat(path), { code: 'ENOENT' });
  await loadBackupKey();
  await mkdir('work', { recursive: true });
  const run = (f: Fixture, name: string) => {
    try {
      return JSON.parse(runIsolatedFixture(f, [script, name]).output);
    } catch (error) {
      const location = String(error).match(/Customer erasure drill failed \([^)]+\)/)?.[0];
      console.error('Fixture stage failed: ' + name + (location ? ' ' + location : ''));
      throw error;
    }
  };
  let owned: Fixture | undefined;
  let c!: AccessCase;
  try {
    await capture(true, (f) => {
      owned = f;
      c = run(f, 'seed');
    });
    const f = await loadFixture();
    const pairBytes = await readFile(fixtureDir + '/cold-backup/pair.json', 'utf8');
    const pair = JSON.parse(pairBytes) as Pair;
    assert.ok(pair.historyAnchor && pair.format === 3 && pair.disposable && pair.lineageCapturedAt === pair.capturedAt);
    const after = pair.historyAnchor.after;
    const first = { seq: after + 1, ...c.event };
    const journal = { schema: 1, fixtureId: f.id, after, through: first.seq, records: [first] };
    await writeFile(input, JSON.stringify(c), { flag: 'wx', mode: 0o600 });
    await writeFile(historyPath, JSON.stringify(journal), { flag: 'wx', mode: 0o600 });
    const startSource = () => {
      compose(f, ['start', '--wait', '--wait-timeout', '120']);
      runIsolatedFixture(f, ['dist/pilot/ops/local/stack.js', 'check']);
    };
    const captureInterval = async (name: string) => {
      compose(f, ['stop']);
      const folder = fixtureDir + '/' + name;
      await mkdir(folder, { mode: 0o700 });
      for (const file of ['fixture.json', 'compose.env', 'keycloak.conf', 'keycloak-realm.json']) {
        await copyFile(fixtureDir + '/' + file, folder + '/' + file);
      }
      await captureContinuedFixture(f.id, folder + '/cold-backup');
      const saved = JSON.parse(await readFile(folder + '/cold-backup/pair.json', 'utf8')) as Pair;
      assert.equal(saved.format, 4);
      assert.equal(saved.lineageCapturedAt, pair.lineageCapturedAt);
      return saved;
    };
    startSource();
    const before = run(f, 'before');
    const authorized: string = run(f, 'authorize');
    const grant = run(f, 'tail');
    assert.equal(grant.grant_active, true);
    const through = first.seq + 1;
    const last = { seq: through, kind: 'revoke-grant', tenantId: grant.tenantId, id: grant.id, version: grant.version };
    const extended = { ...journal, through, records: [first, last] };
    const bytes = JSON.stringify(extended);
    // Change the already-issued entry while preserving the later entry and interval length.
    const changed = JSON.stringify({ ...extended, records: [{ ...first, version: first.version + 1 }, last] });
    const issuedPair = await captureInterval('issued-customer');
    startSource();
    await writeFile(historyPath, changed);
    run(f, 'refuse-extension');
    assert.equal(run(f, 'before'), before);
    await writeFile(historyPath, bytes);
    const confirmed: string = run(f, 'erase');
    assert.ok(Date.parse(confirmed) >= Date.parse(authorized));
    assert.equal(run(f, 'after'), before);
    const appliedPair = await captureInterval('applied-customer');
    startSource();
    assert.equal(run(f, 'after'), before);
    compose(f, ['down']);
    owned = undefined;
    await rename(fixtureDir, sourceDir);
    let quarantined = 0;
    for (const [index, source] of [sourceDir, sourceDir + '/issued-customer', sourceDir + '/applied-customer'].entries()) {
      const held = await restore(source, (t) => { owned = t; });
      assert.ok(held.stopped && !held.applicationLogin && held.verifiedDatabases === 2 && held.quarantined >= 4);
      assert.deepEqual(held.topology, { internalNetworks: 2, publishedHostPorts: 0 });
      quarantined = held.quarantined;
      const t = await loadFixture();
      const initial = index === 2 ? 'after' : 'before';
      assert.equal(run(t, initial), before);
      const recover = (content: string) => spawnSync(process.execPath,
        ['dist/pilot/ops/local/recover.js', 'replay-history', String(after), String(through), sha(content)],
        { encoding: 'utf8', timeout: 90000 });
      const invalid = index === 0 ? [
        JSON.stringify({ ...extended, records: [] }), JSON.stringify({ ...extended, fixtureId: t.id }),
        JSON.stringify({ ...extended, records: [{ ...first, id: c.peerId }, last] })
      ] : [changed];
      for (const bad of invalid) {
        await writeFile(historyPath, bad, { mode: 0o600 });
        assert.equal(recover(bad).status, 1);
        assert.equal(run(t, initial), before);
        assert.equal(run(t, 'tail').grant_active, true);
      }
      await writeFile(historyPath, bytes);
      for (const applied of [2, 0]) {
        const result = recover(bytes);
        assert.equal(result.status, 0, 'Bound history replay failed');
        assert.equal(JSON.parse(result.stdout).history.applied, applied);
        assert.equal(run(t, 'after'), before);
        assert.equal(run(t, 'tail').grant_active, false);
        if (applied) {
          compose(t, ['stop', 'postgres', 'identity-db']);
          compose(t, ['start', '--wait', '--wait-timeout', '90', 'postgres', 'identity-db']);
        }
      }
      const saved: Pair = [pair, issuedPair, appliedPair][index]!;
      assert.deepEqual(JSON.parse(await readFile(source + '/cold-backup/pair.json', 'utf8')), saved);
      await verifyPair(source + '/cold-backup', f.id, pair.compatibility, saved, await loadBackupKey(source));
      if (index < 2) {
        compose(t, ['down']);
        owned = undefined;
        await rename(fixtureDir, sourceDir + '/target-' + index);
      }
    }
    return {
      revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      authorized, confirmed,
      onlineDeadlineMet: Date.parse(confirmed) - Date.parse(authorized) <= 7 * 86400_000,
      membershipsRemoved: 1,
      retainedMemberships: 1,
      sessionsRemoved: 2,
      challengesRemoved: 1,
      controls: 2,
      encryptedDatabasesVerified: 6,
      quarantined,
      restartVerified: true
    };
  } finally {
    if (owned && (await loadFixture(true)).id === owned.id) compose(owned, ['down']);
  }
}

const operation = process.env.PILOT_CONTAINER === '1' ? stage(process.argv[2] ?? '') : drill();
operation
  .then((result) => console.log(JSON.stringify(result)))
  .catch((error: Error) => {
    // Raw assertion values, command output and fixture bindings belong only inside the drill.
    console.error(
      'Customer erasure drill failed (' +
        (error.stack?.match(/customer-erasure[^\s()]*:\d+:\d+/)?.[0] ?? error.name) +
        ').'
    );
    process.exitCode = 1;
  });
