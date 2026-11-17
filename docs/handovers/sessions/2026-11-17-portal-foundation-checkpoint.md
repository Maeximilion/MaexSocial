# Handover 2026-11-17 — MS-009 Task 2A / #117 portal checkpoint

## Status

Stopped at (UTC) — 2026-11-17T14:41:32Z, at the coordinator's requested decision checkpoint. The original delivery scope remains in force pending disposition; no smaller delivery has been declared complete.

Since the [earlier access checkpoint](2026-11-17-customer-access-checkpoint.md), the local HTTPS customer dashboard, guarded tenant switch, opaque local logout and isolated keyboard-browser harness were implemented. Tenant switching rotates session and CSRF values without extending absolute expiry. Session resolution now binds the tenant version, preventing suspension/reactivation from reviving a stale session. Tests preserve an independently authorized other-tenant session after membership revocation.

Implementation/review — Codex, previously verified `gpt-6-astra` / `high` without Fast override; Claude API is the future PR reviewer under current repository policy. No review or PR exists for this delivery.

On the work head below, `npm run pilot:build` and `npm run pilot:test` passed: **14/14 tests**, including real isolated Chromium navigation of the dashboard, app/database TLS, storage controls, current authority, completion consumer, throttles and rotation. The browser test seeds only synthetic application-database sessions and supplies an explicit IdP-status test double. It checks that every browser request stays on `customer`; it performs no Keycloak or credential operations. A screenshot at ignored `work/portal-preview/dashboard.png` was visually inspected. Browser and runner containers were automatically removed; only the four own fixture base services remain running. Repository and diff checks passed. The earlier checkpoint records foundation test results and their scanner skips.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial).
- Task — [#117, customer activation/session foundation](https://github.com/Maeximilion/MaexSocial/issues/117).
- Branch — `dev-codex/117-customer-activation`.
- Work head before the handover commit — `77e5a1c0d51e176a8787b89e0b65f2d46370678b`, verified equal to the remote and clean before this record.
- PR — not opened; scope and auth evidence remain incomplete.
- Product — [customer HTTP boundary](../../../apps/web/src/server/customer.ts), [session authority and rotation](../../../apps/web/src/server/session.ts), [portal rendering](../../../apps/web/src/routes/portal.ts).
- Tests — [HTTP portal](../../../tests/pilot/portal.test.ts), [keyboard browser](../../../tests/pilot/portal-keyboard.test.ts), [session rotation](../../../tests/pilot/session-rotation.test.ts), [isolated browser harness](../../../ops/local/portal-browser.ts).

## Decisions

The coordinator requested a technical proposal, not implementation of a revised delivery boundary. The proposal distinguishes a possible fixture-only session/tenant/CSRF/portal foundation from the unproven real authentication lifecycle. Root must explicitly dispose of that split before scope changes or a PR. No additional issue, chat or reviewer was created here.

The local identity-first lock order and current-version authority rules are established candidates for downstream reuse. `InspectIdentity` remains a server-only adapter contract tested with a double; real generation and MFA provenance remain unproven. Completion issuance, operation phases and recovery fencing can still change the identity/completion schema. Do not freeze those parts for #123. The current request/cookie helpers are private to `createCustomerApp`; downstream routers cannot assume a finished public middleware contract.

The blocked live IdP credential-race investigation remains stopped. Its incomplete result was not reused as proof or retried. Preserve the cleanup, permission limits and unresolved recovery finding in the earlier checkpoint. Real signup/login/activation/recovery routes are not implemented; the local Keycloak customer and desktop clients remain disabled. No public fixture-token or promotion endpoint was added. Dashboard tests are not an authenticated signup journey or a real MFA test.

## Gate

The [accepted local scope](https://github.com/Maeximilion/MaexSocial/issues/15#issuecomment-6681723454) is unchanged. G3/G5 and real operation retain their existing blockers in #10/#82/#88/#99. No merge, production permission or relaxed recovery criterion follows from the local test results. Await the authorized coordinator's delivery-boundary decision.

## Open

Read the coordinator's next disposition first. If a smaller fixture-only foundation is authorized, update its issue/plan and stable consumer contract explicitly before delivery; do not silently close the original authentication scope. Remaining validation includes a fresh final migration up/down/up drill (the current fixture received additive development changes), explicit switch/removal interleavings, final CI and actual same-head/base Claude API review. Actual login/lifecycle/MFA/recovery work stays open and must retain its acceptance criteria.

- Console — PowerShell.
- Folder/worktree — `C:/Users/Maxi/.codex/worktrees/117-customer-activation/MaexSocial`.
- Full start command — `Set-Location 'C:/Users/Maxi/.codex/worktrees/117-customer-activation/MaexSocial'; git status --short --branch; git fetch origin --prune; Get-Content 'docs/handovers/sessions/2026-11-17-portal-foundation-checkpoint.md'`.
- First message — Continue #117 only after reconciling the authorized coordinator's latest disposition with this checkpoint. Preserve the blocked IdP-race-test stop and the original delivery boundary unless Root has explicitly changed it. The 14-test local suite is green on the recorded head but does not complete real authentication. Keep the pinned Node 24.22.2 runtime, independent worktree and Claude API review policy; do not merge.

## Lessons

Real keyboard submission found a defect absent from direct HTTP tests: `Referrer-Policy: no-referrer` produced `Origin: null` for the HTML form POST. `same-origin` fixes the legitimate form while retaining the exact-origin/CSRF denial. The [browser documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Referrer-Policy) explains that interaction. A short dedicated Docker network alias avoids the DNS label limit; the browser harness closes database/browser resources on failure. No IdP privileges or credential access were needed for these tests. Canonical Code Autopilot and Caveman remain enabled.
