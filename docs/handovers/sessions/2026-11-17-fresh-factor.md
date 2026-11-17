# Private fresh-factor checkpoint (#143)

## Contract and delivered behavior

[Coordinator disposition](https://github.com/Maeximilion/MaexSocial/issues/143#issuecomment-6956386079) accepts the bounded local contract after [PR #142](https://github.com/Maeximilion/MaexSocial/pull/142) merged as `6b5bb534feefe4d1cea8c058faf98c91076299c0`. The [implementation plan](../../superpowers/plans/2026-11-17-fresh-factor.md) and [fixture/verifier contract](../../../ops/local/README.md#private-enrolled-factor-evidence-143) specify the source-backed restrictions.

The existing private verifier now binds sign-in versus step-up, expected subject, exact ACR and fixed policy into its durable attempt hash. It retains mandatory oauth4webapi 3.8.8 signature/claim checks, short independent transactions, committed one-use consumption before network, strict endpoint/TLS/response limits and operation-driven cleanup. No migration or dependency was added.

An initially enrolled invented OTP user can produce only a private event receipt. Another attempt after high-ACR SSO visibly requires another OTP execution without `prompt=login` or password reauthentication. An unenrolled user receives `Cannot login, credential setup required.` with no setup form or factor creation. A browser request altered to LoA1 completes first-factor authentication but the private callback rejects its signed low ACR. No application session or public authentication route is created.

The test verifies actual imported Keycloak flow requirements, two LoA configurations, disabled CONFIGURE_TOTP, dedicated client binding and absence of enabled client policies/extra profiles. It reads only necessary configuration and factor counts over validated TLS with a fixture-owner read-only connection; the application receives no identity-database access. Initial passwords and the OTP seed are generated once in a new isolated fixture. Existing credentials/volumes are preserved.

The private receipt has an original-attempt lower time bound and original expiry. A new PostgreSQL clock check happens after signature/identity/ACR verification. A consumed attempt that expires during verification cannot produce evidence. AMR, `auth_time`, `iat`, callback time or enrollment alone never supplies freshness.

## Executed checks

All local commands use Node 24.22.2 and the repository lockfile. The standalone runtime archive matched the official SHA-256 manifest. Git-configured Gitleaks 8.30.1 was supplied through `MAEXSOCIAL_TEST_GITLEAKS` for Python tests.

| Command | Observed result |
| --- | --- |
| `npm ci` | 96 packages installed; lockfile unchanged |
| `npm run pilot:build` | Passed strict TypeScript |
| `node --test dist/pilot/tests/pilot/oidc-step-up.test.js` | 9/9 inner checks passed; controlled HTTPS and real PostgreSQL, not provider evidence |
| `node --test dist/pilot/tests/pilot/oidc-step-up-browser.test.js` | Actual isolated Keycloak 26.8.2 browser acceptance passed |
| `npm run pilot:migrate -- up`, then `-- down`, then `-- up` | Passed on the empty application fixture after test-attempt cleanup |
| `node --test dist/pilot/tests/pilot/migration-empty.js` | Passed; unknown populated view prevents teardown |
| `npm run pilot:test` | 21/21 passed, including ordinary OIDC, session/portal and text-editor regression |
| `npm run pilot:down`, `npm run pilot:up`, `npm run pilot:test` | Passed on the final compiled source; retained-volume full suite 21/21 |
| `python scripts/check_repo.py` | Passed again with the completed handover and all documentation |
| `python -m unittest discover -s tests` | 122 tests: 121 passed, one Windows-inapplicable colon-filename test skipped |
| `node --test tests/*.test.cjs` | 20/20 passed |

Meaningful negative checks include unknown policy, missing/low/non-string ACR, issuer/audience/authorized-party/subject/nonce/signature failure, wrong browser and mode, mutated caller configuration, cancellation, replay, stale and post-lock expiry, expiry during JWKS/signature work and six concurrent callbacks yielding exactly one exchange/receipt. The initial policy test failed against the predecessor because step-up configuration was ignored, then passed with the implementation.

Diagnosed intermediate failures: exact-optional-property TypeScript rejected a test's `stepUp: undefined`; removing that property fixed the test configuration. The failed build emitted nothing, and a subsequent command launched the previous baseline fixture; it was stopped and preserved, then a distinct fresh fixture initialized from the successful build. The first browser assertions expected a different rejection message; captured private evidence showed the provider's explicit setup-required denial, and the assertion was corrected without changing authentication policy. A migration-down attempt correctly rejected pending browser-test attempts. Browser teardown now cancels its own attempts through the verifier. A protocol assertion counted unrelated pending attempts; it now checks the consumed state specifically. No protection was weakened or credential changed.

## Remaining boundary and next action

The publication hold ended after #144 / PR #145 actually merged at `173626c0741ad4e6f9d4808a700e01a979395798`. Main was merged normally into this task branch, preserving migration004, content/keyboard coverage and both status entries. A newly initialized isolated fixture preserves all earlier namespaces and volumes; the integrated migration up/down/up and full pilot checks are recorded below. Publish one normal PR with `Closes #143` and attach it to its originating chat. Actual Claude API execution/complete final-head/base coverage, hosted CI and final source/Git/ignored recovery are not yet performed. Root alone merges and archives. Record later CI/review/merge identifiers in PR/issue comments and private recovery after review freeze.

This is restricted to the new controlled fixture: no other flow may store or assign reusable LoA2. Max age zero alone cannot exclude Keycloak's same-second cached-level behavior in an arbitrary realm. The actual repeated-SSO challenge and configuration invariant are both required. Later consumers still need current enrollment/recovery-generation checks and an A1-compatible proof representation; the receipt is neither action authority nor lifecycle completion. Cleanup during inactivity and all remaining #131/#123/#124, integrated Task 2, G3/G5 and #137 obligations stay open. No excluded credential/IdP-lock test, real account, external runtime provider, deployment or gate acceptance occurred.

Own fixture containers/volumes and ignored artifacts remain private and recoverable. The initially preserved baseline fixture is stopped; the step-up fixture uses a different namespace. No volume export, final archive snapshot or archival is claimed. Continue from the assigned branch reported by `git worktree list` for `dev-codex/143-fresh-factor`; use its private `work/runtime/node-v24.22.2-win-x64` runtime and the documented fixture commands. Do not reuse expired credentials or delete another task's material.

## Integrated delivery validation

The full branch includes #144 without modifying its code or migration. Strict build passed. Fresh migration004 up/down/up and the empty-fixture guard passed; the full common pilot suite passed 21/21 on integrated code `a7fb0bae8c5dddcd31c3767dae5802b71bcae8b0`, including #144 creation/migration and #143 factor evidence. Final documentation-only validation then passed `python scripts/check_repo.py` and `git diff --check`. Foundation Python/Node results above cover pre-integration `1738d8ece462b811658c465b7aae842019aa3aa1`; their source scripts/tests were unchanged by the integration. Required hosted foundation and pilot checks must still cover the exact eventual PR candidate. Actual run/receipt links will be recorded in comments after publication.
