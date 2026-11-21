// Separate OS process for the local PostgreSQL race; no provider or credential action.
import { readFile } from 'node:fs/promises';
import { createAuthThrottle } from '../../apps/web/src/server/auth-throttle.js';
import { connectFixture } from '../../ops/local/fixture.js';

async function main(): Promise<void> {
  if (process.env.PILOT_CONTAINER !== '1' || !process.send) throw new Error('Isolated IPC runner required');
  const throttle = createAuthThrottle(await readFile('work/pilot/throttle-key', 'utf8'), connectFixture, 'login');
  process.send(await throttle.consume('process@example.invalid', '192.0.2.1'));
  process.disconnect();
}
main().catch(() => { process.exitCode = 1; process.disconnect?.(); });
