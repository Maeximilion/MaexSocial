# Private fresh-factor implementation plan

> Execute inline with Superpowers executing-plans. The issue disposition supplies approval; Claude API is the sole PR reviewer.

**Goal:** Private evidence of fresh use of an initially enrolled OTP factor, without application authority.

**Architecture:** Extend the merged OIDC verifier and its single-use attempt store. A dedicated isolated Keycloak flow emits signed ACR `2`; the server binds subject, purpose and fixed policy and checks the original five-minute window after verification.

**Stack:** TypeScript, PostgreSQL, oauth4webapi 3.8.8, pinned Keycloak 26.8.2 and existing Playwright harness.

**Spec:** [Issue #143 and coordinator disposition](https://github.com/Maeximilion/MaexSocial/issues/143). Base: `6b5bb534feefe4d1cea8c058faf98c91076299c0`.

## Constraints

Only new isolated invented-user fixtures. No credential mutations after initialization, other reusable LoA2 flows, inline enrollment, public authentication/session producer, dependencies or migrations. Preserve existing protocol, TLS, transaction and cleanup controls. Recovery generations and current authority remain in #131. No excluded credential/IdP-lock experiment.

## Execution

- [x] Extend `OidcConfig` in `apps/web/src/server/oidc.ts` with optional server-only `stepUp: { expectedSubject, policy }`; the only policy is `keycloak-26.8.2-enrolled-otp-v1`. First write rejection/binding tests in `tests/pilot/oidc-step-up.test.ts`, observe failure, then implement the shared verifier path. Bind purpose/subject/ACR/policy into `config_hash`. Consume timestamps before network and check a new DB clock after verification. Return private issuer/client/subject/policy/ACR/lower-bound/verification/expiry evidence; ordinary output stays issuer/subject.
- [x] Add declarative `ops/local/keycloak-step-up.json`, initial secret/user wiring in `ops/local/stack.ts` and a runner case in `ops/local/portal-browser.ts`. Required OTP at LoA2/max-age0; CONFIGURE_TOTP disabled. Assert fixture invariant against real imported flow/client configuration. No other flow may assign reusable LoA2.
- [x] Add `tests/pilot/oidc-step-up-browser.test.ts`: enrolled positive, immediate repeated SSO with new OTP challenge (no prompt=login), password-only denial without setup, unchanged session count and closed product routes. Use actual OTP policy. If this fails semantically, stop candidate and report evidence to coordinator.
- [x] Cover signed missing/low/non-string ACR, subject/client/policy/browser mismatch, bad signature, cancellation, expiry before/after locks and during verification, replay, concurrency and original validity bounds. Run strict build, targeted tests, migration up/down/up and full pilot/foundation checks with installed Gitleaks. Keep actual commands/results in handover.
- [ ] Bundle README/status/work-package/handover, commit/push and create one normal PR with Closes #143. Attach it to this chat. Freeze after genuine complete Claude review and current integration-candidate CI; Root owns merge and recovery/archive decisions.

## Review focus and evidence ledger

Tests must catch config mutation across pending attempts, ordinary-to-step-up confusion, ACR accepted before signature, verification completing after expiry and SSO reuse without OTP. No token or credential goes into the receipt or public evidence.

- Initial state: merged baseline inspected; no product changes or tests yet. Model Astra/high, no Fast override. Source-based design accepted; runtime proof pending.

- Local evidence: strict build; protocol 9/9; real browser positive, repeated SSO and unenrolled/LoA1 negatives; full pilot 21/21; Python 122 with one Windows-inapplicable skip; Node foundation 20/20. Final retained-volume restart passed 21/21 on the current compiled source. No review or PR yet; publication waits for actual #144 merge and current-main integration.

