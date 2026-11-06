# Handover 2026-11-06 — MS-009 Task 2A / #117

## Status

Stopped at (UTC) — 2026-11-06T11:23:22Z (runtime stopped; documentation checkpoint follows before the owner deadline).

Task 2 was decomposed after inspecting the actual merged schema/fixtures. Root accepted the split: #117 activation/session foundation, #123 Employee membership, #124 drafts/approval. The [concrete plan](../../superpowers/plans/2026-11-06-task-2-deliveries.md) is committed and pushed. Root [authorized its prerequisite and bounded implementation](https://github.com/Maeximilion/MaexSocial/issues/117#issuecomment-6683587745). Product routes, session logic and activation completion are not implemented. No delivery PR exists.

An independent disposable Task 1 stack was started in this worktree. Node 24.22.2/npm 11.19.1, `npm ci`, strict `npm run pilot:build`, `npm run pilot:up` and verified TLS readiness for Keycloak/Mailpit succeeded. The actual local identity probe could authenticate a temporary admin client, enable the customer client and create a synthetic unverified user. The email-action prerequisite failed with a request timeout; Keycloak diagnostics included `Failed to send email`, `MessagingException` and `SocketTimeoutException`. This is not an observed successful activation or a completed GET-redemption test.

Probe cleanup reported deletion of its synthetic user and temporary administrator, and restoration of the disabled customer client. `pilot:down` stopped only this worktree's namespace; the subsequent Compose query reported zero remaining own containers. Volumes and ignored fixture evidence are retained. No active worker, reviewer, application process or shell session remains after the completed checks. No other worktree or fixture was stopped.

Implementation/review — Codex → Claude review. Actual implementation session settings were verified as `gpt-6-astra`, reasoning `high`, service tier unset (no Fast override). No independent reviewer or hosted/Claude review was started; a fresh actual Astra/high reviewer is still required before the eventual product PR.

Checks actually run on the plan checkpoint:

