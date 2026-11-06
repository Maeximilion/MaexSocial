import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateFixture, safeDiagnostics, verifyTopology, type Fixture } from '../../ops/local/fixture.js';

test('fixture validation rejects altered target, expired fixture and unknown schema', () => {
  const fixture = { schema: 1, id: 'a'.repeat(32), project: `maex-pilot-${'a'.repeat(32)}`,
    expiresAt: Date.now() + 10000, ownerPassword: 'b'.repeat(64), appPassword: 'c'.repeat(64),
    identityPassword: 'd'.repeat(64), keycloakPassword: 'e'.repeat(64) };
  assert.doesNotThrow(() => validateFixture(fixture));
  for (const value of [null, {}, { ...fixture, project: 'production' }, { ...fixture, schema: 2 },
    { ...fixture, expiresAt: Date.now() - 1 }, { ...fixture, expiresAt: Infinity },
    { ...fixture, id: '../production' }, { ...fixture, appPassword: "supplied' SQL" }]) {
    assert.throws(() => validateFixture(value));
  }
  assert.doesNotThrow(() => validateFixture({ ...fixture, expiresAt: 0 }, true));
});

test('runtime guard rejects an added external network on every fixture service', () => {
  const f = { id: 'a'.repeat(32), project: `maex-pilot-${'a'.repeat(32)}` } as Fixture;
  const networks = ['application', 'identity'].map(name => ({ Id: name, Name: `${f.project}_${name}`,
    Internal: true, Labels: { 'com.docker.compose.project': f.project } }));
  const containers = ['postgres', 'identity-db', 'keycloak', 'mailbox'].map(name => ({
    Config: { Labels: { 'org.maexsocial.fixture': f.id, 'com.docker.compose.project': f.project, 'com.docker.compose.service': name } },
    NetworkSettings: { Ports: {}, Networks: { [`${f.project}_${name === 'postgres' ? 'application' : 'identity'}`]: { NetworkID: name === 'postgres' ? 'application' : 'identity' } } }
  }));
  assert.doesNotThrow(() => verifyTopology(f, containers, networks));
  for (let index = 0; index < containers.length; index++) {
    const altered = structuredClone(containers);
    altered[index]!.NetworkSettings.Networks.bridge = { NetworkID: 'external' };
    assert.throws(() => verifyTopology(f, altered, networks));
  }
  assert.throws(() => verifyTopology(f, containers.slice(1), networks));
  assert.throws(() => verifyTopology(f, containers, networks.map(n => ({ ...n, Internal: false }))));
});

test('diagnostics preserve failures without printing generated secrets or private keys', () => {
  const text = `permission denied ${'a'.repeat(64)}\n-----BEGIN PRIVATE KEY-----\ncanary\n-----END PRIVATE KEY-----`;
  const safe = safeDiagnostics(text);
  assert.match(safe, /permission denied/);
  assert.ok(!safe.includes('a'.repeat(64)) && !safe.includes('canary'));
});
