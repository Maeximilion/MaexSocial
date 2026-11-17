# Handover 2026-11-17 — #147

## Status

Prepublication checkpoint (UTC) — 2026-11-17T19:00:58Z. Implementation, targeted real HTTPS/PostgreSQL/Keycloak browser acceptance, full-suite validation and retained-volume restart are complete. This record is completed before the first PR. Hosted review/CI, merge and final archive recovery remain pending; no merge or archive has occurred.

Implementation/review — Codex implementation, then the existing Claude Messages API workflow. Session metadata confirms `gpt-6-astra`, reasoning `high`, `service_tier: null`; no Fast setting or model switch is claimed. Claude API execution and head/base coverage are pending publication, not inferred from local tests. Its configured Opus 5.5/high/standard policy remains unchanged.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial).
- Task — bounded Task 2A2 component [#147](https://github.com/Maeximilion/MaexSocial/issues/147), [admission and accepted contract](https://github.com/Maeximilion/MaexSocial/issues/147#issuecomment-6957436382).
- Branch — `dev-codex/147-private-logout`.
- Work head before the handover commit — `faeeb1195924277a51b5056c5ed72bc053814f1d` (implementation on merged main `006843217f775a6bdb26b41687f0b6ec90e90eed`). Full and restart suites ran on `34c887bdb45603adb44037f4c9a37b3d4cb36f13`; the only later source change strengthens the default portal test's local redirect, cookie-count and CSP assertions. Strict build and the targeted portal/logout tests passed again on that final tree. The next commit adds only documentation.
- PR — not yet opened; publish one normal PR after completing this record. Later current-head CI/API receipts belong in PR comments and private recovery, without documentation-only review churn.
- Source — [customer app](../../../apps/web/src/server/customer.ts), [fixture](../../../ops/local/stack.ts), [focused HTTPS tests](../../../tests/pilot/logout.test.ts), [real browser test](../../../tests/pilot/oidc-browser.test.ts), [contract and commands](../../../ops/local/README.md#private-confirmed-browser-logout-147).

All local JavaScript checks use the copied standalone Node 24.22.2/npm 11.19.1 runtime and unchanged lockfile. Docker Engine 29.9.2 runs the repository-pinned images. A baseline fixture was stopped and preserved before initializing the new exact logout-return allowlist; neither existing volumes nor credentials were upgraded.

| Executed command | Observed result |
| --- | --- |
| `npm ci` | 96 packages installed, lockfile unchanged |
| `npm run pilot:build` | Strict TypeScript passed |
| `npm run pilot:up`, `npm run pilot:migrate -- up` | Fresh isolated fixture and existing migrations passed |
| `node --test dist/pilot/tests/pilot/logout.test.js dist/pilot/tests/pilot/portal.test.js` | 3/3 passed, including the local-only regression |
| `node --test dist/pilot/tests/pilot/oidc-browser.test.js` | Actual private Keycloak browser acceptance passed |
| `node --test dist/pilot/tests/pilot/oidc-step-up.test.js` | 9/9 inner checks passed after the approved fixture correction, including exact five-minute lifetime |
| `npm run pilot:test` | Initial run: 22/23 passed; existing step-up expiry-test fixture exceeded its five-minute constraint by one microsecond. Corrected full run: 23/23 passed |
| `npm run pilot:down`, `npm run pilot:up`, `npm run pilot:test` | Retained-volume restart passed, 23/23 tests |
| `python scripts/check_repo.py`, `git diff --check` | Passed with documentation; repeated after final handover completion |
| `python -m unittest discover -s tests` | 122 tests, OK with one Windows-inapplicable filename test skipped; installed Gitleaks supplied through `MAEXSOCIAL_TEST_GITLEAKS` |
| `node --test tests/*.test.cjs` | 20/20 passed |

Both implementation commits passed the installed Git pre-commit secret guard. Pre-push guard and hosted current-candidate checks remain publication steps. No database migration changed, so no destructive rollback drill on populated fixtures was run.

## Decisions

Reuse the exact current POST, form/Origin/CSRF guards, transaction and identity/session locks. Private composition validates only the fixed issuer/client/root return and captures an immutable redirect string before serving requests. There is no extra module, migration, dependency, session producer, ID token retention, remote backend logout or provider privilege. A failed commit returns no cookie deletion or redirect. A successful commit deletes both host cookies before the response redirects. Only private mode extends the form CSP with the exact provider logout endpoint.

The browser test retains #139's signature/issuer/subject and wrong-browser/replay controls. Fresh silent authorizations use the existing durable state/nonce/PKCE verifier. It separately seeds three synthetic AppDB sessions for abandoned confirmation, controlled connection failure and confirmed logout. Replayed cookies fail before confirmation and afterwards. Leaving the actual confirmation without confirming preserves provider SSO; only explicit confirmation is followed by a fresh `login_required` response. The fixed root return, including forged query fields, never grants authority or claims provider success.

The Keycloak 26.8.2 confirmation template has no Cancel control; Root accepted navigating away as the cancellation case. The controlled unavailable-provider test uses a real browser POST with manual redirect from a test-only same-origin page, then aborts the subsequent initial provider navigation. It does not claim a real provider outage. The test-only page permits same-origin fetch; the product's connect policy is unchanged. Actual certificate pins and HTTPS validation remain enabled.

## Gate

This is only the bounded component authorized by #147 on merged #146. The [accepted local G2 scope](https://github.com/Maeximilion/MaexSocial/issues/15#issuecomment-6681723454) is unchanged. Parent #131 retains production subject/session binding, recovery completion, current MFA/lifecycle generation and admission. Synthetic AppDB authority and real browser SSO are intentionally separate. This is not global provider revocation, real-account operation, deployment or G3/G5 acceptance. The excluded live credential/provider-lock experiment was not run. #137 did not recur and remains open.

## Open

Publish the single normal `Closes #147` PR and attach it. Verify actual complete Claude API execution/current head/base and all candidate CI; Root owns serial merge and archival. Preserve full source/Git/ignored/runtime recovery after the final fetch/fix, verify restore, and send its private paths to Root. No archive routine runs in this work chat.

- Console — PowerShell.
- Folder/worktree — `$env:USERPROFILE/.codex/worktrees/147-private-logout/MaexSocial`.
- Full start command — `Set-Location (Join-Path $env:USERPROFILE '.codex/worktrees/147-private-logout/MaexSocial'); $env:PATH=(Join-Path $PWD 'work/runtime/node-v24.22.2-win-x64')+';'+$env:PATH; git status --short; node --version; npm run pilot:build`.
- First message — Continue only #147 and its first delivery PR from this handover; reconcile current Root control, actual Git/CI/API state and private execution ledger before doing the next outstanding step. Keep canonical main clean and preserve other work.

## Lessons

The configuration test first failed because the old app ignored a third argument; the redirect test then failed on the old local `/` destination. Both became green after the minimal implementation. The first actual browser run exposed the form CSP redirect restriction; a sanitized diagnostic recorded one violation. Adding only the fixed private endpoint resolved it. Playwright routing does not intercept redirected requests, and a direct fetch on the product page was correctly blocked by its CSP; the final failure test uses the existing test harness instead of weakening product connect policy. The full-suite expiry fixture failure was unrelated to logout: Root authorized replacing its one exact-boundary pair of `clock_timestamp()` calls with `statement_timestamp()` and asserting the SQL interval is exactly five minutes. A search found ordinary OIDC tests already use that stable construction. Two other step-up timing fixtures retain 750–800 ms lifetime margin and are unchanged. No schema, product clock, verifier or lock policy changed.

Code Autopilot and Caveman remain enabled through their canonical copies. The accepted plan is executed inline with relevant Superpowers/TDD guidance and Ponytail's minimal-change rules; repository Claude API policy replaces a separate Codex review. Advisory security/quality checks run only on explicit `/start` or `/task`; neither was invoked. The owner's remaining-quota intake stop does not pause this already authorized delivery.
