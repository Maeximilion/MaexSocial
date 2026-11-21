# Handover 2026-11-21 — #169

## Status

Prepublication checkpoint (UTC) — 2026-11-21T14:33:38Z. The protected occurrence preview is implemented and verified on an isolated local fixture. Hosted CI, Claude API review, serial integration and private recovery are pending.

Implementation/review — Codex session metadata records `gpt-6.2-sol`, high reasoning and no explicit service-tier value. The existing Claude API workflow is configured for Opus 5.5, high effort, standard speed and `standard_only`. Actual execution and coverage of the final head/base are pending.

| Local command | Observed result |
| --- | --- |
| `npm ci --prefer-offline`, `npm run pilot:build` | Pinned Node 24.22.2/npm 11.19.1, dependencies installed and strict TypeScript passed |
| `npm run pilot:up`, `npm run pilot:migrate -- up`, `npm run pilot:migrate -- down`, `npm run pilot:migrate -- up`, `node --test dist/pilot/tests/pilot/migration-empty.js` | Fresh isolated fixture, migration drill and disposable rollback probe passed |
| `node --test dist/pilot/tests/pilot/occurrences.test.js` | 9/9 inner tests passed, including the parent suite. Before implementation, the new revision assertion failed as expected |
| `node --test dist/pilot/tests/pilot/portal-keyboard.test.js` | 1/1 passed in isolated Chromium. The proposal screenshot was inspected locally |
| `npm run pilot:test`, `npm run pilot:down`, `npm run pilot:up`, `npm run pilot:test`, `npm run pilot:down` | 27/27 before restart, 26/27 after restart with retained volumes. Both preview suites passed. An inherited OIDC assertion at TS line 179 / compiled line 244 failed again in a targeted uninstrumented check. One private instrumented timing control passed 9/9 with matching measured wall/monotonic durations. The original failure remains unexplained. [Evidence](https://github.com/Maeximilion/MaexSocial/issues/155#issuecomment-7064165910). The fixture is stopped with volumes preserved |
| `python -m unittest discover -s tests` | 123 tests, 1 Windows-inapplicable skip, 0 failures with Gitleaks 8.30.1. The first attempt inherited a Git config override that broke test repositories. A shell-local environment cleanup allowed their normal hook checks |
| `node --test tests/*.test.cjs`, `python scripts/check_repo.py`, `git diff --check` | 20/20 passed. Repository policy and whitespace checks passed |

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial).
- Task — [#169](https://github.com/Maeximilion/MaexSocial/issues/169), bounded Task 2C under [#124](https://github.com/Maeximilion/MaexSocial/issues/124). [Reservation](https://github.com/Maeximilion/MaexSocial/issues/169#issuecomment-7063975425).
- Branch — `dev-codex/169-approval-preview`.
- Work head before the handover commit — `495d8cd41830ee88680cf2113f8b7cec7e3d8835`. Tested implementation tree based on `d2332feeda90f2d19f580cbaa66fa2dd78c8b0a5`.
- PR — pending. The single normal delivery PR will close #169. Its review and integration evidence belong to the PR and private checkpoint.
- Evidence — [renderer](../../../apps/web/src/routes/content.ts), [HTTPS and database tests](../../../tests/pilot/occurrences.test.ts), [Chromium keyboard test](../../../tests/pilot/portal-keyboard.test.ts). Logs and screenshots stay in ignored `work/`.

## Decisions

Reuse the protected occurrence GET and its current-authority transaction. PostgreSQL reads the latest text revision, actual occurrence location, time and eligibility in one statement snapshot. Only a current Manager in the active tenant can see proposed text for a draft occurrence with no active approval and no attempt. A revision number identifies the immutable revision within its draft. The page escapes plain text and preserves line breaks. Existing status reads and the stored UTC and timezone formatting remain available. A missing revision leaves the status view, and an unrenderable stored time follows the existing 503 response. The read changes no domain records. Session activity follows the existing request path.

## Gate

The [accepted G2 scope](https://github.com/Maeximilion/MaexSocial/issues/15#issuecomment-6681723454) and #169 authorize this local read slice. The OIDC timing observation remains under #155. Approval and reapproval remain part of #124. Integrated identity and current MFA evidence remain in [#131](https://github.com/Maeximilion/MaexSocial/issues/131). The preview grants no approval or delivery authority. G3–G5 remain open.

## Open

Run read-only input preflight and publish the single normal PR against main. Attach it to the originating chat. Verify authentic current-head/base Claude API evidence and integration-candidate CI, then report to the coordinator. The coordinator owns merge. After confirmed merge, preserve the worktree, ignored files, Git bundle and actual stopped fixture volumes in independent private recovery before archival.

- Console — PowerShell.
- Folder/worktree — `$env:USERPROFILE/.codex/worktrees/a7ab/MaexSocial`.
- Full start command — `Set-Location (Join-Path $env:USERPROFILE '.codex/worktrees/a7ab/MaexSocial'); $env:Path=(Join-Path $PWD 'work/runtime/node-v24.22.2-win-x64')+';'+$env:Path; git status --short --branch; node --version`.
- First message — Resume only #169 and its delivery PR from this handover. Reconcile the coordinator's latest control, review, CI and recovery evidence before the next unfinished step.

## Lessons

The existing formatter distinguishes the repeated Berlin wall time with different offsets and UTC instants. Local HTTPS/PostgreSQL and Chromium tests demonstrate the preview over synthetic AppDB authority. Keep Code Autopilot and Caveman enabled and use the existing Claude API review route. Check the shared weekly remainder before expensive work and honor the coordinator's 15 percent pause threshold.
