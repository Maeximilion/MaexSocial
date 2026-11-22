import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { verifyPair } from '../../ops/local/backup.js';
import { postgresImage } from '../../ops/local/stack.js';

test('cold pair verification refuses mixed, incomplete, altered and incompatible backups', async t => {
  const path = await mkdtemp(join(tmpdir(), 'maex-cold-pair-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
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
  const unsupported = { ...pair, format: 2 } as unknown as typeof pair;
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
