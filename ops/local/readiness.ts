import { lstat } from 'node:fs/promises';
import { compose, loadFixture, usesLocalDocker, validateFixture, verifyContainers } from './fixture.js';
import { httpsReady, initialize } from './stack.js';

const component = 'mailbox';

async function drill(): Promise<void> {
  const existing = await lstat('work/pilot').catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
  });
  if (existing) {
    console.error('Readiness drill requires a fresh worktree without work/pilot.');
    process.exitCode = 1;
    return;
  }
  if (!usesLocalDocker()) {
    console.error('Readiness drill requires a local Docker socket.');
    process.exitCode = 1;
    return;
  }

  const fixture = await initialize('readiness');
  validateFixture(fixture);
  const probe = (phase: 'baseline' | 'outage' | 'recovery', started: number) => {
    const status = compose(fixture, ['run', '--rm', '-T', '--no-deps', '--pull', 'never', 'runner', 'node',
      'dist/pilot/ops/local/readiness.js', phase === 'outage' ? 'probe' : 'wait']);
    if (status !== (phase === 'outage' ? 'unavailable' : 'ready')) throw new Error('Unexpected readiness result');
    console.log(JSON.stringify({ phase, at: new Date().toISOString(), component, status,
      elapsedMs: Math.round(performance.now() - started) }));
  };

  try {
    const initialStart = performance.now();
    compose(fixture, ['up', '-d', '--pull', 'never', '--wait', '--wait-timeout', '120']);
    verifyContainers(fixture);
    const mailboxId = compose(fixture, ['ps', '-q', component]);
    if (!/^[a-f0-9]{64}$/.test(mailboxId)) throw new Error('Unknown fixture mailbox');
    probe('baseline', initialStart);

    const stop = performance.now();
    compose(fixture, ['stop', component]);
    if (compose(fixture, ['ps', '-a', '-q', '--status', 'exited', component]) !== mailboxId) {
      throw new Error('Fixture mailbox did not stop');
    }
    probe('outage', stop);

    const restart = performance.now();
    compose(fixture, ['start', component]);
    verifyContainers(fixture);
    if (compose(fixture, ['ps', '-q', component]) !== mailboxId) throw new Error('Fixture mailbox was replaced');
    probe('recovery', restart);
  } finally {
    compose(fixture, ['down']);
  }
}

async function main(): Promise<void> {
  const action = process.argv[2];
  if (process.env.PILOT_CONTAINER === '1' && process.argv.length === 3 && (action === 'probe' || action === 'wait')) {
    await loadFixture();
    console.log(await httpsReady(component, action === 'wait') ? 'ready' : 'unavailable');
  } else if (process.argv.length === 2) {
    await drill();
  } else {
    console.error('Usage: npm run pilot:readiness');
    process.exitCode = 1;
  }
}

main().catch(() => {
  console.error('Local fixture readiness drill failed.');
  process.exitCode = 1;
});
