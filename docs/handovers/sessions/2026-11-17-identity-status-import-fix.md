# Handover 2026-11-17 — #136 import correction

## Status

Checkpoint at (UTC) — 2026-11-17T16:43:00Z. The [first checkpoint](2026-11-17-identity-status.md) retains the original contract, source evidence, initial failure and local results. This record adds the concrete Claude finding and tested correction. Both task-owned fixtures are stopped; six database/mail volumes remain retained, not exported. Recovery preparation is still pending final PR coverage.

Implementation/review — Codex `gpt-6-astra`/high, no Fast override; actual backend tier unreported. [Claude API run 44127660632](https://github.com/Maeximilion/MaexSocial/actions/runs/44127660632) executed preparation, API and publisher successfully for head `48ae4012c944550211ea99c23cd0b283ded7277e`, base `c3dd3885f45813facfd3570089354bcbcd9d0653`, candidate `f2f38abd91a26be1abb3a1d931b1cc503901e3d4`. Its [complete result](https://github.com/Maeximilion/MaexSocial/pull/138#issuecomment-6954354402) reported one finding; usage was 21,651 input / 4,066 output tokens. This result does not cover the correction; fresh automatic current-head coverage is pending. No unchanged paid retry or separate Codex review was requested.

Pinned Node 24 build passed. `node --test dist/pilot/tests/pilot/fixture.test.js` passed 4/4, including synthetic old-format manifests with missing and directory-valued import paths. Both reject before Docker with the exact data-preservation message and unchanged directory contents. `npm run pilot:up` passed for the valid existing fixture, and `npm run pilot:test` passed 15/15 including the real provider, controlled failures and browser. Final `npm run pilot:down`, `python scripts/check_repo.py` and `git diff --check` passed. No schema changed; prior empty migration and foundation results remain in the first record. Hosted checks passed on the prior head; the new candidate still needs its checks.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial).
- Task — [#136](https://github.com/Maeximilion/MaexSocial/issues/136); [normal PR #138](https://github.com/Maeximilion/MaexSocial/pull/138), attached to its creating chat, with inherited labels, G3 MVP milestone and Project In Review verified.
- Branch — `dev-codex/136-identity-status`.
- Work head before the handover commit — `fa4b5f539c2065037e04d014e9a67d7c8e779545` (tested correction; not yet pushed at this checkpoint).
- Finding — [missing realm bind source](https://github.com/Maeximilion/MaexSocial/pull/138#discussion_r4602661989).
- Changed behavior — [startup](../../../ops/local/stack.ts), [mount](../../../ops/local/compose.yaml), [regression](../../../tests/pilot/fixture.test.ts), [operations](../../../ops/local/README.md#read-only-identity-status-136).

## Decisions

Before any Compose startup, require the realm import path to be a regular file. On failure, tell the operator to preserve the old directory and volumes and initialize a fresh fixture; never create/migrate/delete legacy data automatically. The long bind also sets `create_host_path=false`.

A separate harmless network-disabled Node mount probe showed Docker Engine 29.9.2 / Compose 5.6.1 on this Windows host still created the missing source directory despite that bind option, so the application precheck is the verified control. One preliminary probe failed in its harness because the tools profile was omitted; after correcting that, two bounded observations showed the backend limitation. No further mount probes were run. Only disposable probe directories were affected; probe containers were removed. No identity or application volume was touched. Do not claim the Compose option alone prevents this observed behavior.

## Gate

The accepted #136 contract and all [original boundaries](2026-11-17-identity-status.md#gate) remain unchanged. #131 owns real identity/MFA/recovery; #123/#124 and Task 3 remain dependent. #137 did not recur and remains open. G3/G5 are not accepted by these status reads or fixture checks.

## Open

Finish complete-input preflight for the correction, normal push, current-candidate CI and actual complete Claude API review; resolve the original thread only with verified fix evidence. Then preserve source, ignored artifacts and original Git metadata outside the worktree and verify a usable restore. Root alone merges and archives; do not begin another issue.

- Console — PowerShell.
- Folder/worktree — `C:/Users/Maxi/.codex/worktrees/136-identity-status/MaexSocial`.
- Full start command — `Set-Location C:/Users/Maxi/.codex/worktrees/136-identity-status/MaexSocial; git status --short --branch; git fetch origin --prune`.
- First message — “Continue only #136 / PR #138 from this import-correction handover. Verify current head/base, CI and actual Claude review, preserve the fixture/data protections, and report final recovery evidence to Root. Do not merge or archive yourself.”

## Lessons

Test the exact old fixture shape, not only the new happy path. Backend mount flags are not substitutes for observed startup behavior. Code Autopilot/Caveman and Ponytail remain active; use targeted checks without duplicate review loops, and no advisory security scan unless explicitly requested through `/start` or `/task`.