- `python scripts/check_repo.py`: passed.
- `python -m unittest discover -s tests`: 96 tests, OK with 32 scanner-discovery skips.
- With `MAEXSOCIAL_TEST_GITLEAKS` set to the configured local scanner, `python -m unittest discover -s tests -p test_secret_hooks.py`: 32 tests, OK with one Windows filename-platform skip.
- `node --test tests/*.test.cjs`: 20/20 passed (host Node 26.13.0; foundation only).
- `git diff --check`: passed.
- Pinned Node/npm dependency install, strict pilot build and actual fixture TLS readiness: passed.
- Actual isolated email/identity lifecycle probe: failed with timeout; one earlier retry also ran before Keycloak readiness and failed with connection refused. Explicit readiness was restored before the final probe. No GET mutation or credential-cleanup positive control was reached by that probe.
- Portal, atomic activation, crash/retry, CSRF, MFA, reset/removal/switch races, browser keyboard flow and full pilot acceptance: not run; implementation absent.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial).
- Task ID and issue — [MS-009 Task 2A / #117](https://github.com/Maeximilion/MaexSocial/issues/117), parent [#10](https://github.com/Maeximilion/MaexSocial/issues/10).
- Branch — `dev-codex/117-customer-activation`.
- Work head before the handover commit — `cb6454ac90a285363104f049e6626da3d3736756`.
- PR — not opened; next PR must be the one complete #117 product delivery, after #121 merges and the local checks/review pass. Do not create a documentation-only PR for this checkpoint.
- Basis — Task 1 merged at `44209c9e5685d8cc6c6e740b3e0c1ac5fc6a7530` in [#118](https://github.com/Maeximilion/MaexSocial/pull/118).
- Local-only investigation — `work/bootstrap-identity-probe.cjs`, `work/identity-probe.cjs`, generated `work/pilot/` fixture and retained Docker volumes. These files include temporary fixture data and are intentionally not committed. Do not publish raw mailbox messages, token links, credentials or service logs.

## Decisions

The fixed delivery boundaries and proposed interfaces are in the plan. #117 does not implement Employee or content routes. #123/#124 remain blocked until the actual A identity/MFA/transaction contract is implemented, tested and merged. Task 3 still depends on all three deliveries. No dynamic router/plugin abstraction, additional business-facts authority or customer promotion endpoint is authorized.

Keycloak and app PostgreSQL do not share a transaction. The planned one-use identity completion must fail closed across cleanup/credential/verification crashes, bind identity/email/purpose and originating challenge/invitation, and be consumed in the same app transaction as the workspace/membership mutation. The proposed lock order is tenant -> identity -> membership -> session -> domain, with stable row ordering and revalidation. This is an implementation contract to test, not an already proven algorithm.

Pinned upstream 26.8.2 evidence establishes why native defaults cannot simply be treated as accepted behavior:

- [Registration documentation](https://github.com/keycloak/keycloak/blob/26.8.2/docs/documentation/server_admin/topics/users/con-user-registration.adoc) describes default password setup after email verification. This reduces new-registration exposure but does not prove cleanup of pre-existing unverified credentials/factors.
- [VerifyEmailActionTokenHandler](https://github.com/keycloak/keycloak/blob/26.8.2/services/src/main/java/org/keycloak/authentication/actiontoken/verifyemail/VerifyEmailActionTokenHandler.java) and [ExecuteActionsActionTokenHandler](https://github.com/keycloak/keycloak/blob/26.8.2/services/src/main/java/org/keycloak/authentication/actiontoken/execactions/ExecuteActionsActionTokenHandler.java) contain a confirmation path that sets verified-email state. Source inspection suggests the GET-read-only contract needs explicit integration controls. The attempted runtime probe did not reach that behavior, so it is not yet reproduced.
- [Keycloak's administration guide](https://www.keycloak.org/docs/latest/server_admin/#_application_initiated_actions) warns that requesting an MFA setup action does not prove the user completed enrollment. Actual trusted enrollment and fresh proof must be checked.

## Gate

[G2 and local synthetic implementation are accepted](https://github.com/Maeximilion/MaexSocial/issues/15#issuecomment-6681723454). G3 and #10/#82/#88/#99 remain open. No live account/provider use, external runtime egress/mail, deployment, product spend or customer operation occurred or is authorized. Root owns merges, supplemental bot triggers and archival. The larger product PR must wait for the smaller #121 delivery to merge.

The owner deadline is 2026-11-06 11:30 UTC / 12:30 Europe/Berlin. After that time, wait for explicit owner resume before further edits, pushes, PRs or runtime work. The runtime was stopped ahead of the cutoff; root receives the final pushed checkpoint separately.

## Open

After explicit resume, reconcile root's current instructions and the real branch state. First diagnose the local Keycloak-to-Mailpit SMTP timeout with sanitized evidence, then rerun the actual identity-lifecycle prerequisite. Preserve the original isolation and TLS controls; do not bypass SMTP verification or replace actual activation evidence with mocks. Prove GET-read-only and interrupted cleanup/retry before implementing/finalizing the shared completion contract. Then continue #117's test-first implementation and only later open its one complete product PR.

- Console — PowerShell.
- Folder/worktree — `C:/Users/Maxi/.codex/worktrees/117-customer-activation/MaexSocial`.
- Full start command — `Set-Location 'C:/Users/Maxi/.codex/worktrees/117-customer-activation/MaexSocial'; codex`.
- First message — `Continue #117 from docs/handovers/sessions/2026-11-06-customer-activation-prerequisite.md only after confirmed owner resume. Read current coordinator control, issue #117 and the Task 2 delivery plan. Preserve #123/#124 and #121 ownership. Diagnose the actual isolated SMTP timeout, prove Keycloak activation/cleanup and crash behavior, then implement only Task 2A with real tests. Do not merge or create a second PR.`

## Lessons

Host Node 26/npm 12 is outside the pinned pilot range. The completed runtime checks used the existing Node 24.22.2/npm 11.19.1 distribution read-only from the preserved Task 1 worktree; obtain an independent verified copy if that worktree moves. Task 1's storage users are not authenticated IdP fixtures. Keycloak restarts need explicit readiness before probing. A source-level dangerous path and a timed-out runtime experiment must remain separate claims.

Code Autopilot and Caveman remain enabled from their canonical local skills; Superpowers planning/execution/TDD applies to this task without duplicate loops. No `/start` or `/task` advisory check was invoked. Model-routing pauses, actual secret guards, required CI and product gates remain separate controls.
