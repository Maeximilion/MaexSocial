import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash, createSecretKey, randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Readable, Writable } from 'node:stream';
import { test } from 'node:test';
import { decryptArchive, encryptArchive, sealManifest } from '../../ops/local/backup-crypto.js';
import { archiveFile, databases, hashSources, verifyPair, type Pair } from '../../ops/local/backup.js';
import { postgresImage } from '../../ops/local/stack.js';

const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

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
  const withProvenance = await hashSources(['ops/local/keycloak-realm.json', 'ops/local/keycloak-step-up.json', 'ops/local/stack.ts']);
  await verifyPair(path, fixtureId, { ...compatibility, idpConfig: withProvenance },
    { ...pair, compatibility: { ...compatibility, idpConfig: beforeReopen } });
  const migration = '011_approval_tenant_version.up.sql';
  const through011 = (await readdir('db/migrations')).filter(name => name.endsWith('.up.sql') && name <= migration)
    .sort().map(name => 'db/migrations/' + name);
  const schema010 = { ...compatibility, appSchema: await hashSources(through011.slice(0, -1)) };
  const schema011 = { ...compatibility, appSchema: await hashSources(through011) };
  await verifyPair(path, fixtureId, schema011, { ...pair, compatibility: schema010 });
  const schema012 = { ...compatibility, appSchema: await hashSources([...through011, 'db/migrations/012_approval_withdrawal.up.sql']) };
  await verifyPair(path, fixtureId, schema012, { ...pair, compatibility: schema010 });
  await verifyPair(path, fixtureId, schema012, { ...pair, compatibility: schema011 });
  const schema013 = { ...compatibility, appSchema: await hashSources([
    ...through011, 'db/migrations/012_approval_withdrawal.up.sql', 'db/migrations/013_attempt_retention.up.sql',
  ]) };
  const schema014 = { ...compatibility, appSchema: await hashSources((await readdir('db/migrations'))
    .filter(name => name.endsWith('.up.sql') && name <= '014_fixture_fact_erasure.up.sql').sort()
    .map(name => 'db/migrations/' + name)) };
  await verifyPair(path, fixtureId, schema014, { ...pair, compatibility: schema013 });
  const schema015 = { ...compatibility, appSchema: await hashSources((await readdir('db/migrations'))
    .filter(name => name.endsWith('.up.sql') && name <= '015_fixture_audit_retention.up.sql').sort()
    .map(name => 'db/migrations/' + name)) };
  const current = { ...compatibility, appSchema: await hashSources((await readdir('db/migrations'))
    .filter(name => name.endsWith('.up.sql')).sort().map(name => 'db/migrations/' + name)) };
  await verifyPair(path, fixtureId, current, { ...pair, compatibility: schema015 });
  await assert.rejects(verifyPair(path, fixtureId, schema015, { ...pair, compatibility: current }), /incompatible/);
  await verifyPair(path, fixtureId, schema015, { ...pair, compatibility: schema014 });
  await assert.rejects(verifyPair(path, fixtureId, schema014, { ...pair, compatibility: schema015 }), /incompatible/);
  await assert.rejects(verifyPair(path, fixtureId, schema013, { ...pair, compatibility: schema014 }), /incompatible/);
  for (const source of [schema010, schema011, schema012]) {
    await verifyPair(path, fixtureId, schema013, { ...pair, compatibility: source });
    await assert.rejects(verifyPair(path, fixtureId, source, { ...pair, compatibility: schema013 }), /incompatible/);
  }
  await assert.rejects(verifyPair(path, fixtureId, schema011, { ...pair, compatibility: schema012 }), /incompatible/);
  await assert.rejects(verifyPair(path, fixtureId, schema010, { ...pair, compatibility: schema011 }), /incompatible/);
  await assert.rejects(verifyPair(path, fixtureId, schema011, pair), /incompatible/);
  await assert.rejects(verifyPair(path, fixtureId, schema011,
    { ...pair, compatibility: { ...schema010, stack: sha256('other stack') } }), /incompatible/);
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

  const unsupported = { ...pair, format: 4 } as unknown as typeof pair;
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

