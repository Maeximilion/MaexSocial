import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { connect as tcp } from 'node:net';
import { connect as tls } from 'node:tls';
import { test } from 'node:test';
import { runIsolated } from '../../ops/local/fixture.js';

test('the configured identity mail transport receives a verified SMTP greeting', async () => {
  if (process.env.PILOT_CONTAINER !== '1') {
    console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/smtp.test.js']));
    return;
  }
  const { smtpServer: smtp } = JSON.parse(await readFile('ops/local/keycloak-realm.json', 'utf8'));
  assert.equal(smtp.host, 'mailbox');
  const ca = await readFile('work/pilot/mailbox.crt');
  async function greeting(encrypted: boolean): Promise<string> {
    return new Promise((resolve, reject) => {
      const options = { host: smtp.host, port: Number(smtp.port) };
      const socket = encrypted ? tls({ ...options, servername: smtp.host, ca, rejectUnauthorized: true }) : tcp(options);
      socket.setTimeout(1500);
      socket.once('timeout', () => socket.destroy(new Error('SMTP greeting timeout')));
      socket.once('error', reject);
      socket.once('data', bytes => { socket.destroy(); resolve(bytes.toString().slice(0, 3)); });
    });
  }
  assert.equal(await greeting(smtp.ssl === 'true'), '220');
  await assert.rejects(greeting(false), /SMTP greeting timeout/);
});
