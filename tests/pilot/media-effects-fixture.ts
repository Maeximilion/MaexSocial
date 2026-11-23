import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';

const assetPath = '/fixture-text-pilot-asset.txt';
const mediaBytes = Buffer.from('invented #295 fixture media bytes');

export async function withMediaAsset(run: (asset: {
  fields: { attachment: string; mediaUrl: string; objectRef: string };
  controlRequests: number;
  requests: () => number;
}) => Promise<void>) {
  assert.equal(process.env.PILOT_CONTAINER, '1');
  let requests = 0;
  const server = createServer((request, response) => {
    requests++;
    if (request.method !== 'GET' || request.url !== assetPath) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { 'Content-Type': 'text/plain' }).end(mediaBytes);
  });
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const mediaUrl = `http://127.0.0.1:${address.port}${assetPath}`;
    assert.equal(requests, 0);
    const control = await fetch(mediaUrl, { redirect: 'error', signal: AbortSignal.timeout(5000) });
    assert.equal(control.status, 200);
    assert.deepEqual(Buffer.from(await control.arrayBuffer()), mediaBytes);
    assert.equal(requests, 1);
    await run({
      fields: { attachment: mediaBytes.toString(), mediaUrl, objectRef: 'fixture-object-295' },
      controlRequests: requests,
      requests: () => requests - 1,
    });
    assert.equal(requests, 1, 'only the separate harness control requested the asset');
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
}

export async function fixtureFiles(directory: string) {
  const entries = await readdir(directory, { recursive: true, withFileTypes: true });
  const files = await Promise.all(entries.filter(entry => entry.isFile()).map(async entry => {
    const path = join(entry.parentPath, entry.name);
    const bytes = await readFile(path);
    return { path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
      containsMedia: bytes.includes(mediaBytes) };
  }));
  files.sort((a, b) => a.path.localeCompare(b.path));
  assert.equal(files.filter(file => file.containsMedia).length, 0, 'no file contains the synthetic media bytes');
  return { files, bytes: files.reduce((total, file) => total + file.bytes, 0) };
}
