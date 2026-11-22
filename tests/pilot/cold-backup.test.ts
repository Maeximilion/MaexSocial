import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { verifyPair } from '../../ops/local/backup.js';
import { postgresImage } from '../../ops/local/stack.js';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

test('cold pair verification refuses mixed, incomplete, altered and incompatible backups', async t => {
  const path = await mkdtemp(join(tmpdir(), 'maex-cold-pair-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  const fixtureId = 'a'.repeat(32);
  const compatibility = {
    appSchema: sha256('app schema'), idpConfig: sha256('identity config'), stack: sha256('stack'),
    keycloakImage: 'quay.io/keycloak/keycloak:26.8.2@sha256:' + sha256('identity image'),
  };
  const app = 'synthetic AppDB archive bytes';
  const identity = 'synthetic IdP database archive bytes';
  const appPath = join(path, 'app-db.tar');
  const identityPath = join(path, 'identity-db.tar');
  await writeFile(appPath, app);
  await writeFile(identityPath, identity);
  const pair = {
    format: 1 as const, fixtureId, revision: 'b'.repeat(40), compatibility, postgresImage,
    appliedAppSchema: sha256('applied schema'), identitySchema: sha256('identity schema'),
    archives: {
      'app-db.tar': { sha256: sha256(app), systemId: '123', catalogVersion: '202406281' },
      'identity-db.tar': { sha256: sha256(identity), systemId: '456', catalogVersion: '202406281' },
    },
  };

  await verifyPair(path, fixtureId, compatibility, pair);
  const beforeReopen = '47420f024562f01694126e4edfa0a9903b89df43476d3eb3ac161db61a361fb5';
  const withProvenance = 'c729c7ec9dad4175bc32abbb0f33d693d7980bcc1132b1d1a3fc88ee80c0cf18';
  await verifyPair(path, fixtureId, { ...compatibility, idpConfig: withProvenance },
    { ...pair, compatibility: { ...compatibility, idpConfig: beforeReopen } });
  const historyAnchor = { after: 1, evidenceSha256: sha256('independent source journal') };
  await verifyPair(path, fixtureId, compatibility, { ...pair, historyAnchor });
  for (const invalid of [{ ...historyAnchor, after: 0 }, { ...historyAnchor, after: 1.5 },
    { ...historyAnchor, evidenceSha256: 'unverified' }]) {
    await assert.rejects(verifyPair(path, fixtureId, compatibility, { ...pair, historyAnchor: invalid }), /anchor/);
  }
  const capturedAt = '2026-10-20T12:30:00.000Z';
  const expires = Date.parse('2026-11-19T12:30:00.000Z');
  const dated = { ...pair, format: 2 as const, capturedAt, historyAnchor };
  let now = expires - 1;
  t.mock.method(Date, 'now', () => now);
  await verifyPair(path, fixtureId, compatibility, dated);
  for (now of [expires, expires + 1]) {
    await assert.rejects(verifyPair(path, fixtureId, compatibility, dated), /has expired/);
  }
  await verifyPair(path, fixtureId, compatibility, pair);
  for (const invalid of ['', '2026-10-20T12:30:00+00:00', '2026-11-20T12:30:00.000Z']) {
    await assert.rejects(verifyPair(path, fixtureId, compatibility, { ...dated, capturedAt: invalid }), /invalid capture time/);
  }

  const unsupported = { ...pair, format: 3 } as unknown as typeof pair;
  await assert.rejects(verifyPair(path, fixtureId, compatibility, unsupported), /unknown identity/);
  await assert.rejects(verifyPair(path, 'c'.repeat(32), compatibility, pair), /unknown identity/);
  await assert.rejects(verifyPair(path, fixtureId, { ...compatibility, appSchema: sha256('other schema') }, pair), /incompatible/);
  await assert.rejects(verifyPair(path, fixtureId, { ...compatibility, keycloakImage: 'other image' }, pair), /incompatible/);
  await assert.rejects(verifyPair(path, fixtureId, compatibility, { ...pair, archives: { 'app-db.tar': pair.archives['app-db.tar'] } }), /incomplete/);
  await assert.rejects(verifyPair(path, fixtureId, compatibility, { ...pair, archives: {
    ...pair.archives, 'identity-db.tar': pair.archives['app-db.tar'],
  } }), /SHA-256/);
  await writeFile(identityPath, identity + ' altered');
  await assert.rejects(verifyPair(path, fixtureId, compatibility, pair), /SHA-256/);
  await rename(identityPath, join(path, 'missing-identity.tar'));
  await assert.rejects(verifyPair(path, fixtureId, compatibility, pair), /missing/);
});

test('backup expiry CLI removes only the opted-in pair archives at the UTC deadline', async t => {
  const root = await mkdtemp(join(tmpdir(), 'maex-cold-expiry-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const cli = resolve('dist/pilot/ops/local/backup.js');
  const archives = ['app-db.tar', 'identity-db.tar'];
  const capturedAt = '2026-10-20T12:30:00.000Z';
  const expires = Date.parse('2026-11-19T12:30:00.000Z');
  const clock = join(root, 'clock.cjs');
  const password = 'a'.repeat(64);
  const create = async (name: string, id: string, retention: object) => {
    const cwd = join(root, name);
    const pilot = join(cwd, 'work', 'pilot');
    const backup = join(pilot, 'cold-backup');
    await mkdir(backup, { recursive: true });
    await writeFile(join(pilot, 'fixture.json'), JSON.stringify({
      schema: 1, id, project: 'maex-pilot-' + id, expiresAt: Date.parse(capturedAt),
      ownerPassword: password, appPassword: password, identityPassword: password, keycloakPassword: password,
    }));
    const records = Object.fromEntries(archives.map(archive => [archive, { sha256: sha256(name + ':' + archive) }]));
    const manifest = JSON.stringify({ fixtureId: id, archives: records, ...retention });
    await writeFile(join(backup, 'pair.json'), manifest);
    for (const archive of archives) await writeFile(join(backup, archive), name + ':' + archive);
    return { cwd, backup, manifest, name };
  };
  const own = await create('disposable', 'a'.repeat(32), { format: 2, capturedAt, disposable: true });
  const control = await create('control', 'b'.repeat(32), { format: 2, capturedAt });
  const legacy = await create('legacy', 'c'.repeat(32), { format: 1 });
  const mismatch = await create('mismatch', 'd'.repeat(32), {
    format: 2, capturedAt, disposable: true, fixtureId: 'e'.repeat(32),
  });
  const run = async (cwd: string, now: number, ...extra: string[]) => {
    await writeFile(clock, 'Date.now = () => ' + now + ';');
    return spawnSync(process.execPath, ['--require', clock, cli, 'expire', ...extra], { cwd, encoding: 'utf8', timeout: 10000 });
  };

  const early = await run(own.cwd, expires - 1);
  assert.equal(early.status, 1);
  assert.match(early.stderr, /has not expired/);
  assert.deepEqual((await readdir(own.backup)).sort(), [...archives, 'pair.json']);
  for (const denied of [control, legacy, mismatch]) {
    const result = await run(denied.cwd, expires + 1);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /requires a disposable pair/);
    for (const archive of archives) {
      assert.equal(await readFile(join(denied.backup, archive), 'utf8'), denied.name + ':' + archive);
    }
    assert.equal(await readFile(join(denied.backup, 'pair.json'), 'utf8'), denied.manifest);
  }
  const pathArgument = await run(own.cwd, expires, control.cwd);
  assert.equal(pathArgument.status, 1);
  assert.match(pathArgument.stderr, /Usage/);
  await writeFile(join(own.backup, archives[1]!), 'unrelated bytes');
  const altered = await run(own.cwd, expires);
  assert.equal(altered.status, 1);
  assert.match(altered.stderr, /requires the original backup archive/);
  assert.equal(await readFile(join(own.backup, archives[0]!), 'utf8'), own.name + ':' + archives[0]);
  assert.equal(await readFile(join(own.backup, archives[1]!), 'utf8'), 'unrelated bytes');
  await writeFile(join(own.backup, archives[1]!), own.name + ':' + archives[1]);
  await writeFile(join(own.backup, 'kept.txt'), 'preserved');
  for (const now of [expires, expires + 1]) {
    const result = await run(own.cwd, now);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Expired both synthetic backup archives/);
    assert.deepEqual((await readdir(own.backup)).sort(), ['kept.txt', 'pair.json']);
    assert.equal(await readFile(join(own.backup, 'pair.json'), 'utf8'), own.manifest);
    assert.equal(await readFile(join(own.backup, 'kept.txt'), 'utf8'), 'preserved');
  }
});
