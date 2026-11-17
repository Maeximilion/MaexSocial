import assert from 'node:assert/strict';
import { test } from 'node:test';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';

test('session migration excludes provisional lifecycle and credential storage', async () => {
  if (process.env.PILOT_CONTAINER !== '1') {
    console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/access-storage.test.js'])); return;
  }
  const db = await connectFixture();
  try {
    for (const name of ['identity_operations', 'identity_completions', 'browser_flows', 'public_sessions', 'rate_windows']) {
      assert.equal((await db.query('SELECT to_regclass($1) AS name', [`pilot.${name}`])).rows[0].name, null);
    }
    const columns = (await db.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='pilot'")).rows;
    assert.ok(!columns.some(r => /password|totp_secret|access_token|refresh_token|generation|lifecycle/.test(r.column_name)));
    assert.ok(['csrf_hash', 'tenant_version', 'mfa_credential_id'].every(name => columns.some(r => r.table_name === 'sessions' && r.column_name === name)));
  } finally { await db.end(); }
});
