import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { get } from 'node:https';
import { test } from 'node:test';
import { previewEmployeeInvitation } from '../../apps/web/src/routes/employees.js';
import { issueEmployeeInvitation } from '../../apps/web/src/server/invitation-issue.js';
import { requireCustomer, tokenHash } from '../../apps/web/src/server/session.js';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';

interface MailpitMessage {
  From: { Address: string };
  To: { Address: string }[];
  Cc?: unknown[];
  Bcc?: unknown[];
  Subject: string;
  Text: string;
}

function mailboxRead<T>(ca: Buffer, path: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = get({ hostname: 'mailbox', port: 8025, ca, path, signal: AbortSignal.timeout(5000) }, res => {
      res.setEncoding('utf8');
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('error', reject);
      res.on('end', () => {
        try {
          assert.equal(res.statusCode, 200);
          resolve(JSON.parse(body) as T);
        } catch { reject(new Error('Mailbox observation failed')); }
      });
    });
    req.on('error', reject);
  });
}

test('private Employee invitation issuance and resend use the current issuer and only the local mailbox', async t => {
  if (process.env.PILOT_CONTAINER !== '1') {
    console.log(await runIsolated(['--test', 'dist/pilot/tests/pilot/invitation-issue.test.js']));
    return;
  }
  const db = await connectFixture(true);
  t.after(() => db.end());
  const mailboxCa = await readFile('work/pilot/mailbox.crt');
  const countMail = async () => (await mailboxRead<{ Messages: number }>(mailboxCa, '/api/v1/info')).Messages;
  const now = new Date(Date.now() - 30_000);
  const clock = () => now;
  const email = `employee-${randomUUID()}@example.invalid`;
  const tenantA = randomUUID(), tenantB = randomUUID();
  const tenantName = 'Invented studio A';
  await db.query("INSERT INTO pilot.tenants(id,name) VALUES ($1,$2),($3,'Invented studio B')", [tenantA, tenantName, tenantB]);
  const principal = async (tenantId: string, role: 'Manager' | 'Employee', proofAge: number, enrolled = true) => {
    const subject = randomUUID(), identityId = randomUUID(), membershipId = randomUUID();
    const sessionToken = randomBytes(32).toString('hex');
    await db.query('INSERT INTO pilot.identities(id,subject,verified) VALUES ($1,$2,true)', [identityId, subject]);
    await db.query('INSERT INTO pilot.memberships(tenant_id,id,identity_id,role) VALUES ($1,$2,$3,$4)', [tenantId, membershipId, identityId, role]);
    await db.query(`INSERT INTO pilot.sessions
      (token_hash,identity_id,identity_version,tenant_id,tenant_version,membership_id,membership_version,
       audience,created_at,last_seen_at,expires_at,mfa_at,mfa_credential_id)
      VALUES ($1,$2,1,$3,1,$4,1,'customer',$5::timestamptz - interval '10 minutes',$5,$5 + interval '1 hour',$6,'fixture-factor')`,
    [tokenHash(sessionToken), identityId, tenantId, membershipId, now, new Date(now.getTime() - proofAge)]);
    const issuer = {
      connect: connectFixture, clock, mailboxCa,
      authorize: (connection: typeof db) => requireCustomer(connection, sessionToken, clock, async () => ({
        subject, enabled: true, verified: true, requiredActions: [],
        credentials: enrolled ? [{ id: 'fixture-factor', type: 'otp' }] : []
      }))
    };
    return { issuer, membershipId };
  };
  const manager = await principal(tenantA, 'Manager', 300_000);
  const otherManager = await principal(tenantA, 'Manager', 0);
  const managerB = await principal(tenantB, 'Manager', 0);
  const employee = await principal(tenantA, 'Employee', 0);
  const expired = await principal(tenantA, 'Manager', 300_001);
  const future = await principal(tenantA, 'Manager', -1);
  const unenrolled = await principal(tenantA, 'Manager', 0, false);
  const access = async () => ({
    identities: (await db.query('SELECT * FROM pilot.identities ORDER BY id')).rows,
    memberships: (await db.query('SELECT * FROM pilot.memberships ORDER BY tenant_id,id')).rows,
    pending: (await db.query('SELECT * FROM pilot.pending_access ORDER BY id')).rows
  });
  const invitations = async () => (await db.query(
    'SELECT * FROM pilot.invitations WHERE tenant_id=ANY($1::uuid[]) ORDER BY id', [[tenantA, tenantB]])).rows;
  const initialAccess = await access();
  const initialMail = await countMail();

  const latestToken = async (recipient = email) => {
    const message = await mailboxRead<MailpitMessage>(mailboxCa, '/api/v1/message/latest');
    assert.deepEqual(message.To.map(x => x.Address), [recipient]);
    assert.equal(message.Cc?.length ?? 0, 0);
    assert.equal(message.Bcc?.length ?? 0, 0);
    assert.equal(message.From.Address, 'invitations@example.invalid');
    assert.equal(message.Subject, 'Employee invitation');
    const body = message.Text.replaceAll('\r\n', '\n').trim();
    const token = /#([a-f0-9]{64})$/.exec(body)?.[1];
    assert.ok(token, 'The isolated mailbox contains an opaque invitation');
    assert.equal(body === `You have been invited as an Employee. The invitation expires after 24 hours.\n\nhttps://customer:8443/customer/invitations/preview#${token}`,
      true, 'Captured message contains only the expected invitation text and link');
    return token;
  };
  const assertBinding = async (id: string, grantVersion: number, token: string) => {
    const row = (await invitations()).find(row => row.id === id);
    assert.ok(row);
    const { tenant_id, issuer_membership_id, issuer_platform_grant_id, issuer_version, role, purpose, grant_version, consumed_at, revoked_at } = row;
    assert.deepEqual({ tenant_id, issuer_membership_id, issuer_platform_grant_id, issuer_version, role, purpose, grant_version, consumed_at, revoked_at },
      { tenant_id: tenantA, issuer_membership_id: manager.membershipId, issuer_platform_grant_id: null, issuer_version: 1,
        role: 'Employee', purpose: 'membership', grant_version: grantVersion, consumed_at: null, revoked_at: null });
    assert.equal(row.email, email);
    assert.deepEqual(row.created_at, now);
    assert.equal(row.expires_at.getTime() - row.created_at.getTime(), 86_400_000);
    assert.equal(row.token_hash === tokenHash(token) && !JSON.stringify(row).includes(token), true, 'Only the token hash is persisted');
  };

  const first = await issueEmployeeInvitation(manager.issuer, `  ${email.toUpperCase()}\t`);
  assert.deepEqual(first, { id: first.id, delivery: 'captured' });
  assert.equal(await countMail(), initialMail + 1);
  const firstToken = await latestToken();
  await assertBinding(first.id, 1, firstToken);
  assert.equal(await previewEmployeeInvitation(db, firstToken, email), tenantName);
  assert.equal(await previewEmployeeInvitation(db, firstToken, 'wrong@example.invalid'), undefined);
  assert.equal((await invitations()).length, 1);
  assert.deepEqual(await access(), initialAccess);

  const beforeDenials = await invitations();
  await assert.rejects(issueEmployeeInvitation(otherManager.issuer, email.toUpperCase()), { message: 'Denied' });
  await assert.rejects(issueEmployeeInvitation({ ...manager.issuer, clock: () => new Date(now.getTime() - 1) }, email, first.id),
    { message: 'Denied' });
  for (const principal of [employee, expired, future, unenrolled]) {
    await assert.rejects(issueEmployeeInvitation(principal.issuer, email), { message: 'Denied' });
  }
  for (const outOfScope of [otherManager, managerB]) {
    await assert.rejects(issueEmployeeInvitation(outOfScope.issuer, email, first.id), { message: 'Denied' });
  }
  await assert.rejects(issueEmployeeInvitation(manager.issuer, 'wrong@example.invalid', first.id), { message: 'Denied' });
  await assert.rejects(issueEmployeeInvitation(manager.issuer, 'test@example.invalid\r\nCc: other@example.invalid'), { message: 'Denied' });
  assert.deepEqual(await invitations(), beforeDenials);
  assert.equal(await countMail(), initialMail + 1);
  assert.deepEqual(await access(), initialAccess);

  const replacement = () => issueEmployeeInvitation(manager.issuer, email, first.id);
  const [one, two] = await Promise.allSettled([replacement(), replacement()]);
  const winner = one.status === 'fulfilled' ? one : two;
  const loser = one.status === 'rejected' ? one : two;
  assert.equal(winner.status, 'fulfilled');
  assert.equal(loser.status, 'rejected');
  assert.equal(loser.reason.message, 'Denied');
  assert.equal(winner.value.delivery, 'captured');
  assert.equal(await countMail(), initialMail + 2);
  assert.equal((await invitations()).length, 2);
  const replacementToken = await latestToken();
  assert.equal(firstToken !== replacementToken, true, 'Resend creates a different token');
  await assertBinding(winner.value.id, 2, replacementToken);
  assert.deepEqual((await invitations()).find(row => row.id === first.id)?.revoked_at, now);
  assert.equal(await previewEmployeeInvitation(db, firstToken, email), undefined);
  assert.equal(await previewEmployeeInvitation(db, replacementToken, email), tenantName);
  assert.deepEqual(await access(), initialAccess);

  const exhaustedEmail = `exhausted-${email}`;
  const exhausted = (await db.query<{ id: string }>(`INSERT INTO pilot.invitations
    (tenant_id,email,role,purpose,issuer_membership_id,issuer_version,grant_version,token_hash,created_at,expires_at)
    VALUES ($1,$2,'Employee','membership',$3,1,2147483647,$4,now()-interval '2 minutes',now()+interval '1 hour') RETURNING id`,
  [tenantA, exhaustedEmail, manager.membershipId, tokenHash(randomUUID())])).rows[0]!.id;
  const beforeFailure = await invitations();
  await assert.rejects(issueEmployeeInvitation(manager.issuer, exhaustedEmail, exhausted), { code: '22003' });
  assert.deepEqual(await invitations(), beforeFailure);
  assert.equal(await countMail(), initialMail + 2);

  const wrongCa = await readFile('work/pilot/customer.crt');
  const unconfirmed = await issueEmployeeInvitation({ ...manager.issuer, mailboxCa: wrongCa }, email, winner.value.id);
  assert.deepEqual(unconfirmed, { id: unconfirmed.id, delivery: 'unconfirmed' });
  assert.equal(await countMail(), initialMail + 2);
  assert.equal(await previewEmployeeInvitation(db, replacementToken, email), undefined);
  assert.deepEqual((await invitations()).find(row => row.id === unconfirmed.id)?.revoked_at, null);
  const recovered = await issueEmployeeInvitation(manager.issuer, email, unconfirmed.id);
  assert.equal(recovered.delivery, 'captured');
  assert.equal(await countMail(), initialMail + 3);
  const recoveredToken = await latestToken();
  await assertBinding(recovered.id, 4, recoveredToken);
  assert.deepEqual(await access(), initialAccess);

  const contestedEmail = `contested-${email}`;
  const fresh = await Promise.allSettled([manager, otherManager].map(({ issuer }) => issueEmployeeInvitation(issuer, contestedEmail)));
  assert.equal(fresh.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(fresh.filter(result => result.status === 'rejected' && result.reason.message === 'Denied').length, 1);
  assert.equal((await invitations()).filter(row => row.tenant_id === tenantA && row.email === contestedEmail).length, 1);
  assert.equal(await countMail(), initialMail + 4);
  const tenantAToken = await latestToken(contestedEmail);
  assert.equal(await previewEmployeeInvitation(db, tenantAToken, contestedEmail), tenantName);
  assert.equal((await issueEmployeeInvitation(managerB.issuer, contestedEmail)).delivery, 'captured');
  assert.equal(await countMail(), initialMail + 5);
  assert.equal(await previewEmployeeInvitation(db, await latestToken(contestedEmail), contestedEmail), 'Invented studio B');
  assert.equal(await previewEmployeeInvitation(db, tenantAToken, contestedEmail), tenantName);

  const closedEmail = `closed-${email}`;
  const expiredId = (await db.query<{ id: string }>(`INSERT INTO pilot.invitations
    (tenant_id,email,role,purpose,issuer_membership_id,issuer_version,grant_version,token_hash,
      created_at,expires_at,consumed_at,revoked_at)
    VALUES ($1,$2,'Employee','membership',$3,1,1,$4,$7::timestamptz - interval '25 hours',$7 - interval '1 hour',NULL,NULL),
      ($1,$2,'Employee','membership',$3,1,1,$5,$7 - interval '1 hour',$7 + interval '23 hours',$7,NULL),
      ($1,$2,'Employee','membership',$3,1,1,$6,$7 - interval '1 hour',$7 + interval '23 hours',NULL,$7) RETURNING id`,
  [tenantA, closedEmail, manager.membershipId, tokenHash(randomUUID()), tokenHash(randomUUID()), tokenHash(randomUUID()), now])).rows[0]!.id;
  assert.equal((await issueEmployeeInvitation(manager.issuer, closedEmail)).delivery, 'captured');
  const beforeExpiredResend = await invitations();
  await assert.rejects(issueEmployeeInvitation(manager.issuer, closedEmail, expiredId), { message: 'Denied' });
  assert.deepEqual(await invitations(), beforeExpiredResend);
  assert.equal(await countMail(), initialMail + 6);
  assert.deepEqual(await access(), initialAccess);

  await db.query("UPDATE pilot.memberships SET role='Employee',version=version+1 WHERE tenant_id=$1 AND id=$2", [tenantA, manager.membershipId]);
  const afterDemotion = await access();
  const beforeStaleRequests = await invitations();
  await assert.rejects(issueEmployeeInvitation(manager.issuer, email), { message: 'Denied' });
  await assert.rejects(issueEmployeeInvitation(manager.issuer, email, recovered.id), { message: 'Denied' });
  assert.equal(await previewEmployeeInvitation(db, recoveredToken, email), undefined);
  assert.deepEqual(await invitations(), beforeStaleRequests);
  assert.deepEqual(await access(), afterDemotion);
  assert.equal(await countMail(), initialMail + 6);
});
