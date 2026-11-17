# Handover 2026-11-17 — MS-009 Task 2A / #117

## Status

Stopped at (UTC) — 2026-11-17T14:15:45Z (the blocked identity race investigation stopped; independent product work remains authorized).

The owner resumed work on November 17 without a new deadline. This checkpoint preserves partial Task 2A implementation and the evidence boundary; it is not a completed authentication system or product acceptance. No PR exists. The smaller predecessor #125 / PR #126 merged and was normally integrated into this branch.

Implementation/review — Codex implementation, actual session `gpt-6-astra` / `high`, no Fast override observed; future PR review through Claude API only under the [current policy](../../tooling/agent-workflow.md#pr-review-policy). No review has run on this delivery. Do not start a separate Codex review or bot fallback.

Completed source increments:

- Corrected Keycloak SMTP configuration to the sink's implicit TLS transport. A real greeting test failed before and passed after the change; plaintext receives no SMTP greeting.
- Added the ordered customer-access migration, durable operation/completion/browser-flow/rate storage, current session authority helper and server-only IdP evidence contract. Passwords and IdP access/refresh tokens are not application database fields.
- Added exact origin/CSRF and MFA-age checks, rolling independent account/source throttles, and completion consumption bound to purpose, grant, subject, generation, current identity version and an unrevoked consumed challenge.
- Tested transaction serialization using application-database barriers: a protected transaction finishes before recovery, while a transaction behind committed recovery is denied. Two-identity lock requests use a stable order. These tests supply IdP evidence through a test double and do not establish real MFA enrollment.
- Pinned Express, OpenID Client, Nodemailer and Playwright dependencies for the approved portal/identity/browser work. A complete portal and lifecycle adapter do not yet exist.

Actual verification before this checkpoint:

- `npm run pilot:build`: passed on Node 24.22.2.
- `node --test dist/pilot/tests/pilot/access-storage.test.js dist/pilot/tests/pilot/session.test.js dist/pilot/tests/pilot/throttle.test.js dist/pilot/tests/pilot/completion.test.js`: 5 top-level tests passed against the isolated PostgreSQL fixture; targeted red/green runs preceded implementation.
- `node --test dist/pilot/tests/pilot/fixture.test.js dist/pilot/tests/pilot/storage.test.js dist/pilot/tests/pilot/smtp.test.js`: 5 tests passed earlier in this continuation; no later changes to those implementations.
- Empty migration up/down/up passed before the completion `revoked_at` column was added. That column was subsequently applied additively to the disposable fixture and its immutable-binding tests passed. A fresh full migration drill for the final migration remains required.
- `python scripts/check_repo.py`: passed.
- `python -m unittest discover -s tests`: 101 tests, OK, 32 scanner-discovery skips. This checkpoint did not repeat the configured scanner-specific suite.
- `node --test tests/*.test.cjs`: 20/20 passed.
- `npm ls --depth=0`: all exact installed package versions matched; `git diff --check`: passed before checkpoint documentation.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial).
- Task — [#117, Task 2A customer activation and sessions](https://github.com/Maeximilion/MaexSocial/issues/117).
- Branch — `dev-codex/117-customer-activation`.
- Work head before the handover commit — `a69f6de9dff10b1ee1dddaeeefb78ca91b016734`.
- PR — not opened; implementation incomplete.
- Plan — [Task 2 deliveries](../../superpowers/plans/2026-11-06-task-2-deliveries.md).
- Implemented boundaries — [session authority](../../../apps/web/src/server/session.ts), [completion consumer](../../../apps/web/src/server/identity.ts), [throttles](../../../apps/web/src/server/throttle.ts), [contracts](../../../packages/contracts/pilot.ts), [access migration](../../../db/migrations/002_customer_access.up.sql).
- Local-only evidence — ignored `work/` retains the original stopped fixture, current disposable fixture and private diagnostic scripts. Do not publish tokens, credentials or raw mail. The blocked race scripts must not be rerun, reformulated or delegated.

## Decisions

The coordinator approved one lock order for A and future B/C: complete sorted identity set, sorted tenant set, membership, session, then domain records. Recheck preliminary bindings after locks. Changed sets/generations require denial or a clean retry; do not acquire extra authority locks out of order. A caller owns the transaction through its domain mutation.

Supported Keycloak browser password setup and subsequent customer OIDC succeeded in isolated Chromium with only fixture certificate public-key pins. Code/state/nonce/PKCE and exact subject/verified email were checked. Browser containers had no database/admin credentials or private TLS keys mounted. The customer client was restored disabled after probes.

Native action links do not supply the application's read-only GET and POST-confirmation contract. A native verification confirmation GET changed verified state while retaining a preregistered password. Separate app challenges remain necessary. An older password action link also remained usable after a newer password action, logout and user `notBefore` changes; do not treat those as action-token revocation.

A bounded alternative used separate action clients. A realm-local service account required the built-in `kc-admin-api` scope and Admin API audience in Keycloak 26.8.2, in addition to its roles. After correcting that documented prerequisite, pilot API access succeeded and master access returned 403. `manage-clients` in this experiment was realm-wide, not restricted to individual action clients; no production permission was approved.

Disabling an action client denied an unused old link and a previously opened form submitted after revocation. A new password action and ordinary customer OIDC remained usable with the verified subject/profile unchanged. These sequential controls are established; they do not establish safety for an already executing old request.

The coordinator reported a platform safety block on the proposed live IdP race investigation and explicitly stopped that test route. Do not retry or redirect it. The in-flight probe subsequently exited with a browser-close/unhandled-promise error; it did not establish the required race result. Only cleanup followed: two own probe clients, one invented probe identity and the temporary bootstrap administrator were removed; the customer client was disabled with empty redirects/origins. The browser container was stopped, no runner remained and a read-only check found no remaining owner transaction. The four isolated base services remain running for independent product tests. No other fixture was touched.

## Gate

[G2 and bounded local synthetic implementation](https://github.com/Maeximilion/MaexSocial/issues/15#issuecomment-6681723454) remain accepted. Recovery completion under a competing already authorized IdP request remains unproven and is referred to the coordinator for a safe design decision. Do not freeze that contract, claim authentication completion, or merge this delivery with that gap unresolved. No real users, external runtime traffic, providers, deployment, product spend or G3 acceptance are authorized.

## Open

Continue only independent portal/session/CSRF/current-authority product work. Preserve all established results. The coordinator owns the unresolved recovery design; do not repeat the blocked live race experiment or ask the owner to repeat accepted decisions.

Remaining scope includes executable portal routes and accessible shell, actual lifecycle/completion production, complete browser OIDC and session rotation/tenant-switch/logout checks, real MFA enrollment/step-up evidence, crash/restart tests, fresh final migration drill, full integration checks, and one normal PR with attached artifact and authentic Claude API review. #123/#124 remain later deliveries; do not implement their domain routes here.

- Console — PowerShell.
- Folder/worktree — `C:/Users/Maxi/.codex/worktrees/117-customer-activation/MaexSocial`.
- Full start command — `Set-Location 'C:/Users/Maxi/.codex/worktrees/117-customer-activation/MaexSocial'; git status --short --branch; git fetch origin --prune; Get-Content 'docs/handovers/sessions/2026-11-17-customer-access-checkpoint.md'`.
- First message — Continue #117 from this checkpoint and the authorized coordinator's latest control. Preserve the explicit stop on live IdP credential-race/DB-lock probes. Verify the actual task branch and pinned Node 24.22.2 runtime, then continue independent portal/session/CSRF/authority implementation with targeted red/green checks. Do not claim the recovery contract is complete, spawn review agents, create an additional chat, or merge.

## Lessons

Code Autopilot and Caveman remain enabled in their canonical local skills; Superpowers supplies the existing execution/TDD workflow. SMTP required implicit TLS, not a longer timeout. Pinned Keycloak 26.8.2 added an Admin API audience/scope check; old examples lacking that scope return 401 despite correct role claims. Primary version-specific source and real positive controls resolved the configuration issue without disabling checks. A successful sequential browser demonstration is not evidence of concurrent recovery safety.

Current fixture runtime is disposable and expires after one day. Preserve its private data before any later reset; do not extend expiry silently. Advisory security/Dependabot checks run only on explicit `/start` or `/task` and were not invoked here.
