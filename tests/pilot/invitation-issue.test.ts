import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { get } from 'node:https';
import { test } from 'node:test';
import { previewInvitation, renderInvitationPreview } from '../../apps/web/src/routes/employees.js';
import { issueEmployeeInvitation, issueManagementInvitation,
  type ManagementInvitationContext } from '../../apps/web/src/server/invitation-issue.js';
import { requireCustomer, tokenHash } from '../../apps/web/src/server/session.js';
import { connectFixture, runIsolated } from '../../ops/local/fixture.js';
import { createOrganization } from '../../packages/contracts/management-organization.js';
import type { CustomerRole } from '../../packages/contracts/pilot.js';
import { seedManagementSession } from './fixtures.js';

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

  const latestToken = async (recipient = email, role: CustomerRole = 'Employee') => {
    const message = await mailboxRead<MailpitMessage>(mailboxCa, '/api/v1/message/latest');
    assert.deepEqual(message.To.map(x => x.Address), [recipient]);
    assert.equal(message.Cc?.length ?? 0, 0);
    assert.equal(message.Bcc?.length ?? 0, 0);
    assert.equal(message.From.Address, 'invitations@example.invalid');
    assert.equal(message.Subject, `${role} invitation`);
    const body = message.Text.replaceAll('\r\n', '\n').trim();
    const token = /#([a-f0-9]{64})$/.exec(body)?.[1];
    assert.ok(token, 'The isolated mailbox contains an opaque invitation');
    assert.equal(body === `You have been invited as ${role === 'Employee' ? 'an Employee' : 'a Manager'}. The invitation expires after 24 hours.\n\nhttps://customer:8443/customer/invitations/preview#${token}`,
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
  assert.deepEqual(await previewInvitation(db, firstToken, email), { name: tenantName, role: 'Employee' });
  assert.equal(await previewInvitation(db, firstToken, 'wrong@example.invalid'), undefined);
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
  assert.equal(await previewInvitation(db, firstToken, email), undefined);
  assert.deepEqual(await previewInvitation(db, replacementToken, email), { name: tenantName, role: 'Employee' });
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
  assert.equal(await previewInvitation(db, replacementToken, email), undefined);
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
  assert.deepEqual(await previewInvitation(db, tenantAToken, contestedEmail), { name: tenantName, role: 'Employee' });
  assert.equal((await issueEmployeeInvitation(managerB.issuer, contestedEmail)).delivery, 'captured');
  assert.equal(await countMail(), initialMail + 5);
  assert.deepEqual(await previewInvitation(db, await latestToken(contestedEmail), contestedEmail), { name: 'Invented studio B', role: 'Employee' });
  assert.deepEqual(await previewInvitation(db, tenantAToken, contestedEmail), { name: tenantName, role: 'Employee' });

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
  assert.equal(await previewInvitation(db, recoveredToken, email), undefined);
  assert.deepEqual(await invitations(), beforeStaleRequests);
  assert.deepEqual(await access(), afterDemotion);
  assert.equal(await countMail(), initialMail + 6);

  const platformIdentity = (await db.query<{ id: string }>(
    'INSERT INTO pilot.identities(subject,verified) VALUES ($1,true) RETURNING id', [randomUUID()])).rows[0]!.id;
  const platformGrant = (await db.query<{ id: string }>(
    'INSERT INTO pilot.platform_grants(identity_id) VALUES ($1) RETURNING id', [platformIdentity])).rows[0]!.id;
  const platformEmail = `platform-${email}`, futureEmail = `future-${email}`;
  const futureToken = randomBytes(32).toString('hex');
  await db.query(`INSERT INTO pilot.invitations
    (tenant_id,email,role,purpose,issuer_membership_id,issuer_platform_grant_id,issuer_version,grant_version,token_hash,created_at,expires_at)
    VALUES ($1,$2,'Employee','membership',NULL,$4,1,1,$6,$8::timestamptz,$8 + interval '24 hours'),
      ($1,$3,'Employee','membership',$5,NULL,3,1,$7,$8,$8 + interval '24 hours')`,
  [tenantA, platformEmail, futureEmail, platformGrant, manager.membershipId, tokenHash(randomUUID()), tokenHash(futureToken), now]);
  const beforeIssuerBoundaries = await invitations();
  const accessBeforeNewIssuer = await access();
  for (const blockedEmail of [platformEmail, futureEmail]) {
    await assert.rejects(issueEmployeeInvitation(otherManager.issuer, blockedEmail), { message: 'Denied' });
  }
  assert.equal(await previewInvitation(db, futureToken, futureEmail), undefined);
  assert.deepEqual(await invitations(), beforeIssuerBoundaries);
  assert.equal(await countMail(), initialMail + 6);

  const fromNewIssuer = await issueEmployeeInvitation(otherManager.issuer, email);
  assert.equal(fromNewIssuer.delivery, 'captured');
  assert.equal(await countMail(), initialMail + 7);
  const newIssuerToken = await latestToken();
  assert.deepEqual(await previewInvitation(db, newIssuerToken, email), { name: tenantName, role: 'Employee' });
  const newRow = (await invitations()).find(row => row.id === fromNewIssuer.id);
  assert.equal(newRow?.issuer_membership_id, otherManager.membershipId);
  assert.equal(newRow?.tenant_id, tenantA);
  assert.deepEqual((await invitations()).find(row => row.id === recovered.id),
    beforeIssuerBoundaries.find(row => row.id === recovered.id));
  assert.equal(await previewInvitation(db, recoveredToken, email), undefined);
  assert.deepEqual(await access(), accessBeforeNewIssuer);

  await db.query("UPDATE pilot.memberships SET role='Manager',version=version+1 WHERE tenant_id=$1 AND id=$2", [tenantA, manager.membershipId]);
  assert.equal(await previewInvitation(db, recoveredToken, email), undefined);
  assert.deepEqual(await previewInvitation(db, newIssuerToken, email), { name: tenantName, role: 'Employee' });
  assert.deepEqual(await previewInvitation(db, futureToken, futureEmail), { name: tenantName, role: 'Employee' });

  await t.test('private management invites either role with scoped authority and atomic audit', async () => {
    const operator = await seedManagementSession(db, now, new Date(now.getTime() - 300_000));
    const organization = 'Invented management studio';
    const { tenantId } = await createOrganization(connectFixture, { ...operator, action: 'organization_create' },
      organization, 'Local organization control', clock);
    const reason = 'Authorized synthetic invitation';
    const target = `management-${email}`;
    const proof = (recipient = target, role: CustomerRole = 'Manager', tenant = tenantId): ManagementInvitationContext =>
      ({ ...operator, tenantId: tenant, tenantVersion: 1, action: 'invitation_issue', recipient, role });
    const invite = (context = proof(), replaces?: string, why = reason, ca = mailboxCa, at = clock) =>
      issueManagementInvitation({ connect: connectFixture, clock: at, mailboxCa: ca }, context,
        context.tenantId, context.recipient, context.role, why, replaces);
    const before = await access();
    const mailBefore = await countMail();
    const audited = async () => (await db.query(`SELECT tenant_id,actor_id,device_id,reason,outcome,created_at FROM pilot.audit
      WHERE actor_id=$1 AND action='invitation_issue' ORDER BY tenant_id,outcome`, [operator.identityId])).rows;
    const issued = async () => (await db.query('SELECT * FROM pilot.invitations WHERE issuer_platform_grant_id=$1 ORDER BY id',
      [operator.grantId])).rows;

    for (const scope of [{ sessionId: randomUUID() }, { deviceVersion: 2 }, { grantVersion: 2 },
      { tenantVersion: 2 }, { tenantId: randomUUID() }]) {
      await assert.rejects(invite({ ...proof(), ...scope }), /Denied/);
    }
    await assert.rejects(invite(proof(), undefined, ' '), /Denied/);
    await assert.rejects(invite(proof(), undefined, reason, mailboxCa, () => new Date(now.getTime() + 1)), /Denied/);
    await assert.rejects(issueManagementInvitation({ connect: connectFixture, clock, mailboxCa }, proof(),
      tenantA, target, 'Manager', reason), /Denied/);
    await assert.rejects(issueManagementInvitation({ connect: connectFixture, clock, mailboxCa }, proof(),
      tenantId, target, 'Employee', reason), /Denied/);
    await assert.rejects(issueManagementInvitation({ connect: connectFixture, clock, mailboxCa }, proof(),
      tenantId, email, 'Manager', reason), /Denied/);
    assert.deepEqual(await issued(), []);
    assert.deepEqual(await audited(), []);
    assert.equal(await countMail(), mailBefore);

    const managerInvitation = await issueManagementInvitation({ connect: connectFixture, clock, mailboxCa }, proof(),
      tenantId, ` ${target.toUpperCase()} `, 'Manager', reason);
    assert.equal(managerInvitation.delivery, 'captured');
    const managerToken = await latestToken(target, 'Manager');
    const managerPreview = await previewInvitation(db, managerToken, target);
    assert.deepEqual(managerPreview, { name: organization, role: 'Manager' });
    assert.match(renderInvitationPreview(managerPreview), /<dt>Role<\/dt><dd>Manager<\/dd>/);
    assert.equal(await previewInvitation(db, managerToken, email), undefined);
    const [pending] = await issued();
    assert.deepEqual(pending, { tenant_id: tenantId, id: managerInvitation.id, email: target, role: 'Manager',
      purpose: 'membership', issuer_membership_id: null, issuer_platform_grant_id: operator.grantId, issuer_version: 1,
      grant_version: 1, token_hash: tokenHash(managerToken), created_at: now,
      expires_at: new Date(now.getTime() + 86_400_000), consumed_at: null, revoked_at: null });
    assert.deepEqual(await audited(), [{ tenant_id: tenantId, actor_id: operator.identityId, device_id: operator.deviceId,
      reason, outcome: 'Manager', created_at: now }]);
    await assert.rejects(invite(), /Denied/);
    await assert.rejects(invite(proof(target, 'Employee'), managerInvitation.id), /Denied/);
    await assert.rejects(invite(proof(target, 'Manager', tenantB), managerInvitation.id), /Denied/);

    await db.query("ALTER TABLE pilot.audit ADD CONSTRAINT test_invitation_audit_failure CHECK (reason <> 'Fixture audit failure')");
    try {
      await assert.rejects(invite(proof(), managerInvitation.id, 'Fixture audit failure'),
        { code: '23514', constraint: 'test_invitation_audit_failure' });
    } finally {
      await db.query('ALTER TABLE pilot.audit DROP CONSTRAINT test_invitation_audit_failure');
    }
    assert.deepEqual(await issued(), [pending]);
    assert.deepEqual(await previewInvitation(db, managerToken, target), managerPreview);
    assert.equal(await countMail(), mailBefore + 1);

    const employeeInvitation = await invite(proof(target, 'Employee', tenantB));
    assert.equal(employeeInvitation.delivery, 'captured');
    const employeeToken = await latestToken(target);
    const employeePreview = await previewInvitation(db, employeeToken, target);
    assert.deepEqual(employeePreview, { name: 'Invented studio B', role: 'Employee' });
    assert.match(renderInvitationPreview(employeePreview), /<dt>Role<\/dt><dd>Employee<\/dd>/);
    assert.deepEqual(await previewInvitation(db, managerToken, target), managerPreview);

    const uncertain = await invite(proof(), managerInvitation.id, reason, wrongCa);
    assert.equal(uncertain.delivery, 'unconfirmed');
    assert.equal(await countMail(), mailBefore + 2);
    assert.equal(await previewInvitation(db, managerToken, target), undefined);
    const afterResend = await issued();
    assert.deepEqual(afterResend.find(row => row.id === managerInvitation.id)?.revoked_at, now);
    assert.equal(afterResend.find(row => row.id === uncertain.id)?.grant_version, 2);
    await assert.rejects(invite(), /Denied/);
    const replacement = await invite(proof(), uncertain.id);
    assert.equal(replacement.delivery, 'captured');
    const replacementToken = await latestToken(target, 'Manager');
    assert.equal((await issued()).find(row => row.id === replacement.id)?.grant_version, 3);

    const contested = `two-paths-${email}`;
    const contenders = await Promise.allSettled([
      invite(proof(contested, 'Manager', tenantA)),
      issueEmployeeInvitation(otherManager.issuer, contested)
    ]);
    assert.equal(contenders.filter(result => result.status === 'fulfilled').length, 1);
    const refused = contenders.find(result => result.status === 'rejected');
    assert.equal(refused?.reason?.message, 'Denied');
    const contestedRole = contenders[0]!.status === 'fulfilled' ? 'Manager' : 'Employee';
    const contestedToken = await latestToken(contested, contestedRole);
    assert.deepEqual(await previewInvitation(db, contestedToken, contested), { name: tenantName, role: contestedRole });
    assert.equal(await countMail(), mailBefore + 4);

    await db.query('UPDATE pilot.invitations SET revoked_at=$3 WHERE tenant_id=$1 AND id=$2',
      [tenantB, employeeInvitation.id, now]);
    assert.equal(await previewInvitation(db, employeeToken, target), undefined);
    assert.deepEqual(await previewInvitation(db, replacementToken, target), managerPreview);
    await db.query('UPDATE pilot.platform_grants SET active=false,version=version+1 WHERE id=$1', [operator.grantId]);
    assert.equal(await previewInvitation(db, replacementToken, target), undefined);
    await assert.rejects(invite(), /Denied/);
    await db.query('UPDATE pilot.platform_grants SET active=true,version=version+1 WHERE id=$1', [operator.grantId]);
    assert.equal(await previewInvitation(db, replacementToken, target), undefined);
    await assert.rejects(invite(), /Denied/);
    assert.equal((await issueEmployeeInvitation(managerB.issuer, target)).delivery, 'captured');
    assert.deepEqual(await access(), before);
  });
});
