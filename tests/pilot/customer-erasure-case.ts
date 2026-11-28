import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import type { Client } from 'pg';
import { createIdentityInspector } from '../../apps/web/src/server/identity.js';
import { issueEmployeeInvitation } from '../../apps/web/src/server/invitation-issue.js';
import { requireCustomerRequest } from '../../apps/web/src/server/request.js';
import { requireCustomer, rotateCustomerSession, tokenHash } from '../../apps/web/src/server/session.js';
import { claimDispatch } from '../../apps/worker/src/dispatch.js';
import { pilotIssuer, subjectBinding, type CustomerErasure } from '../../ops/local/customer-erasure.js';
import { connectFixture } from '../../ops/local/fixture.js';
import { applySourceCustomerErasure } from '../../ops/local/source-customer-erasure.js';
import { binding, clock, inspect, seedDispatchApproval } from './dispatch-fixture.js';

const subject = '14300000-0000-4000-8000-000000000001';
const email = 'step-up-enrolled@example.invalid';
const fake = { policy: 'synthetic-organic-text' as const, async create(intent: { attemptId: string; location: string }) {
  return { attemptId: intent.attemptId, location: intent.location };
} };
async function liveInspector() {
  return createIdentityInspector({ issuer: pilotIssuer, clientId: 'pilot-status',
    clientSecret: await readFile('work/pilot/status-secret','utf8'), ca: await readFile('work/pilot/keycloak.crt','utf8') });
}

export async function seedCase(db: Client, source: string) {
  const session = binding(), other = binding(), peer = binding();
  const target = await seedDispatchApproval(session, true);
  const control = await seedDispatchApproval(other, true);
  const peerId = (await db.query('SELECT identity_id FROM pilot.memberships WHERE tenant_id=$1 AND role=$2',
    [target.tenant,'Employee'])).rows[0].identity_id as string;
  const inspector = await liveInspector();
  const status = await inspector(subject);
  const otp = status.credentials.find(c => c.type === 'otp');
  assert.ok(status.enabled && status.verified && otp);
  await db.query('UPDATE pilot.identities SET subject=$2,version=version+1 WHERE id=$1', [target.user,subject]);
  await db.query('UPDATE pilot.sessions SET identity_version=3,mfa_credential_id=$2 WHERE identity_id=$1', [target.user,otp.id]);
  await db.query('UPDATE pilot.identities SET verified=true,version=version+1 WHERE id=$1', [peerId]);
  await db.query(`INSERT INTO pilot.sessions(token_hash,csrf_hash,identity_id,identity_version,tenant_id,tenant_version,
    membership_id,membership_version,audience,created_at,last_seen_at,expires_at)
    SELECT $2,$3,m.identity_id,2,m.tenant_id,1,m.id,1,'customer',s.created_at,s.last_seen_at,s.expires_at
    FROM pilot.memberships m JOIN pilot.sessions s ON s.tenant_id=m.tenant_id WHERE m.identity_id=$1`,
  [peerId,tokenHash(peer.token),tokenHash(peer.csrf)]);
  const extra = (await db.query("INSERT INTO pilot.tenants(name) VALUES('Separate synthetic workspace') RETURNING id")).rows[0].id;
  await db.query("INSERT INTO pilot.memberships(tenant_id,identity_id,role) VALUES($1,$2,'Employee')", [extra,target.user]);
  for (const [id,recipient] of [[target.user,email],[peerId,'peer@example.invalid'],[control.user,'control@example.invalid'],[null,email]]) {
    // No shipping signup/verification/reset writer. Exercise the schema, including an unbound mailbox collision.
    await db.query(`INSERT INTO pilot.pending_access(identity_id,email,purpose,token_hash,expires_at)
      VALUES($1,$2,'verification',$3,now()+interval '1 hour')`, [id,recipient,tokenHash(randomUUID())]);
  }
  const mailboxCa = await readFile('work/pilot/mailbox.crt');
  const outbound = await issueEmployeeInvitation({ connect: connectFixture, clock, mailboxCa,
    authorize: c => requireCustomerRequest(c,session,clock,inspector) }, 'peer@example.invalid');
  const incoming = await issueEmployeeInvitation({ connect: connectFixture, clock, mailboxCa,
    authorize: c => requireCustomerRequest(c,other,clock,inspect) }, email);
  assert.equal(outbound.delivery,'captured'); assert.equal(incoming.delivery,'captured');
  await db.query('UPDATE pilot.dispatch_control SET stopped=false');
  assert.equal((await claimDispatch(connectFixture,target.id,fake)).state,'in_flight');
  await db.query(`INSERT INTO pilot.fixture_audit_disposition(fixture_id,tenant_id,audit_id,event_at,incident_state)
    SELECT $1,tenant_id,id,created_at,'held' FROM pilot.audit WHERE occurrence_id=$2 AND action='dispatch_claim'`, [source,target.id]);
  const event: CustomerErasure = { kind:'delete-customer', issuer:pilotIssuer, id:target.user,
    binding:subjectBinding(source,target.user,subject), version:3 };
  return { event, session, peer, other, peerId, controlId:control.user, claimed:target.id, tenant:target.tenant,
    issued:outbound.id, incoming:incoming.id };
}