test('encrypted pairs bind metadata, ciphertext, source and role before import completion', async t => {
  const root = await mkdtemp(join(tmpdir(), 'maex-encrypted-pair-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'source', 'cold-backup');
  await mkdir(path, { recursive: true });
  const key = createSecretKey(randomBytes(32));
  const wrong = createSecretKey(randomBytes(32));
  const fixtureId = 'a'.repeat(32);
  const compatibility = {
    appSchema: sha256('app schema'), idpConfig: sha256('identity config'), stack: sha256('stack'),
    keycloakImage: 'quay.io/keycloak/keycloak:26.8.2@sha256:' + sha256('identity image'),
  };
  const pair: Pair = {
    format: 3, capturedAt: new Date().toISOString(), fixtureId, revision: 'b'.repeat(40), compatibility,
    postgresImage, appliedAppSchema: sha256('applied schema'), identitySchema: sha256('identity schema'),
    historyAnchor: { after: 1, evidenceSha256: sha256('capture history') }, archives: {},
  };
  const [app, idp] = databases;
  const appPath = join(path, archiveFile(app, 3));
  const identityPath = join(path, archiveFile(idp, 3));
  const plaintext = 'synthetic physical AppDB test content';
  for (const db of databases) {
    const file = join(path, archiveFile(db, 3));
    const encryption = await encryptArchive(Readable.from([Buffer.from(plaintext)]), file, key, fixtureId, db.archive);
    pair.archives[db.archive] = {
      encryption, sha256: sha256(await readFile(file)), catalogVersion: '202406281',
      systemId: db === app ? '123' : '456',
    };
  }
  await sealManifest(path, pair, key);
  const verify = (manifest: Pair, useKey = key) => verifyPair(path, fixtureId, compatibility, manifest, useKey);
  await verify(pair);
  await assert.rejects(verify(pair, wrong), /manifest authentication/);
  for (const modified of [
    { ...pair, revision: 'c'.repeat(40) },
    { ...pair, disposable: true as const },
    { ...pair, capturedAt: '2025-01-01T00:00:00.000Z' },
    { ...pair, historyAnchor: { ...pair.historyAnchor!, after: 2 } },
  ]) await assert.rejects(verify(modified), /manifest authentication/);
  const downgraded = { ...pair, format: 2 as const };
  await assert.rejects(verify(downgraded), /format mismatch/);
  assert.deepEqual((await readdir(path)).sort(), ['app-db.tar.enc', 'identity-db.tar.enc', 'pair.auth']);
  const appBytes = await readFile(appPath);
  const identityBytes = await readFile(identityPath);
  assert.equal(appBytes.includes(Buffer.from(plaintext)), false);
  assert.equal(appBytes.equals(identityBytes), false);

  const appRecord = pair.archives[app.archive]!;
  const idpRecord = pair.archives[idp.archive]!;
  const trailer = async (file: string, record: typeof idpRecord) => {
    const chunks: Buffer[] = [];
    const output = new Writable({ write(chunk, _encoding, callback) { chunks.push(chunk); callback(); } });
    const stream = decryptArchive(file, record.encryption!, record.sha256, key, fixtureId, idp.archive, output);
    return { stream, data: () => Buffer.concat(chunks).toString('ascii') };
  };
  const complete = await trailer(identityPath, idpRecord);
  await complete.stream;
  assert.equal(complete.data(), plaintext + sha256(plaintext));

  const mixed = { ...pair, archives: { [app.archive]: appRecord, [idp.archive]: { ...appRecord, systemId: idpRecord.systemId } } };
  await writeFile(identityPath, appBytes);
  await assert.rejects(verify(pair), /authentication or SHA-256/);
  await rm(join(path, 'pair.auth'));
  await sealManifest(path, mixed, key);
  await assert.rejects(verify(mixed), /archive authentication/);
  const unchecked = await trailer(identityPath, mixed.archives[idp.archive]!);
  await assert.rejects(unchecked.stream, /archive authentication/);
  assert.ok(unchecked.data().length <= plaintext.length);

  await writeFile(identityPath, identityBytes.subarray(0, -1));
  await rm(join(path, 'pair.auth'));
  await sealManifest(path, pair, key);
  await assert.rejects(verify(pair), /length is invalid/);
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

test('encrypted expiry authenticates the disposable deadline and permits a partial retry', async t => {
  const root = await mkdtemp(join(tmpdir(), 'maex-encrypted-expiry-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const cwd = join(root, 'source');
  const pilot = join(cwd, 'work', 'pilot');
  const backup = join(pilot, 'cold-backup');
  await mkdir(backup, { recursive: true });
  const keyPath = join(root, 'synthetic-key');
  const wrongPath = join(root, 'wrong-key');
  const keyBytes = randomBytes(32);
  const key = createSecretKey(keyBytes);
  await writeFile(keyPath, keyBytes, { mode: 0o600 });
  await writeFile(wrongPath, randomBytes(32), { mode: 0o600 });
  keyBytes.fill(0);
  const capturedAt = '2026-10-20T12:30:00.000Z';
  const expires = Date.parse('2026-11-19T12:30:00.000Z');
  const fixtureId = 'a'.repeat(32);
  const password = 'b'.repeat(64);
  await writeFile(join(pilot, 'fixture.json'), JSON.stringify({
    schema: 1, id: fixtureId, project: 'maex-pilot-' + fixtureId, expiresAt: Date.parse(capturedAt),
    ownerPassword: password, appPassword: password, identityPassword: password, keycloakPassword: password,
  }));
  const archives: Record<string, { sha256: string }> = {};
  const files: string[] = [];
  for (const db of databases) {
    const file = join(backup, archiveFile(db, 3));
    files.push(file);
    await encryptArchive(Readable.from([Buffer.from('synthetic test contents')]), file, key, fixtureId, db.archive);
    archives[db.archive] = { sha256: sha256(await readFile(file)) };
  }
  const pair = { format: 3, fixtureId, capturedAt, disposable: true, archives };
  const manifest = join(backup, 'pair.json');
  const clock = join(root, 'clock.cjs');
  const cli = resolve('dist/pilot/ops/local/backup.js');
  await writeFile(join(backup, 'unrelated.txt'), 'preserved');
  await writeFile(manifest, JSON.stringify({ ...pair, disposable: undefined }));
  await sealManifest(backup, pair, key);
  const run = async (now: number, file = keyPath) => {
    await writeFile(clock, 'Date.now = () => ' + now + ';');
    return spawnSync(process.execPath, ['--require', clock, cli, 'expire'], {
      cwd, encoding: 'utf8', timeout: 10000, env: { ...process.env, MAEX_COLD_BACKUP_KEY_FILE: file },
    });
  };
  assert.match((await run(expires)).stderr, /requires a disposable pair/);
  await writeFile(manifest, JSON.stringify({ ...pair, capturedAt: '2025-10-20T12:30:00.000Z' }));
  assert.match((await run(expires)).stderr, /manifest authentication/);
  await writeFile(manifest, JSON.stringify(pair));
  assert.match((await run(expires, '')).stderr, /private, external 32-byte/);
  assert.match((await run(expires, wrongPath)).stderr, /manifest authentication/);
  assert.match((await run(expires - 1)).stderr, /has not expired/);
  assert.equal((await readdir(backup)).length, 5);
  await rm(files[0]!);
  for (const now of [expires, expires + 1]) {
    const result = await run(now);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual((await readdir(backup)).sort(), ['pair.auth', 'pair.json', 'unrelated.txt']);
    assert.equal(await readFile(join(backup, 'unrelated.txt'), 'utf8'), 'preserved');
  }
});
