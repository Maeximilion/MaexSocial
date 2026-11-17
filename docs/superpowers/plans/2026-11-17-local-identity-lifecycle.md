# Local Identity Lifecycle Conditional Implementation Plan

> **For agentic workers:** Use `superpowers:executing-plans` only after a new precise coordinator implementation assignment. This source-only plan grants no execution, delegation or PR authority. Unresolved provider guarantees prevent it from being implementation-ready.

**Goal:** Preserve every #131 acceptance requirement and identify the evidence/decisions needed to implement a supported identity lifecycle safely.

**Architecture:** Keycloak owns credentials and browser authentication. The application owns local admission/challenges and tenant grants in PostgreSQL; no distributed transaction is assumed. Completion production remains unavailable until supported provider semantics are established.

**Tech Stack:** Accepted strict TypeScript/Node/PostgreSQL/Keycloak; inherited Task 2 pins Node 24.22.2, npm 11.19.1, PostgreSQL 17.11, Keycloak 26.8.2 and Express 5.3.0. No new dependency/platform is selected here.

**Spec:** [Local identity lifecycle design](../specs/2026-11-17-local-identity-lifecycle-design.md). The [accepted MS-009 plan](2026-11-05-ms-009-local-text-pilot.md), [evidence map](2026-11-05-ms-009-pilot-evidence-map.md) and [#131](https://github.com/Maeximilion/MaexSocial/issues/131) remain authoritative.

## Global constraints

- Current writing ownership: this plan and its design only. No product, fixture, workflow, dependency, coordinator-record or private probe edits.
- No installation, live IdP/credential/DB/provider call or test harness in preparation. No keys/private probes read. The platform-blocked test remains excluded, including reconstructed instructions and alternative routing.
- Preserve identity, profile, credentials, factors and unrelated memberships of verified users. New/unverified activation alone clears preregistration authority. No new platform, custom IdP extension or weakened completion requirement.
- Verify/invite 24 h, reset 15 min; customer idle/absolute 30 min/8 h; enrolled MFA proof <=5 min, exactly five accepted, future/stale denied; post-recovery reenrollment required.
- Login 5/account + 30/source per 15 min; signup/recovery/resend each 3/account + 10/source per hour. Unknown identities count; no direct-IdP bypass.
- No real accounts, external runtime mail, deployment, product spending or gate acceptance. #123 needs proven identity completion; #124's real authentication evidence also depends on #131. Task 3 waits for complete Task 2.
- No PR before root's disposition and #117 merge. A later PR needs current required/integration CI and authentic complete Claude API head/base evidence. Root alone merges/archives.

## Review focus

| Failure class | Required disposition / owning stage |
| --- | --- |
| Browser action omitted/cancelled but callback arrives | Authentication cannot assert lifecycle completion; stages 1 and 3. |
| Timeout/restart leaves provider state uncertain | Durable denial/reconciliation, never delay-based success or blind retry; stages 1 and 3. |
| Shared verified identity signs up again or accepts another tenant | Preserve identity and other authority, add only intended grant; stage 3. |
| Enrollment exists but proof lacks the required context/freshness or belongs to an old enrollment/recovery generation | Deny sensitive operations until provenance is established; stages 1 and 2. |
| Direct IdP route escapes application throttles/confirmation | Enumerate all supported entry paths and preserve accepted public semantics; stages 1 and 2. |

## 1. Resolve the evidence gate before implementation

**Files:** Only the two planning documents. **Consumes:** pinned official sources, #117 result/handover, accepted G2. **Produces:** coordinator disposition with cited guarantees and explicitly remaining gaps; no executable lifecycle signature.

- [x] Separate official capabilities, protocol guarantees, prior observations and design inferences in the spec.
- [x] Record the safe recommendation, serious alternative and missing completion/MFA guarantees; report to root.
- [ ] Root identifies evidence for an immutable-subject completion boundary satisfying the spec's effective credential and application-authority postconditions, and a supported enrolled-MFA context/time/generation bridge. Neither a blanket ban on every internal IdP write nor an exact factor ID is an independently accepted product requirement. An absence of evidence remains an open requirement, not a request to retry the excluded test.
- [ ] Resolve read-only GET versus native mailbox actions, application challenge-to-provider binding, all login/recovery entry paths and durable reconciliation after ambiguous outcomes. List the allowed supported mechanism and authoritative completion observation for each; if none is available, hold implementation of that flow.
- [ ] Root approves a concrete safe lifecycle contract and issues a bounded implementation assignment. The browser/OIDC direction is already accepted as a limited draft; that does not approve completion semantics. Rewrite stages 2–4 with exact provider-backed interfaces/files/checks then. Do not fill unresolved semantics with exploratory code or tests that merely assume them.

## 2. Conditional adapter and ordinary authentication delivery

**Candidate files, not authorized edits:** `apps/web/src/server/identity.ts` (provider adapter), `apps/web/src/server/customer.ts` (explicit auth mounts), `apps/web/src/server/session.ts`, `apps/web/src/server/request.ts`, `packages/contracts/pilot.ts`; `tests/pilot/portal.test.ts`. Reuse merged #117 rather than replacing its request/session system. Root must assign any fixture/config or new migration changes separately by exact path.

**Consumes:** actual merged A1 `InspectIdentity = (subject: string) => Promise<IdentityStatus>` and caller-owned transaction/request interfaces. `IdentityStatus` exposes `subject`, `verified`, `enabled`, `requiredActions`, and credential `{id,type}` entries. **Produces:** authenticated current-status observations and validated browser-login evidence; never completion inferred from callback alone.

- [ ] After stage 1, specify the real adapter's least-privilege source, issuer/subject mapping, bounded failure handling and output allowlist. Preserve denial on unavailable authority and no caller/test-double authority in live entry points.
- [ ] Plan then implement ordinary code/state/nonce/PKCE/issuer/audience/expiry/redirect validation, opaque session issuance/rotation and App/IdP logout according to the approved supported contract. Cover request tampering/replay, unavailable provider, existing-session substitution, current tenant/member versions and accepted expiry bounds with valid controls.
- [ ] Prefer proven configured authentication context, proof-time bound and current enrollment/recovery generation. Root must approve the compatible A1 representation before changing `mfa_credential_id`/`mfa_at`; an arbitrary factor ID cannot stand in for context evidence. Cover exact five-minute boundary, future/stale timestamps, enrollment changes and post-recovery reenrollment. Configuration or token claims without the approved semantic mapping do not pass.
- [ ] Cover all account/source counters, public equivalence and direct provider entry paths, plus HTTPS-only credentials, strict origin/CSRF, host-only Secure/HttpOnly/SameSite cookies and secret-free outputs. Preserve #117's local logout behavior if provider logout is unavailable.

## 3. Conditional mailbox lifecycle and completion delivery

**Candidate files:** adapter above and a coordinator-assigned ordered application migration; future lifecycle/completion tests named by that assignment. No reuse of the removed exploratory migration as a supported upgrade. **Consumes:** stage 1 provider guarantees and merged A1 lock order. **Produces:** only then a stable, documented identity-preserving completion contract for #123.

- [ ] Specify exact durable phases, current-generation ownership, idempotency/expiry/revocation rules and authoritative reconciliation observations before coding. Keep provider work outside claims of AppDB atomicity. Preserve unresolved outcomes across restart; compensation cannot restore stale credentials or erase legitimate verified users.
- [ ] Cover read-only challenge views and explicit CSRF-protected single redemption, wrong identity/purpose/version/generation, expiry/resend/revocation and duplicate acceptance. Required names and optional fields must match the accepted contract; mailbox-only guidance/public equivalence preserves existing verified identities.
- [ ] Establish new/unverified cleanup before admission and exactly one new Employee workspace, no role/domain injection. Verify existing verified subject/profile/password/factors/other memberships remain intact. Invitation-bound completion creates no grant by itself and cannot substitute another invitation or revive removed access.
- [ ] Freeze completion only when its provider prerequisites are evidenced. Consumer rechecks exact identity/purpose/invitation/version/generation and consumes with the local domain mutation under the inherited lock order. #123 owns issuer/grant races and invitation mutations; coordinate that boundary rather than implement its routes here.
- [ ] Record ordinary crash/ambiguous-outcome acceptance as required observations under a later explicit safe scope. The platform-blocked case stays unresolved unless root obtains acceptable independent evidence/disposition; this plan contains no procedure for it.

## 4. Conditional integrated evidence and publication

- [ ] Map ACCESS-01/02/04/06/07/09/10/11/12/13/14/17 to the approved implementation and real local fixture. Include valid controls, exact state/side-effect counts, canaries and keyboard signup/login/recovery/dashboard. Distinguish HTTP checks, browser evidence, mocks and genuine IdP results.
- [ ] Record exact fixture/build SHA, commands/outcomes and remaining boundaries. Follow accepted build-before-tests and process-restart requirements. Perform migration checks only on an explicitly assigned empty disposable fixture; preserve unrelated data/worktrees.
- [ ] Reconcile merged #117 interface changes, #123/#124 dependencies, issue/status and handover under assigned file ownership. Required/integration CI and complete Claude API evidence must cover the actual PR candidate. Documentation success cannot close #131 or G3/G5.

## Preparation evidence

Official documentation was read on 2026-11-17. The spec records the pinned AIA source blob and prior result boundary; A1 interfaces were inspected at `badc7af09f0a1c05883b957cd0f2e6ed115001f7`. No implementation, runtime, migration, browser, test harness or review was executed by this preparation. Outstanding stage-1 obligations are deliberate missing guarantees, not implementation discretion. The next action belongs to root: disposition those guarantees and the permitted follow-up scope.

Documentation validation: `python scripts/check_repo.py` passed (local links, JSON/TOML and repository artwork); `git diff --check` passed. Foundation/unit/product suites were not run: this assignment permits source/document preparation only and excludes test harness execution. These checks establish no authentication behavior.
