import { randomBytes, createHash, X509Certificate } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { chromium } from 'playwright';
import { compose, docker, loadFixture, verifyContainers } from './fixture.js';

const browserImage = 'mcr.microsoft.com/playwright:v1.65.1-noble@sha256:1507cbfc550a63a6b7396791ca4f00df17beb56342d2447b3f106c306f525579';

async function serve(): Promise<void> {
  const token = process.env.PORTAL_BROWSER_TOKEN;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) throw new Error('Missing browser control token');
  const certificates = ['/customer.crt', ...(process.env.OIDC_BROWSER === '1' ? ['/keycloak.crt'] : [])];
  const pins = await Promise.all(certificates.map(async path => {
    const certificate = new X509Certificate(await readFile(path));
    return createHash('sha256').update(certificate.publicKey.export({ type: 'spki', format: 'der' })).digest('base64');
  }));
  const browser = await chromium.launchServer({ host: '0.0.0.0', port: 3000, wsPath: `/${token}`,
    args: [`--ignore-certificate-errors-spki-list=${pins.join(',')}`] });
  process.on('SIGTERM', () => { void browser.close(); });
  console.log('Portal browser ready.');
}

export async function runPortalBrowserTest(suite: 'entry' | 'portal' | 'oidc' | 'oidc-step-up' | 'invitation' | 'export' = 'portal'): Promise<string> {
  if (!['entry', 'portal', 'oidc', 'oidc-step-up', 'invitation', 'export'].includes(suite)) throw new Error('Unknown browser test suite');
  const needsKeycloak = suite === 'oidc' || suite === 'oidc-step-up';
  const f = await loadFixture(); verifyContainers(f);
  const alias = `portal-browser-${randomBytes(4).toString('hex')}`;
  const name = `${f.project}-${alias}`;
  const token = randomBytes(32).toString('hex');
  const previous = process.env.PORTAL_BROWSER_ENDPOINT;
  await mkdir('work/portal-preview', { recursive: true, mode: 0o700 });
  docker(['run', '-d', '--rm', '--name', name, '--label', `org.maexsocial.fixture=${f.id}`, '--network', `${f.project}_identity`, '--network-alias', alias,
    '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--user', '1000:1000', '--shm-size', '256m',
    '--tmpfs', '/tmp:rw,exec,nosuid,size=1g', '-e', 'HOME=/tmp', '-e', 'PORTAL_BROWSER_TOKEN', '-w', '/workspace',
    '-v', `${resolve('node_modules')}:/workspace/node_modules:ro`, '-v', `${resolve('dist/pilot')}:/workspace/dist/pilot:ro`,
    '-v', `${resolve('work/pilot/customer.crt')}:/customer.crt:ro`,
    ...(needsKeycloak ? ['-v', `${resolve('work/pilot/keycloak.crt')}:/keycloak.crt:ro`, '-e', 'OIDC_BROWSER=1'] : []),
    browserImage, 'node', 'dist/pilot/ops/local/portal-browser.js'],
  { ...process.env, PORTAL_BROWSER_TOKEN: token });
  try {
    const container = JSON.parse(docker(['inspect', name]))[0];
    if (Object.keys(container.NetworkSettings.Networks).join() !== `${f.project}_identity`
      || Object.values(container.NetworkSettings.Ports).some(value => Array.isArray(value) && value.length)
      || container.Config.Labels['org.maexsocial.fixture'] !== f.id) throw new Error('Portal browser is not isolated');
    let ready = false;
    for (let i = 0; i < 50; i++) {
      if (docker(['logs', name]).includes('Portal browser ready.')) { ready = true; break; }
      await setTimeout(100);
    }
    if (!ready) throw new Error('Portal browser did not become ready');
    process.env.PORTAL_BROWSER_ENDPOINT = `ws://${alias}:3000/${token}`;
    return compose(f, ['run', '--rm', '--no-deps', '--use-aliases', '-e', 'PORTAL_BROWSER_ENDPOINT',
      '-v', `${resolve('work/portal-preview')}:/artifacts`, 'runner', 'node', '--test',
      `dist/pilot/tests/pilot/${suite === 'portal' ? 'portal-keyboard' : `${suite}-browser`}.test.js`]);
  } finally {
    if (previous === undefined) delete process.env.PORTAL_BROWSER_ENDPOINT; else process.env.PORTAL_BROWSER_ENDPOINT = previous;
    docker(['rm', '-f', name]);
  }
}

if (require.main === module) serve().catch(() => { console.error('Portal browser startup failed.'); process.exitCode = 1; });
