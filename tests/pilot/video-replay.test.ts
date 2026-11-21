import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test, type TestContext } from 'node:test';

function fixture(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'maex-video-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const receipts = join(directory, 'fake-acceptances.jsonl');
  const job = 'fictional-carton';
  function invoke(...args: string[]) {
    const result = spawnSync(process.execPath, ['dist/pilot/ops/local/video-replay.js', directory, ...args], { encoding: 'utf8' });
    if (result.error) throw result.error;
    return result;
  }
  function read(...args: string[]) {
    const result = invoke(...args);
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  }
  function acceptAndLoseReply() {
    const result = invoke('submit', job);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Fictional reply lost after acceptance/);
  }
  function acceptedJobs() {
    return existsSync(receipts) ? readFileSync(receipts, 'utf8').trimEnd().split('\n').map(line => JSON.parse(line).job) : [];
  }
  return { job, read, acceptAndLoseReply, acceptedJobs, database: join(directory, 'runner.sqlite') };
}

test('reconciliation before any writes leaves the fresh fixture empty', t => {
  const f = fixture(t);
  assert.deepEqual(f.read('reconcile', f.job), { stopped: false, attempt: null });
  assert.equal(existsSync(f.database), false);
  assert.deepEqual(f.acceptedJobs(), []);
});

test('lost reply, reopened replay and read-only reconciliation keep one actual submission', t => {
  const f = fixture(t);
  f.acceptAndLoseReply();
  assert.deepEqual(f.acceptedJobs(), [f.job]);
  const attempt = { job: f.job, outcome: 'unknown', charge: 'unknown', reservation: 'held' };
  assert.deepEqual(f.read('submit', f.job), { stopped: false, attempt });
  const runningDatabase = readFileSync(f.database);
  for (let i = 0; i < 2; i++) assert.deepEqual(f.read('reconcile', f.job), { stopped: false, attempt });
  assert.deepEqual(f.read('reconcile', 'fictional-second'), { stopped: false, attempt: null });
  assert.deepEqual(readFileSync(f.database), runningDatabase);
  assert.deepEqual(f.acceptedJobs(), [f.job]);
  assert.deepEqual(f.read('stop'), { stopped: true });
  assert.deepEqual(f.read('submit', 'fictional-second'), { stopped: true, attempt: null });
  const before = readFileSync(f.database);
  for (let i = 0; i < 2; i++) assert.deepEqual(f.read('reconcile', f.job), { stopped: true, attempt });
  assert.deepEqual(readFileSync(f.database), before);
  assert.deepEqual(f.acceptedJobs(), [f.job]);
});

test('stop before dispatch survives reopening with no accepted job or reservation', t => {
  const f = fixture(t);
  assert.deepEqual(f.read('stop'), { stopped: true });
  assert.deepEqual(f.read('submit', f.job), { stopped: true, attempt: null });
  assert.deepEqual(f.read('submit', f.job), { stopped: true, attempt: null });
  assert.deepEqual(f.read('reconcile', f.job), { stopped: true, attempt: null });
  assert.deepEqual(f.acceptedJobs(), []);
});