export type AccessCase = Awaited<ReturnType<typeof seedCase>>;

export async function inspectCase(db: Client, c: AccessCase, erased: boolean, offline: boolean) {
  const { rows: [r] } = await db.query(`SELECT
    (SELECT count(*)::int FROM pilot.identities WHERE subject=$2) AS subjects,
    (SELECT verified FROM pilot.identities WHERE id=$1) AS verified,
    (SELECT count(*)::int FROM pilot.memberships WHERE identity_id=$1 AND active) AS live,
    (SELECT count(*)::int FROM pilot.memberships WHERE identity_id=$1) AS memberships,
    (SELECT count(*)::int FROM pilot.sessions WHERE identity_id=$1) AS sessions,
    (SELECT count(*)::int FROM pilot.pending_access WHERE identity_id=$1) AS pending,
    (SELECT count(*)::int FROM pilot.pending_access WHERE identity_id IS NULL AND email=$3) AS unbound,
    (SELECT revoked_at IS NOT NULL FROM pilot.invitations WHERE id=$4) AS withdrawn,
    (SELECT count(*)::int FROM pilot.invitations WHERE id=$5 AND email=$3 AND revoked_at IS NULL) AS incoming,
    (SELECT count(*)::int FROM pilot.attempts WHERE occurrence_id=$6) AS claims,
    (SELECT count(*)::int FROM pilot.fixture_audit_disposition d JOIN pilot.audit a ON (a.tenant_id,a.id)=(d.tenant_id,d.audit_id)
      WHERE a.actor_id=$1 AND d.incident_state='held') AS holds`, [c.event.id,subject,email,c.issued,c.incoming,c.claimed]);
  assert.deepEqual(r,{ subjects:erased?0:1, verified:!erased, live:erased?0:2, memberships:erased?1:2,
    sessions:erased?0:1, pending:erased?0:1, unbound:1, withdrawn:erased, incoming:1, claims:1, holds:1 });
  // Compare every control access row. Offline recovery independently revokes all restored sessions.
  const snapshot = (await db.query(`SELECT
    (SELECT jsonb_agg(i ORDER BY id) FROM pilot.identities i WHERE id=ANY($1)) AS identities,
    (SELECT jsonb_agg(m ORDER BY id) FROM pilot.memberships m WHERE identity_id=ANY($1)) AS memberships,
    (SELECT jsonb_agg(to_jsonb(s)-'revoked_at' ORDER BY id) FROM pilot.sessions s WHERE identity_id=ANY($1)) AS sessions,
    (SELECT jsonb_agg(p ORDER BY id) FROM pilot.pending_access p WHERE identity_id=ANY($1) OR identity_id IS NULL) AS pending,
    (SELECT jsonb_agg(i ORDER BY id) FROM pilot.invitations i WHERE id=$2) AS invitation,
    (SELECT jsonb_agg(a ORDER BY id) FROM pilot.approvals a) AS approvals,
    (SELECT jsonb_agg(a ORDER BY id) FROM pilot.audit a) AS audit,
    (SELECT jsonb_agg(a ORDER BY id) FROM pilot.attempts a) AS attempts,
    (SELECT jsonb_agg(r ORDER BY id) FROM pilot.draft_revisions r) AS revisions`, [[c.peerId,c.controlId],c.incoming])).rows[0];
  if (offline) {
    assert.equal((await db.query(`SELECT count(*)::int AS n FROM pilot.sessions WHERE revoked_at IS NULL`)).rows[0].n,0);
    await assert.rejects(connectFixture(), (e: {code: string}) => ['28000','28P01'].includes(e.code));
  } else {
    const inspector = await liveInspector();
    assert.ok((await inspector(subject)).enabled);
    if (erased) {
      await assert.rejects(requireCustomer(db,c.session.token,clock,inspector), /Denied/);
      await assert.rejects(claimDispatch(connectFixture,c.claimed,fake), /Denied/);
    } else assert.equal((await requireCustomerRequest(db,c.session,clock,inspector,'read-only')).identityId,c.event.id);
    for (const [req,id] of [[c.peer,c.peerId],[c.other,c.controlId]] as const) {
      assert.equal((await requireCustomerRequest(db,req,clock,inspect,'read-only')).identityId,id);
    }
  }
  return tokenHash(JSON.stringify(snapshot));
}

