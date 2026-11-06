# Task 2 customer access and content delivery plan

> **For agentic workers:** Use `superpowers:executing-plans` for native execution, with the authorized fresh independent GPT-6 Astra/high reviewer before the delivery PR. Implement only the issue assigned to the current chat. Root accepted the A/B/C split and created #123/#124 on 2026-11-06; concrete contract disposition must still precede product edits.

**Goal:** Deliver every accepted Task 2 requirement through a working customer-access foundation followed by independently testable Employee management and immutable content approval.

**Architecture:** Preserve the accepted modular TypeScript/Node service, PostgreSQL transaction boundary and local Keycloak identity authority. Reuse Task 1's isolated TLS networks, mailbox sink and schema. Separate deliveries by customer behavior and table ownership, not diff size; no new architecture or G2 decision is requested.

**Tech Stack:** Strict TypeScript, Node 24.22.2, PostgreSQL 17.11, Keycloak 26.8.2; Express 5 is the accepted HTTP direction but is not installed in the Task 1 lockfile.

**Spec:** [Accepted MS-009 Task 2](2026-11-05-ms-009-local-text-pilot.md#2-customer-registration-portal-and-immutable-approval), [evidence map](2026-11-05-ms-009-pilot-evidence-map.md), [access contract](../../17_ACCESS_SECURITY.md), [issue #117](https://github.com/Maeximilion/MaexSocial/issues/117).

## Global constraints

- G2 and local synthetic implementation were [accepted](https://github.com/Maeximilion/MaexSocial/issues/15#issuecomment-6681723454). No real identities/customers, external runtime egress, external mail, deployment, provider calls or product spend.
- Only Manager approves; Manager and Employee export remains Task 4. DEV/Admin stays separate and cannot approve customer content.
- MFA proof age at most 5 minutes, including exactly 5 minutes; reject future proof and greater ages. Recovery requires restored enrollment before sensitive actions.
- Verification/invitation lifetime 24 hours; reset 15 minutes. Customer sessions expire after 30 minutes idle or 8 hours absolute.
- Per normalized account and independently per source: login 5/30 attempts per 15 minutes; signup, recovery and resend 3/10 per hour for each flow. Count unknown identities as well.
- Compile before every targeted Node test, restart processes from that build, and record candidate SHA, fixture, expected/observed effects and limitations. Missing prerequisites fail; mocks cannot establish real Keycloak/browser behavior.
- Canonical main stays clean. One delivery PR per work chat. Only root maintains `.codex/orchestration`; #121 owns review client/tests/tooling documentation.
- All work pauses on 2026-11-06 at 11:30 UTC (12:30 Europe/Berlin). No implementation, push, PR or merge after that boundary without owner resume.

## Observed Task 1 interfaces

Inspected base: `44209c9e5685d8cc6c6e740b3e0c1ac5fc6a7530`, merged [PR #118](https://github.com/Maeximilion/MaexSocial/pull/118).

| Existing file/interface | Reuse and concrete gap |
| --- | --- |
| `ops/local/fixture.ts`: `loadFixture(allowExpired = false)`, `connectFixture(owner = false): Promise<Client>`, `runIsolated(args: string[]): Promise<string>` | Restricted app role and TLS connection inside the isolated runner. Never give owner/IdP DB credentials to customer routes. |
| `ops/local/fixture.ts`: `verifyTopology` / `verifyContainers` | Currently requires exactly four long-lived services, two internal networks and no published ports. A customer service/browser runner requires explicit topology and denial-test updates, not bypassing this guard. |
| `ops/local/stack.ts`, `compose.yaml` | Ephemeral credentials/certificates; service DNS names on internal networks. Keycloak hostname is `https://keycloak:8443`; certificates cover service name/localhost. Browser tests must run in the isolated network and trust only generated certificates. No host trust-store changes. |
| `ops/local/keycloak-realm.json` | Customer and desktop public clients are disabled, with empty redirect/origin lists, S256 required and direct grants disabled. Enable only the customer client with one exact callback; keep desktop disabled. No seeded login accounts or management client currently exists. |
| `pilot.identities` | `subject`, `verified`, monotonic `version`; no email/profile or MFA-enrollment fields. Keycloak remains credential/profile authority; do not silently infer verified email or enrollment from an app row. |
| `pilot.pending_access` | Has hashed token, email, purpose, optional identity/tenant, expiry, consumed/revoked times. No atomic application redemption implementation. |
| `pilot.sessions` | Has token hash, identity/membership versions, audience, active tenant, times, `mfa_at`. No CSRF/OIDC-flow storage or current enrollment provenance. |
| `pilot.invitations` | Immutable email/role/issuer/version binding, exactly one issuer kind; Manager issuer constrained to Employee role. Runtime acceptance/revocation locks remain to implement. |
| `pilot.draft_revisions`, `pilot.approvals`, `pilot.occurrences` | Immutable snapshots, globally unique DB-generated occurrence ID and tenant creation key; application role cannot supply occurrence ID. Existing schema already separates content from Employee invitation storage. |
| `tests/pilot/fixtures.ts` | `seedTenant(db)` seeds storage rows, including an unverified identity; it is not an authenticated Keycloak user fixture. `occurrence(db, fixture, key?)` supplies the existing content fixture. Preserve storage-test meaning. |
| `scripts/pilot-db.ts` | Runs only `001_pilot` up/down, protects fixture identity and populated down. Additive migrations need explicit ordered handling and empty up/down/up checks; do not weaken unknown-object/populated-data guards. |
| `package.json`, `tsconfig.pilot.json` | Only `pg` installed at runtime; strict compilation already includes `apps`, `packages`, `ops` and pilot tests. No application routes/contracts exist. |

## Delivery boundaries and dependency decision

Recommended sequence: **A -> {B, C} -> accepted Task 3 -> Task 4**. B and C can be reviewed/rejected independently after A; A alone is a usable verified signup/login/dashboard slice. B/C may run in parallel only after root assigns their issues/chats and the A contract is merged. No artificial PR is needed for scaffolding alone.

| Delivery | Owns | Does not require |
| --- | --- | --- |
| A / [#117](https://github.com/Maeximilion/MaexSocial/issues/117) | Public signup/verification/recovery; shared identity lifecycle; Keycloak login/logout; tenant-bound server session, CSRF, current membership and MFA checks; own dashboard; accessible public/customer shell; real isolated browser/identity test setup. | Employee invitation/removal routes; business-facts editor, draft or approval routes. |
| B / [#123](https://github.com/Maeximilion/MaexSocial/issues/123) | Manager-only Employee invitation/removal and complete invitation acceptance, including existing identity preservation, pending-identity cleanup, issuer/grant races and no role elevation. | Draft/approval implementation. |
| C / [#124](https://github.com/Maeximilion/MaexSocial/issues/124) | Business-facts/content view, Employee draft editing, Manager immutable approval, occurrence read view, idempotent reapproval and text-only rejection. Preserve accepted authority for facts; do not invent new write rights. | Employee invitation routes; it uses A's verified Manager/Employee fixtures. |

A owns `apps/web/src/server/customer.ts`, `session.ts`, `identity.ts`, `apps/web/src/routes/portal.ts`, `packages/contracts/pilot.ts`, `tests/pilot/portal.test.ts`, `tests/pilot/identity-fixtures.ts`, the minimal ordered access migration and runtime/CI integration. B owns `apps/web/src/routes/employees.ts`, `tests/pilot/employees.test.ts` and any invitation-specific migration. C owns `apps/web/src/routes/content.ts`, `tests/pilot/approval.test.ts` and minimum business-facts storage; it reuses existing content tables. B/C each add only their own explicit router mount in `customer.ts`; serialize those tiny integration edits. Do not create an extension/plugin registry.

Shared updates (package/lock, topology, migration runner, CI, status) land with A first. B/C change them only for a demonstrated missing behavior, coordinated with root. Keep existing Task 1 tests and helpers intact; add identity fixtures separately. The accepted original plan/evidence remains authoritative and its full Task 2 is not complete until A+B+C pass.

## Shared contract to establish in A

These are proposed implementation signatures, not claims about existing functions. A must freeze them in its delivered code and handover before B/C implementation.

```ts
type CustomerRole = 'Manager' | 'Employee';
interface CustomerContext {
  sessionId: string;
  identityId: string;
  tenantId: string;
  membershipId: string;
  membershipVersion: number;
  role: CustomerRole;
  mfaAt: Date | null;
  mfaEnrolled: boolean;
}
// server/session.ts; the caller owns BEGIN/COMMIT and the supplied connection.
async function requireCustomer(
  db: Client, token: string, now: Date
): Promise<CustomerContext>;
function requireManagerMfa(context: CustomerContext, now: Date): void;
function requireCsrf(origin: string | undefined, proof: string | undefined,
  expectedOrigin: string, expectedProof: string): void;
// server/identity.ts; consumes a server-held completion, never raw client claims.
interface VerifiedIdentity {
  identityId: string;
  subject: string;
  email: string;
  firstName: string;
  lastName: string;
  previouslyVerified: boolean;
}
async function consumeIdentityCompletion(db: Client, completionId: string,
  purpose: 'signup' | 'invitation', now: Date): Promise<VerifiedIdentity>;
```

`requireCustomer` rechecks current identity version/verification, session revocation/expiry, active tenant and active membership/version, using locks retained through the caller's transaction. Never accept tenant/role from body, email domain or an unverified token. Proposed lock order is tenant -> identity -> membership -> session -> invitation/content object; lock multiple rows in stable ID order. A session lookup used to locate those rows is untrusted until repeated under the locks. Revocation and approval must acquire the same authority locks. Identity-only reset must not later acquire a tenant lock in reverse order. Test cross-user removal/reset and tenant-switch interleavings before freezing the protocol. A middleware check outside the mutation transaction is insufficient. Tenant switching checks the destination membership and rotates the opaque session/CSRF proof, rather than trusting each request's tenant selector.

An OIDC result is usable only after signature, issuer, customer audience, expiry, nonce, state, PKCE and exact callback validation. Trusted verified email/profile and MFA evidence must come from the actual local IdP flow; a timestamp or client `amr` field alone is not proof of enrolled MFA. Authentication tokens stay server-side; customer cookies are host-only Secure/HttpOnly/SameSite=Lax. Public challenge GET and invitation GET never consume tokens.

A supplies `consumeIdentityCompletion` for B, with an opaque one-use completion reference bound to identity/email/purpose and the originating challenge/invitation. Persist completion only after verified local IdP lifecycle completion; recheck current identity generation and consume under the same transaction as the workspace/invitation mutation. Bind invitation completions to the exact invitation as well as its purpose so B cannot substitute another grant. Freeze its concrete completion record after the Keycloak prerequisite below, before B starts. It must distinguish new/unverified from already-verified identities and preserve existing verified profile, password, factors and other memberships. It must not grant a tenant or role itself. B consumes that proof while atomically consuming its invitation and creating only the authorized membership.

## Review focus

1. A database transaction cannot atomically commit Keycloak credential changes. Fail/restart between IdP cleanup and app activation must remain denied and retry safely; test each boundary in A, then invitation reuse in B.
2. Existing verified B users must not lose credentials, profile, MFA or B membership when signing up again (A) or accepting an A invitation (B).
3. A shared A/B identity with active A must not access B by guessed ID; recheck after committed membership revocation on the next request (A/B/C).
4. A Manager demoted and re-promoted must not revive an old approval. C binds immutable approval to the exact current grant/version; Task 4 consumes the same rule.
5. Independent topology, browser TLS and actual MFA evidence are prerequisites, not simulated successes. A must demonstrate actual Keycloak/browser positive controls alongside denials.

## A implementation steps

- [ ] **Identity lifecycle prerequisite:** inspect the pinned Keycloak's supported registration, required-action, credential/session revocation, verified-email and MFA mechanisms. Exercise an attacker-preregistered fixture and an already verified fixture in isolation. Record which operations provide trustworthy completion evidence and test interruption before/after each operation. Freeze the internal activation-proof signature from this evidence; never substitute a mock for this prerequisite or permit app access before cleanup completes.
- [ ] **Failing access tests:** add `portal.test.ts` and `identity-fixtures.ts`. Establish Manager A, Employee A, Manager B, shared A/B and DEV/Admin fixtures through actual local Keycloak; keep secrets in ignored fixture files. Assert no active workspace before verified activation, exactly one workspace/Employee after concurrent valid signup redemption, generic duplicate verified signup with guidance only, unchanged existing credentials/memberships, and no role/domain injection. First/last names required; optional fields absent succeeds.
- [ ] **Add access storage and identity operation:** add only needed ordered migration(s) for OIDC/CSRF flow state, durable throttle counters and activation completion/retry state. Keep Keycloak credentials out of app storage. Preserve all Task 1 constraints/privileges and destructive-drill refusal. Add empty migration up/down/up tests and crash/retry activation tests before implementing writes.
- [ ] **Session/request tests then implementation:** implement the signatures above and customer HTTPS listener. Exercise code/state/nonce/audience/signature/PKCE/redirect tampering, rotation/login/logout/reset/elevation, 30-minute idle and 8-hour total boundaries, independent account/source throttles, invalid origin/CSRF, safe GET, TLS success/plaintext-credential denial and fail-closed unavailable authority. Verify cookie attributes and no token-bearing logs or responses.
- [ ] **Portal and boundary controls:** implement keyboard-accessible signup/login/recovery/dashboard. Test shared A/B switching and guessed object IDs, suspended/revoked membership with an open session, no private management authority, canary-free responses/logs. Each denied write has zero mutation/fetch/media-job/charge and a legitimate positive control. Customer role is Employee after public signup; fixture-only Manager setup does not expose a promotion route.
- [ ] **Verification:** run `npm run pilot:build` before `node --test dist/pilot/tests/pilot/portal.test.js`; restart application processes from that build. Run existing storage/isolation/fixture regression checks and full foundation checks. Use the pinned Node/npm runtime, not the host Node 26/npm 12 observed during planning. Record actual keyboard/browser evidence separately from direct HTTP tests.
- [ ] **Checkpoint/delivery:** commit focused tested increments; before one normal #117 PR run complete preflight and independent fresh actual Astra/high review. Hold publication until #121 merges. Attach PR, synchronize issue/Project/status/handover, and report head/base/review evidence to root. Root alone merges.

## B acceptance and implementation contract

- [ ] Add failing `employees.test.ts` against A's real session/identity fixture. Implement `POST /customer/employees/invitations` (email only), `DELETE /customer/employees/:membershipId`, read-only invitation view and explicit confirmation in `routes/employees.ts`.
- [ ] Require current same-tenant Manager and enrolled MFA <=5 minutes on invite/remove; reject Employee, DEV/Admin customer requests, missing/stale/future proof, recovered-unenrolled, cross-tenant target, Manager removal/promotion and submitted tenant/role fields. Server fixes Employee and active tenant.
- [ ] Store only token hash; 24-hour identity/purpose binding, resend invalidation, displayed tenant/role, no GET mutation. Serialize consume with issuer revocation/demotion and tenant suspension in both commit orders using DB barriers. Exactly one valid redemption; revoked/replaced/expired/wrong-purpose/wrong-recipient yields zero grant.
- [ ] Use A's identity completion proof. New/unverified invitees choose credentials and required names only after mailbox proof and preregistration cleanup. Existing verified users must authenticate as the intended identity, preserve all existing fields/factors/memberships, add only the invited membership, and cannot reset credentials or replace/reactivate an existing role.
- [ ] Removal increments the target membership version, cancels affected tenant invitations and invalidates derived authority. Next A request with old cookie fails; an independently established B session still works. Verify mutation counts/canaries and positive controls after denials.
- [ ] Build, restart and run `node --test dist/pilot/tests/pilot/employees.test.js` plus A regressions; review/deliver through B's own fresh assigned chat/PR. Freeze no new shared API without coordinating A/root.

## C acceptance and implementation contract

- [ ] Add failing `approval.test.ts`; implement `POST /customer/drafts`, `POST /customer/occurrences/:id/approval` and `GET /customer/occurrences/:id` in `routes/content.ts`, plus draft/approval views. Reuse existing revisions, locations, occurrences and approval tables.
- [ ] Use A's transaction-scoped context; Employee/Manager may edit own plain text. Only current Manager with enrolled MFA <=5 minutes approves. Employee/DEV/Admin, wrong tenant, stale/missing proof, recovery without MFA and unauthorized location yield zero approval/job/disclosure.
- [ ] Snapshot exact revision, location, timezone, local display time and corresponding UTC due instant. Validate timezone/local/UTC consistency, including ambiguous/nonexistent DST times. Never accept a caller-generated occurrence ID; retries preserve the existing server-created occurrence/creation key.
- [ ] Concurrent duplicate approval returns one intent; reapproval after grant invalidation binds the same unclaimed occurrence to a new immutable approval. Editing text/destination/time clears previous approval eligibility. Never modify immutable snapshots; no reapproval reopens exported/claimed/uncertain occurrences. Test demote/re-promote and edits with DB barriers, retaining all Task 4 consumption requirements.
- [ ] Reject attachment, upload, ingestion-link and object-reference fields for every role through strict request schemas, including direct calls; plain text remains allowed. Assert zero media storage/fetch/job/charge and no B canary in response/log/state. Do not implement export or provider dispatch.
- [ ] Build/restart and run `node --test dist/pilot/tests/pilot/approval.test.js`, A regressions and relevant storage tests; review/deliver through C's own assigned chat/PR.

## Coverage check and present evidence

All original Task 2 requirements have an owner: activation/recovery/OIDC/CSRF/session/portal/abuse/TLS/keyboard in A; invitation and Employee lifecycle in B; draft/approval/text-only/PLAN-01 in C. ACCESS-01/02/04/06/07/09/10/11/12/13/14 are exercised where A/B/C expose the corresponding route; ACCESS-15 approval is C and ACCESS-16/17 Employee invitations are B. Private management, export, worker and full recovery remain accepted Tasks 3–6. Each delivery records allowed and denied cases, side effects and exact revision.

This is a source-inspection planning checkpoint. No new product code, runtime/browser acceptance or independent code review has run in this chat. The host reports Node 26.13.0/npm 12.0.2, outside the pinned pilot range; use the existing pinned runtime or isolated runner for product work. Do not count Task 1 storage fixtures as an implemented customer session or Keycloak activation flow.
