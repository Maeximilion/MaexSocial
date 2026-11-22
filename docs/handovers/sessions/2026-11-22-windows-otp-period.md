# Handover 2026-11-22 — #222 Windows OTP period

## Status

Both owned synthetic fixtures were stopped by 2026-11-22T01:31:45Z with their volumes retained. A fresh Windows run reproduced the high-ACR SSO failure with the diagnostic revision. The corrected OTP browser suite passed on a fresh fixture and after restart. The corrected full retained pilot recorded a separate failure whose test name the output filter did not retain.

Implementation was performed in the local Codex chat using Sol 6.2, high. Claude Messages API review and hosted CI are pending publication.

## Artifacts

- Repository and task — [Maeximilion/MaexSocial #222](https://github.com/Maeximilion/MaexSocial/issues/222). Branch `dev-codex/222-windows-otp-pilot`.
- Work head before this handover commit — `b23284e2a5b4c7fe978ddf2708c4b27b86b1b2b4`. PR pending the coordinator's release signal after [PR #227](https://github.com/Maeximilion/MaexSocial/pull/227).
- [Browser suite](../../../tests/pilot/oidc-step-up-browser.test.ts) and [prior Windows evidence](2026-11-22-windows-pilot.md).

| Tested SHA | Fresh Windows fixture | After restart with the same three volumes |
| --- | --- | --- |
| `7c2d85a58624e5621081a1ea56f133cd8332c4f5` (diagnostics, original wait) | Pilot exit 1. The second OTP challenge was visible. Its POST returned 200 and showed the challenge again with no callback. The TOTP period had advanced by zero, with generation 28,839 ms into the period. | Pilot exit 0. |
| `b23284e2a5b4c7fe978ddf2708c4b27b86b1b2b4` (corrected wait) | Pilot 38/38. OTP browser suite 1/1. Both OTP submissions needed a second clock check. | Pilot 37/38. OTP browser suite 1/1. Both OTP submissions needed a second clock check. The test name of the remaining failure was not captured. |

Windows Node 24.22.2, npm 11.19.1, Docker Engine 29.9.3 and Compose 5.7.1 used the cached pinned images. Offline dependency installation, the strict pilot build, fixture readiness, the migration up/down/up drill and the empty migration test passed. The repository checker and diff whitespace check passed. Python discovery with configured Gitleaks ran 129 tests with one Windows-inapplicable skip. Node foundation passed 20/20.

## Decisions

Completing the timer did not establish that the fixture wall clock had reached the next 30-second period. The second submission used the same period and fixture seed as the first, so the test generated the same code again. The [pinned Keycloak verifier](https://github.com/keycloak/keycloak/blob/26.8.2/services/src/main/java/org/keycloak/credential/OTPCredentialProvider.java#L101-L112) enforces single use for a valid TOTP. The failing diagnostic phase emitted `LOGIN_ERROR / invalid_user_credentials` at 01:21:28 UTC. That class also occurred in the passing diagnostic retained phase and both passing corrected OTP phases, so the class alone cannot identify the cause.

The test now rechecks the wall clock until the next period is observed, with a monotonic wait budget. It submits once per challenge and logs only fixed stages, HTTP statuses, challenge presence and relative timing. The initial OTP, high-ACR SSO fresh OTP, unenrolled denial, first-factor-only denial and application-authority assertions still run. The clock evidence explains the observed repetition in the test. The reason the fixture clocks diverged was outside the investigation.

## Gate

Use the OTP-specific evidence for [#10](https://github.com/Maeximilion/MaexSocial/issues/10) and [G3 / #16](https://github.com/Maeximilion/MaexSocial/issues/16). Record the separate retained pilot failure as unclassified. Product identity and real operating evidence remain with their existing gates.

## Open

Wait for the coordinator's merge signal, verify the new main base and publish the single issue PR. Verify the authentic Claude API review and current-head CI before handing off for serial merge.

- Console — Windows PowerShell.
- Worktree — `$env:USERPROFILE\.codex\worktrees\issue-222-windows-otp-pilot\MaexSocial`.
- Start — `Set-Location (Join-Path $env:USERPROFILE '.codex/worktrees/issue-222-windows-otp-pilot/MaexSocial'); git status --short --branch; git rev-parse HEAD`.
- First message — Resume #222 from this evidence and reconcile current main and publication authority with the coordinator.

## Lessons

The ordinary Windows test exercised the corrected clock check in both phases. Future captures should retain static failure labels from the outer Node spec reporter alongside sanitized stage details. Code Autopilot, Caveman and Ponytail were used for the bounded test correction.
