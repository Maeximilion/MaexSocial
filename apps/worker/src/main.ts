import { lstat } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { compose, connectFixture, loadFixture, requireWorkerFixtureDatabase, usesLocalDocker,
  verifyContainers } from '../../../ops/local/fixture.js';
import { uuid } from '../../../packages/contracts/management.js';
import type { GbpReadback } from '../../../packages/contracts/pilot.js';
import { installedPilotSchema } from '../../../scripts/pilot-db.js';
import { claimDispatch } from './dispatch.js';
import { grantDirectory, withDisposableGrant } from './disposable-grant.js';
import { FakeGbp, providerStateDirectory } from './fake-gbp.js';
import { reconcileOccurrence } from './reconcile.js';

async function wake(occurrenceId: string, grantFixture: string | null) {
  let adapter: FakeGbp | undefined;
  const fake = () => adapter ??= new FakeGbp();
  const readback = { readback: (attempt: Parameters<GbpReadback['readback']>[0]) =>
    grantFixture ? withDisposableGrant(grantFixture, attempt, 'readback', () => fake().readback(attempt)) : fake().readback(attempt) };

  try {
    const existing = await reconcileOccurrence(connectFixture, occurrenceId, readback);
    if (existing !== null) return existing;
    try {
      await claimDispatch(connectFixture, occurrenceId, {
        policy: 'synthetic-organic-text',
        create: async intent => {
          if (!grantFixture) return fake().create(intent);
          const receipt = await withDisposableGrant(grantFixture, intent, 'create', () => fake().create(intent));
          if (!receipt) throw new Error('Disposable grant unavailable');
          return receipt;
        },
      });
      return 'in_flight';
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'Denied') throw error;
      // A competing wake may have committed the claim since the initial read.
      return await reconcileOccurrence(connectFixture, occurrenceId, readback) ?? 'denied';
    }
  } finally {
    adapter?.close();
  }
}

async function main(): Promise<void> {
  const occurrenceId = process.argv[2];
  if (process.argv.length !== 3 || occurrenceId === undefined || !uuid(occurrenceId)) throw new Error('Invalid wake');
  if (relative(resolve(__dirname, '../../../../..'), process.cwd()) !== '') throw new Error('Worker worktree required');
  const fixture = await loadFixture();
  if ((fixture.purpose !== 'ordinary' && fixture.purpose !== 'grant-retirement') || fixture.restoreTarget || fixture.pairedRestore) {
    throw new Error('Ordinary fixture required');
  }

  if (process.env.PILOT_CONTAINER !== '1') {
    if (!usesLocalDocker() || !(await lstat(providerStateDirectory)).isDirectory()) {
      throw new Error('Local fixture required');
    }
    verifyContainers(fixture, true);
    const privateMount: string[] = [];
    if (fixture.purpose === 'grant-retirement') {
      const directory = grantDirectory(fixture.id, false);
      if (!(await lstat(directory)).isDirectory()) throw new Error('Private fixture store required');
      privateMount.push('--volume', `${directory}:${grantDirectory(fixture.id, true)}:ro`);
    }
    const output = compose(fixture, ['run', '--rm', '-T', '--no-deps', '--pull', 'never',
      '--volume', resolve(providerStateDirectory) + ':/workspace/' + providerStateDirectory,
      ...privateMount, 'runner', 'node', 'dist/pilot/apps/worker/src/main.js', occurrenceId]);
    console.log(output);
    return;
  }

  const owner = await connectFixture(true);
  try {
    await requireWorkerFixtureDatabase(owner, fixture.id, fixture.purpose);
    if (!Object.values(await installedPilotSchema(owner)).every(Boolean)) throw new Error('Current pilot schema required');
  } finally {
    await owner.end();
  }

  console.log(JSON.stringify({ state: await wake(occurrenceId, fixture.purpose === 'grant-retirement' ? fixture.id : null) }));
}

main().catch(() => {
  console.error('Local worker wake refused or failed.');
  process.exitCode = 1;
});