export async function authorizeCase(db: Client, f: string, c: AccessCase, digest: string) {
  const {id,binding,version} = c.event;
  const r = await db.query(`INSERT INTO pilot.fixture_customer_erasure(fixture_id,identity_id,subject_binding,identity_version,sequence,history_digest)
    SELECT id,$2,$3,$4,restore_history_after+1,$5 FROM public.fixture_identity
    WHERE id=$1 AND purpose='backup' AND disposable_backup AND NOT restore_target RETURNING authorized_at`,
  [f,id,binding,version,digest]);
  assert.equal(r.rowCount,1);
  return r.rows[0].authorized_at as Date;
}

export async function exerciseSource(db: Client, c: AccessCase) {
  const app = await connectFixture();
  try {
    await assert.rejects(app.query('SELECT * FROM pilot.fixture_customer_erasure'), {code:'42501'});
    const inspector = await liveInspector();
    await db.query(`CREATE CONSTRAINT TRIGGER test_customer_rollback AFTER UPDATE ON pilot.fixture_customer_erasure
      DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pilot.reject_mutation()`);
    try { await assert.rejects(applySourceCustomerErasure, {code:'23514'}); }
    finally { await db.query('DROP TRIGGER test_customer_rollback ON pilot.fixture_customer_erasure'); }
    await inspectCase(db,c,false,false);
    await app.query('BEGIN');
    const rotated = await rotateCustomerSession(app,c.session.token,c.tenant,clock,inspector);
    const pid = (await app.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    const erasure = applySourceCustomerErasure();
    try {
      let blocked = false;
      for (let i=0;i<100 && !blocked;i++) {
        blocked = (await db.query('SELECT EXISTS(SELECT FROM pg_stat_activity WHERE $1=ANY(pg_blocking_pids(pid))) AS waiting',[pid])).rows[0].waiting;
        if (!blocked) await delay(25);
      }
      assert.ok(blocked,'Erasure must wait for the established session rotation');
      await app.query('COMMIT');
    } finally { await app.query('ROLLBACK'); }
    assert.deepEqual(await erasure,{sessions:2,pending:1,invitationsRevoked:1,membershipsDeleted:1,membershipsDeactivated:1,identitiesDeleted:0});
    const confirmed = (await db.query('SELECT clock_timestamp() AS at')).rows[0].at as Date;
    await assert.rejects(requireCustomer(app,rotated.token,clock,inspector), /Denied/);
    assert.equal(await applySourceCustomerErasure(),null);
    return confirmed;
  } finally { await app.end(); }
}
