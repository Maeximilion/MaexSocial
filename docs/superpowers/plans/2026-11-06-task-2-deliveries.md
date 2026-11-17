# Task 2 customer access and content delivery plan

> Use `superpowers:executing-plans` for this accepted plan. Implement only the assigned issue. The owner's November 17 resume requires Claude API PR review, without a separate Codex review or bot fallback. Root accepted the refined A1/A2/B/C delivery boundary on November 17; it does not remove any original acceptance requirement.

**Goal:** Complete every accepted Task 2 requirement through a synthetic session foundation, proven identity lifecycle, Employee management and immutable content approval.

**Architecture:** Keep the accepted strict TypeScript/Node service, PostgreSQL transaction boundary, local Keycloak and isolated TLS fixture. No router/plugin framework or additional product architecture. Node 24.22.2/npm 11.19.1, PostgreSQL 17.11, Keycloak 26.8.2; Express 5.3.0 serves the small customer boundary.

**Authority:** [Accepted MS-009 Task 2](2026-11-05-ms-009-local-text-pilot.md#2-customer-registration-portal-and-immutable-approval), [evidence map](2026-11-05-ms-009-pilot-evidence-map.md), [access contract](../../17_ACCESS_SECURITY.md), [owner acceptance](https://github.com/Maeximilion/MaexSocial/issues/15#issuecomment-6681723454) and revised [#117](https://github.com/Maeximilion/MaexSocial/issues/117).

## Global constraints

- Only invented A/B customers in local isolated fixtures. No real accounts, external runtime mail/provider calls, deployment, product spend or G3 acceptance.
- Manager alone approves. Employee/Manager export remains Task 4; DEV/Admin remains separate and cannot approve customer content.
- Manager invitation/removal/approval needs enrolled MFA no older than five minutes, including exactly five minutes; future proof and greater ages fail. Recovery must restore enrollment before sensitive actions.
- Activation/invitation lifetime 24 hours; recovery 15 minutes. Sessions have 30-minute idle and eight-hour absolute limits.
- Independent account/source limits: login 5/30 attempts per 15 minutes; signup/recovery/resend 3/10 per hour each, including unknown identities. These remain A2 obligations.
- Compile before product tests and restart from that output. Record exact candidate, fixture and side effects. Synthetic authority never establishes real IdP/MFA proof.
- Canonical main stays clean. One normal delivery PR per assigned chat, attached immediately. Root alone manages coordinator records, admission and merges. No new chat or agent is implied.
- The November 6 pause was superseded by the explicit November 17 resume without a new deadline. PR #130 is the current integrated maintenance base. Use the complete read-only review input builder before publication and verify authentic Claude API current-head/base review afterwards.

## Delivery boundary and dependency decision

| Delivery | Owned behavior | Completion boundary |
| --- | --- | --- |
| A1 / [#117](https://github.com/Maeximilion/MaexSocial/issues/117) | Synthetic current-authority/session/tenant/CSRF contract; protected own-workspace dashboard, local opaque logout, isolated keyboard test and minimum migration. | Public signup/login/callback/recovery/MFA/session issuance absent. Test-only sessions and authority are injected solely inside isolated harnesses. No verified signup-to-dashboard journey. |
| A2 / [#131](https://github.com/Maeximilion/MaexSocial/issues/131) | All real login/activation/lifecycle/MFA/recovery, authenticated provider adapter, completion provenance and integrated logout/throttling. | Blocks integrated G3/G5 and B's real invitation completion. Safe design/verification disposition required for the retained old-credential race gap. |
| B / [#123](https://github.com/Maeximilion/MaexSocial/issues/123) | Manager-only Employee invitation/removal and complete invitation acceptance, preserving existing identities and enforcing issuer/grant races. | Uses A1 contract and A2 provenance; no independent competing session system. |
| C / [#124](https://github.com/Maeximilion/MaexSocial/issues/124) | Business facts/content view, draft editing, Manager immutable approval, occurrence read view, reapproval and text-only denial. | Uses A1 contract and A2 verified identity/MFA fixtures; does not implement invitation routes. |

Root decides whether the proven A1 contract is stable enough to dispatch B/C. A1 merge does not automatically admit them or satisfy their real authentication prerequisites. Task 2 needs **A1 + A2 + B + C and integrated evidence**; Task 3 still waits. G3/G5 remain blocked.

A1 owns `server/customer.ts`, `server/request.ts`, `server/session.ts`, `routes/portal.ts`, `packages/contracts/pilot.ts`, the session migration, fixture/browser support and their tests. A2 owns the future IdP adapter, lifecycle/completion storage and public auth routes. B owns `routes/employees.ts` and its tests/migrations; C owns `routes/content.ts` and its tests/minimum facts storage. B/C add only explicit mounts in `customer.ts`, coordinated through root. Preserve Task 1 storage tests and role restrictions.

## A1 shared contract

The caller owns BEGIN/COMMIT/ROLLBACK and the connection. Parse an HTTPS customer request with `customerRequest(request, fields?)`; mutation callers provide the complete allowed field list including `csrf`. It rejects duplicate/malformed cookies, foreign/missing Origin, mismatched CSRF, unknown or non-string fields. `requireCustomerRequest(db, binding, now, inspect)` rechecks authority and stored CSRF binding within that same transaction. Derive tenant, role and subject from the returned `CustomerContext`, never from request fields.

`requireCustomer` enforces customer audience, revocation, idle/absolute expiry, verified identity and current identity/tenant/membership versions and activity. `InspectIdentity` is a mandatory server dependency; A1 supplies only test doubles. It checks matching subject, current enabled/verified state, no pending actions and matching current factor IDs for the stored synthetic MFA credential. `requireManagerMfa` additionally checks role, enrollment and proof age. **These interfaces are not an authenticated IdP adapter, generation fence or real MFA provenance. A2 must establish those before public login opens.**

`rotateCustomerSession` checks both source and target authority, revokes the old opaque token and rotates token/CSRF while preserving original created/expiry times. HTTP callers then invoke `requireBoundCsrf` under the held locks and roll back the entire rotation on rejection. Local logout invalidates only the opaque application session, including when provider inspection is unavailable; it is not IdP logout.

Lock order: **all identity IDs sorted -> all tenant IDs sorted -> memberships ordered by tenant/id -> sessions -> invitation/content objects**. Cross-user callers first collect and lock the full identity set using `lockIdentities`; switching locks both source and destination tenant/membership sets. Preliminary lookups are revalidated under locks; changed identities, tenant/membership bindings or versions deny/restart, never acquire a newly discovered earlier lock out of order. Domain queries use the resolved tenant inside the same transaction. Authority changes must obey this protocol. HTTP middleware alone cannot authorize a later mutation.

A1 migration adds only `sessions.csrf_hash`, `tenant_version` and `mfa_credential_id`. Missing bindings deny; no old session is upgraded implicitly. The removed provisional migration was never merged: preserve old populated investigative fixtures and initialize a fresh fixture rather than treating their schema as supported upgrade input. `identity_operations`, `identity_completions`, `consumeIdentityCompletion`, browser-flow/public-session/rate-window storage and provider generation/lifecycle semantics are excluded. Unused mail/OIDC libraries are removed. Prior code remains in pushed history at `02784466b2f74ff1dbedbcdcec26a51f823aec4a` plus a private source/build checkpoint; this is recovery material, not a stable completion contract.

## A1 implementation and verification

- [x] Implement opaque sessions, current versions, complete lock ordering, explicit HTTP/CSRF binding and strict TLS/cookie/HTML boundary.
- [x] Test idle/absolute deadlines, removal/suspension then reactivation, shared identity locks, synthetic factor removal and exact five-minute MFA boundary.
- [x] Preserve both AppDB identity-invalidation/protected-write commit orders (the reset-side AppDB model only). Test switch/removal in both orders with observed blocking PIDs, session/membership effects and independent A-session positive controls.
- [x] Keep real auth and fixture issuance unavailable to ordinary requests; test GET/POST entry-point denial, query-token rejection and rollback for a forged stored CSRF binding.
- [x] Exercise actual isolated keyboard navigation and tenant switching over trusted local TLS, preserving same-origin referrer policy. No IdP/external request occurs in that dashboard test.
- [x] Fresh up/down/up and empty unknown-object rollback guard; strict build, targeted tests and full pilot suite.
- [ ] Finish foundation checks, complete candidate input preflight, normal PR, exact integration CI and authentic complete Claude API review; link actual results in the handover/PR.

## A2 retained acceptance and implementation contract

All unfinished original A obligations remain in #131; this split is not a waiver:

- Supported real browser login and callback validation for signature, issuer, customer audience, expiry, code/state/nonce/PKCE and exact redirect. Authentication tokens stay server-side. Keep both realm clients closed until this is proven; no direct password grant or fixture login.
- Mailbox-bound activation/invitation 24 hours and recovery 15 minutes. GET never consumes a challenge. Explicit redemption is single-use under races; expired/revoked/replaced/wrong recipient/purpose/tenant/role and injected role/domain fail. First/last names required; optional fields absent succeeds. Valid public signup creates exactly one workspace and Employee membership after verification; no earlier access.
- Preregistration cleanup must retire attacker password, factors, sessions and challenges before first activation. Existing verified customers retain profile, password, MFA and all other memberships; duplicate verified signup is generic guidance only. Invitation acceptance adds only its authorized membership.
- Persist identity/email/purpose/challenge/invitation-bound completion only after proven IdP completion; consume once with the workspace/invitation transaction. Distinguish new/unverified and already-verified identities. Do not grant tenant/role inside the identity adapter. Freeze a concrete completion contract only after evidence.
- Durable IdP/AppDB crash/retry and generation/fencing design; interruption before/after each supported operation remains denied and retry-safe. Provider credential mutation is not atomic with PostgreSQL. The blocked in-flight old-credential request test must **not** be repeated, rephrased or delegated. [Recorded boundary](https://github.com/Maeximilion/MaexSocial/issues/117#issuecomment-6950555219); root owns a safe design/verification disposition before completion.
- Actual MFA enrollment, step-up, factor removal and recovery; sensitive operations require restored enrollment and fresh authentic proof. A timestamp or client `amr` claim alone cannot prove enrollment. Integrated login/logout/reset/elevation rotates/revokes the appropriate session and provider authority.
- Durable independent account/source throttles with all numerical bounds above and unknown-account equivalence. Keep credentials out of AppDB and logs.
- Accessible public/signup/login/recovery shell and real isolated identity-to-dashboard journeys, positive and negative controls, no private management authority, TLS/plaintext denials and safe error/log handling. Repeat session regressions with actual server-authenticated authority. Run migration/crash/retry/full relevant tests and current-head CI/API review.

## B acceptance and implementation contract

- [ ] Add failing `employees.test.ts` against A1's transaction contract and A2's real session/identity fixture. Implement `POST /customer/employees/invitations` (email only), `DELETE /customer/employees/:membershipId`, read-only invitation view and explicit confirmation in `routes/employees.ts`.
- [ ] Require current same-tenant Manager and enrolled MFA <=5 minutes on invite/remove; reject Employee, DEV/Admin customer requests, missing/stale/future proof, recovered-unenrolled, cross-tenant target, Manager removal/promotion and submitted tenant/role fields. Server fixes Employee and active tenant.
- [ ] Store only token hash; 24-hour identity/purpose binding, resend invalidation, displayed tenant/role, no GET mutation. Serialize consume with issuer revocation/demotion and tenant suspension in both commit orders using DB barriers. Exactly one valid redemption; revoked/replaced/expired/wrong-purpose/wrong-recipient yields zero grant.
- [ ] Use A2's proven identity completion proof. New/unverified invitees choose credentials and required names only after mailbox proof and preregistration cleanup. Existing verified users must authenticate as the intended identity, preserve all existing fields/factors/memberships, add only the invited membership, and cannot reset credentials or replace/reactivate an existing role.
- [ ] Removal increments the target membership version, cancels affected tenant invitations and invalidates derived authority. Next A request with old cookie fails; an independently established B session still works. Verify mutation counts/canaries and positive controls after denials.
- [ ] Build, restart and run `node --test dist/pilot/tests/pilot/employees.test.js` plus A1/A2 regressions; review/deliver through B's own fresh assigned chat/PR. Freeze no new shared API without coordinating with root.

## C acceptance and implementation contract

- [ ] Add failing `approval.test.ts`; implement `POST /customer/drafts`, `POST /customer/occurrences/:id/approval` and `GET /customer/occurrences/:id` in `routes/content.ts`, plus draft/approval views. Reuse existing revisions, locations, occurrences and approval tables.
- [ ] Use A1's transaction-scoped context with A2's real identity/MFA provenance; Employee/Manager may edit own plain text. Only current Manager with enrolled MFA <=5 minutes approves. Employee/DEV/Admin, wrong tenant, stale/missing proof, recovery without MFA and unauthorized location yield zero approval/job/disclosure.
- [ ] Snapshot exact revision, location, timezone, local display time and corresponding UTC due instant. Validate timezone/local/UTC consistency, including ambiguous/nonexistent DST times. Never accept a caller-generated occurrence ID; retries preserve the existing server-created occurrence/creation key.
- [ ] Concurrent duplicate approval returns one intent; reapproval after grant invalidation binds the same unclaimed occurrence to a new immutable approval. Editing text/destination/time clears previous approval eligibility. Never modify immutable snapshots; no reapproval reopens exported/claimed/uncertain occurrences. Test demote/re-promote and edits with DB barriers, retaining all Task 4 consumption requirements.
- [ ] Reject attachment, upload, ingestion-link and object-reference fields for every role through strict request schemas, including direct calls; plain text remains allowed. Assert zero media storage/fetch/job/charge and no B canary in response/log/state. Do not implement export or provider dispatch.
- [ ] Build/restart and run `node --test dist/pilot/tests/pilot/approval.test.js`, A1/A2 regressions and relevant storage tests; review/deliver through C's own assigned chat/PR.

## Coverage and evidence limits

A1 covers only the synthetic request/session parts of ACCESS-01/02/04/07/10/11/12/13; it does not complete those whole-journey cases. A2 retains activation/recovery/OIDC/MFA/abuse and real identity proof (ACCESS-09/13/14/17); B owns Employee invitation/management and issuer races (ACCESS-16/17); C owns immutable approval/text-only/PLAN-01 and ACCESS-15. Private management, export, dispatch and full recovery remain Tasks 3–6. No accepted gate or case is removed. The evidence map separates subchecks from integrated acceptance; the delivery handover/PR records exact revisions and actual review evidence.
