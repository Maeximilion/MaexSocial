import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const restore = resolve('dist/pilot/ops/local/restore.js');

test('paired restore refuses an existing target before contacting its source or Docker', async t => {
  const root = await mkdtemp(join(tmpdir(), 'maex-pair-target-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const target = join(root, 'work', 'pilot');
  await mkdir(target, { recursive: true });
  for (const marker of ['fixture.json', 'nonempty-target']) {
    await writeFile(join(target, marker), 'preserve this target');
    const result = spawnSync(process.execPath, [restore, join(root, 'missing-source')], {
      cwd: root, encoding: 'utf8', timeout: 10000,
    });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /Paired restore requires a fresh worktree without work\/pilot/);
    const imported = spawnSync(process.execPath, ['-e', `
      const { restore } = require(process.argv[1]);
      restore('missing-source', () => { throw new Error('Unexpected target ownership'); })
        .catch(error => { console.error(error.message); process.exitCode = 1; });
    `, restore], { cwd: root, encoding: 'utf8', timeout: 10000 });
    assert.equal(imported.status, 1);
    assert.equal(imported.stdout, '');
    assert.match(imported.stderr, /^Paired restore requires a fresh worktree without work\/pilot\./);
    assert.equal(await readFile(join(target, marker), 'utf8'), 'preserve this target');
  }
  assert.deepEqual((await readdir(target)).sort(), ['fixture.json', 'nonempty-target']);
});
