import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';
import { FakeGbp } from '../../apps/worker/src/fake-gbp.js';

const intent = { tenantId: 'orchard', occurrenceId: 'spring', attemptId: 'first', location: 'locations/grove' };

async function directory(t: TestContext): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), 'maex-fake-gbp-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  return path;
}

test('every create counts across handles and other tenants and occurrences stay separate', async t => {
  const path = await directory(t);
  const first = new FakeGbp(path);
  const second = new FakeGbp(path);
  try {
    await assert.rejects(first.create({ ...intent, attemptId: '' }), /identifiers/);
    const [a, b] = await Promise.all([first.create(intent), second.create(intent)]);
    assert.notEqual(a.resourceName, b.resourceName);
    await second.create({ ...intent, tenantId: 'nursery' });
    await first.create({ ...intent, occurrenceId: 'summer' });
    assert.equal(second.createCount('orchard', 'spring'), 2);
    assert.equal(first.createCount('nursery', 'spring'), 1);
    assert.equal(second.createCount('orchard', 'summer'), 1);
    assert.equal(first.createCount('nursery', 'summer'), 0);
    const observed = await first.readback(intent);
    assert.equal(observed.correlation, 'ambiguous');
    assert.deepEqual(observed.candidates.map(c => c.resourceName), [a.resourceName, b.resourceName]);
    assert.deepEqual((await second.readback({ ...intent, resourceName: b.resourceName })).candidates,
      [{ resourceName: b.resourceName, state: 'PROCESSING' }]);
  } finally { first.close(); second.close(); }
});

test('lost reply survives reopen; polling observes the clock without writing or advancing the script', async t => {
  const path = await directory(t);
  let now = 1000;
  const clock = () => now;
  const sending = new FakeGbp(path, { clock, loseReply: true, frames: [
    { afterMs: 0, candidates: ['PROCESSING'] }, { afterMs: 50, candidates: ['LIVE'] },
  ] });
  try { await assert.rejects(sending.create(intent), /lost after acceptance/); }
  finally { sending.close(); }

  const reopened = new FakeGbp(path, { clock });
  try {
    const db = join(path, 'fake-gbp.sqlite');
    const bytes = await readFile(db);
    assert.equal(reopened.createCount('orchard', 'spring'), 1);
    const processing = await reopened.readback(intent);
    assert.equal(processing.candidates[0]?.state, 'PROCESSING');
    assert.deepEqual(await reopened.readback(intent), processing);
    now += 50;
    const live = await reopened.readback(intent);
    assert.deepEqual(live, { observedAt: 1050, location: intent.location, correlation: 'unique',
      candidates: [{ resourceName: processing.candidates[0]!.resourceName, state: 'LIVE' }] });
    assert.deepEqual(await reopened.readback(intent), live);
    for (const other of [{ tenantId: 'nursery' }, { occurrenceId: 'summer' },
      { attemptId: 'another' }, { location: 'locations/hill' }, { resourceName: 'unrelated' }]) {
      const miss = await reopened.readback({ ...intent, ...other });
      assert.equal(miss.correlation, 'missing');
      assert.deepEqual(miss.candidates, []);
    }
    assert.equal(reopened.createCount('orchard', 'spring'), 1);
    assert.deepEqual(await readFile(db), bytes);
  } finally { reopened.close(); }
});

test('script distinguishes absent, ambiguous LIVE and uniquely correlated rejection', async t => {
  const path = await directory(t);
  let now = 0;
  const fake = new FakeGbp(path, { clock: () => now, frames: [
    { afterMs: 0, candidates: [] }, { afterMs: 1, candidates: ['LIVE', 'LIVE'] },
    { afterMs: 2, candidates: ['REJECTED'] },
  ] });
  try {
    const receipt = await fake.create(intent);
    assert.equal((await fake.readback(intent)).correlation, 'missing');
    now++;
    const ambiguous = await fake.readback(intent);
    assert.equal(ambiguous.correlation, 'ambiguous');
    assert.deepEqual(ambiguous.candidates.map(c => c.state), ['LIVE', 'LIVE']);
    assert.notEqual(ambiguous.candidates[0]?.resourceName, ambiguous.candidates[1]?.resourceName);
    now++;
    const rejected = await fake.readback(intent);
    assert.deepEqual(rejected, { location: receipt.location, observedAt: now, correlation: 'unique',
      candidates: [{ resourceName: receipt.resourceName, state: 'REJECTED' }] });
    assert.equal(fake.createCount('orchard', 'spring'), 1);
  } finally { fake.close(); }
});
