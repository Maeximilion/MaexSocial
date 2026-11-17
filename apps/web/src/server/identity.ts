import type { Client } from 'pg';
import type { VerifiedIdentity } from '../../../../packages/contracts/pilot.js';
import { lockIdentities } from './session.js';

export async function consumeIdentityCompletion(db: Client, completionId: string, purpose: 'signup' | 'invitation' | 'reset', bindingId: string, now: Date): Promise<VerifiedIdentity> {
  const denied = (): never => { throw new Error('Denied'); };
  if (!Number.isFinite(now.getTime())) denied();
  const located = (await db.query('SELECT identity_id FROM pilot.identity_completions WHERE id=$1', [completionId])).rows[0];
  if (!located) denied();
  await lockIdentities(db, [located.identity_id]);
  const proof = (await db.query('SELECT * FROM pilot.identity_completions WHERE id=$1 FOR UPDATE', [completionId])).rows[0];
  if (!proof || proof.identity_id !== located.identity_id || proof.purpose !== purpose || proof.binding_id !== bindingId
    || proof.consumed_at || proof.revoked_at || now >= proof.expires_at || (purpose === 'signup' && proof.previously_verified)) denied();
  const identity = (await db.query('SELECT * FROM pilot.identities WHERE id=$1', [located.identity_id])).rows[0];
  const operation = (await db.query('SELECT * FROM pilot.identity_operations WHERE id=$1 FOR UPDATE', [proof.operation_id])).rows[0];
  if (!identity || !identity.verified || identity.lifecycle !== 'active' || identity.subject !== proof.subject || identity.email !== proof.email
    || identity.version !== proof.identity_version || identity.generation !== proof.generation || !operation || operation.phase !== 'complete'
    || operation.identity_id !== identity.id || operation.new_subject !== proof.subject || operation.generation !== proof.generation
    || operation.purpose !== purpose || operation.binding_id !== bindingId || now >= operation.expires_at || now < operation.created_at) denied();
  const challenge = (await db.query('SELECT * FROM pilot.pending_access WHERE id=$1 FOR UPDATE', [operation.challenge_id])).rows[0];
  if (!challenge || challenge.identity_id !== identity.id || challenge.email !== proof.email || !challenge.consumed_at
    || challenge.revoked_at || now >= challenge.expires_at || challenge.purpose !== (purpose === 'invitation' ? 'access' : purpose)) denied();
  await db.query('UPDATE pilot.identity_completions SET consumed_at=$1 WHERE id=$2', [now, completionId]);
  return { identityId: identity.id, subject: proof.subject, email: proof.email, firstName: proof.first_name,
    lastName: proof.last_name, previouslyVerified: proof.previously_verified };
}
