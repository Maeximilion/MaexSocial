# Handover 2026-11-22 — #205 Windows pilot

## Status

Local fixture stopped at 2026-11-22T00:32:17Z. The ordinary synthetic pilot on Windows passed **35/36** outer tests with a fresh fixture and **36/36** after a retained-volume restart. The full fresh run returned exit 1. The single failing case was the Keycloak step-up browser suite. The two other reported symptoms did not recur.

Windows Node 24.22.2, npm 11.19.1, Docker Engine 29.9.3 and Compose 5.7.1 used the existing pinned images. `npm ci --offline --no-audit --no-fund`, `npm run pilot:build`, `npm run pilot:up`, the `npm run pilot:migrate -- up` / `down` / `up` drill and `node --test dist/pilot/tests/pilot/migration-empty.js` passed. After the first `npm run pilot:test`, `npm run pilot:down` and `npm run pilot:up` preserved the same three Docker volumes. The second `npm run pilot:test` and final `npm run pilot:down` completed successfully. The fixture used internal networks without host ports.

Codex (Sol 6.2, high) prepared this evidence. The configured Claude API reviewer is Opus 5.5, high, standard. The delivery PR's review and CI were pending when this record was written.

## Artifacts

- Repository and task — [Maeximilion/MaexSocial #205](https://github.com/Maeximilion/MaexSocial/issues/205).
- Branch — `dev-codex/205-windows-pilot`. Work head before this handover commit and exact local test revision — `bfce4840343ec917a3a222e0b318e1010e6b40e6`. PR pending at this checkpoint.
- Local history — [PR #203](https://github.com/Maeximilion/MaexSocial/pull/203) at `66b77786781e9dfed72955512ce941837aeab4f8` and [PR #204](https://github.com/Maeximilion/MaexSocial/pull/204) at `bbd772777147415ee7b91f3bfd52e383c3ac7f93`. All three test files were byte-identical across these revisions and the new local baseline.

The hosted Linux logs show a pass for each of the three cases in both phases of every run. The PR #204 candidate added four [video replay cases](../../../tests/pilot/video-replay.test.ts), which account for the increase from 32 to 36 outer tests. Revisions below are the actual Actions checkouts.

| Hosted pilot | Tested revision | Fresh | Retained |
| --- | --- | --- | --- |
| [PR #203](https://github.com/Maeximilion/MaexSocial/actions/runs/44962854235) | `a78f01e78e14a147f3e97e64409c2938f08eb10e` | 32/32 | 32/32 |
| [PR #204](https://github.com/Maeximilion/MaexSocial/actions/runs/44964094195) | `6759f1e26ec23d9a6666110ed03d8ea210864199` | 36/36 | 36/36 |
| [PR #206](https://github.com/Maeximilion/MaexSocial/actions/runs/44964848638) | `b151d0678f4a1a50766a131d91d59a4de94f0ffe` | 36/36 | 36/36 |
| [Main](https://github.com/Maeximilion/MaexSocial/actions/runs/44965500557) | `bfce4840343ec917a3a222e0b318e1010e6b40e6` | 36/36 | 36/36 |

## Decisions

| Case | Windows evidence and disposition |
| --- | --- |
| [PostgreSQL shared-source throttle](../../../tests/pilot/auth-throttle.test.ts) | PR #203 reported `Throttle unavailable` in the 36-request shared-source case. Its focused Windows restart and all hosted controls passed. The unchanged case completed on both new Windows phases and verified 30 allowed attempts and all 36 account buckets. Close this observation as unreproduced in the ordinary rerun. Its original cause is unknown. |
| [Draft editing HTTP 403](../../../tests/pilot/drafts.test.ts) | PR #204 observed 403 where the suite expected 409 or 200. Its focused Windows restart passed. The unchanged draft suite and both-editor conflict case passed in both new Windows phases and the hosted controls. Close this observation as unreproduced in the ordinary rerun. The original denial path is unknown. |
| [High-ACR SSO OTP](../../../tests/pilot/oidc-step-up-browser.test.ts) | Recurred in the fresh Windows run at `high-ACR SSO still challenges` after the initial OTP stage passed. The retained Windows run and hosted controls passed. The isolated client logged `LOGIN_ERROR / invalid_user_credentials` during the failing run at 00:28:59 UTC and during the passing retained run at 00:31:30 UTC. The stage is confirmed and the exact failing assertion and cause remain unknown. [#222](https://github.com/Maeximilion/MaexSocial/issues/222) owns synthetic test diagnosis and any evidence-backed correction. |

## Gate

Use this record in [#10](https://github.com/Maeximilion/MaexSocial/issues/10) and [G3 / #16](https://github.com/Maeximilion/MaexSocial/issues/16). Treat the throttle and draft results as passing current local controls with historical uncertainty. Keep the intermittent Windows OTP evidence open under #222. Carry the case and its disposition into [G5 / #18](https://github.com/Maeximilion/MaexSocial/issues/18) wherever the release relies on this check. Real identity, operating evidence and owner acceptance remain separate.

## Open

The coordinator verifies the PR before deciding whether to merge it. Merging the PR closes #205. #222 owns the next diagnostic change. Keep the fresh-factor assertion and all current security controls enabled.

- Console — PowerShell.
- Folder/worktree — `$env:USERPROFILE\.codex\worktrees\issue-205-windows-pilot\MaexSocial`.
- Full start command — `Set-Location (Join-Path $env:USERPROFILE '.codex/worktrees/issue-205-windows-pilot/MaexSocial'); git status --short --branch; git rev-parse HEAD`.
- First message — Verify #205's evidence PR and use this handover to assess #10/#16 with #222 still open.

## Lessons

The sanitized Keycloak class also occurs in the passing control. Split the browser assertions by challenge visibility, challenge response and callback verification in #222 before assigning a cause. This delivery used the existing suites and the normal restart. Code Autopilot and Caveman remained active.
