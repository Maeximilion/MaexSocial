# Handover 2026-11-17 - MS-010 Task 2A1 clock correction

## Status

Checkpoint UTC: 2026-11-17T15:56:03Z. Codex implementation; model setting not reverified. Strict build, targeted regressions and full pilot 13/13 passed at the work head below. Earlier foundation checks: Python 122 (one Windows filename skip, real configured scanner), Node 20/20; foundation files unchanged by this correction. Repository checks passed. Final-head CI/Claude API review pending.

## Artifacts

[Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial), [issue #117](https://github.com/Maeximilion/MaexSocial/issues/117), attached normal [PR #135](https://github.com/Maeximilion/MaexSocial/pull/135). Branch `dev-codex/117-customer-activation`. Work head before handover commit: `7305b3040641147c867ebe0bfda125c4df760c65`; base `bfad8dd1569dae2374fc271e627bf16fca991f3c`.

The complete [second API receipt](https://github.com/Maeximilion/MaexSocial/pull/135#issuecomment-6952962957), [run 44117471035](https://github.com/Maeximilion/MaexSocial/actions/runs/44117471035), covers `14412d4b259330bade4b83f6aee1b30f384e0b91`: one timestamp-order finding. That head's CI passed. [Previous corrections and backup](2026-11-17-portal-review-corrections.md) retain the three earlier findings, fixture isolation evidence and recovery location.

## Decisions

Server clock callbacks are evaluated after complete authority locks and awaited inspection, immediately before expiry decisions. Rotation reuses that checked timestamp; MFA reads its clock at its own decision. No request-supplied clock, tolerance, clamping or extended absolute deadline. Tests reproduce then prevent the older-request 403 and expiry during awaited inspection; read/rotation barriers also verify clock timing and monotonic last-seen values. Existing authority/future/deadline checks remain.

One full run observed an empty initial browser title without HTTP status evidence. Instrumented targeted and final full runs passed; the test now requires HTTP 200 before keyboard assertions. Its isolated cause remains unproven, not declared fixed. A temporary instrumentation build error from shadowing `document` was corrected before the passing build.

## Gate

[Accepted local scope](https://github.com/Maeximilion/MaexSocial/issues/15#issuecomment-6681723454) only. A1 remains synthetic; #131 retains real identity/MFA/recovery and G3/G5 blocks. No IdP probe repeated; no merge or deployment authority.

## Open

Push the fully measured candidate, verify final-head automatic API review/CI, resolve evidenced threads and report to root. Refresh private recovery artifacts before archival.

PowerShell: `Set-Location 'C:/Users/Maxi/.codex/worktrees/117-customer-activation/MaexSocial'; git fetch origin --prune; gh pr view 135 --repo Maeximilion/MaexSocial --json headRefOid,baseRefOid,statusCheckRollup`.

First message: Continue #117/PR135 from this checkpoint, verify current-head review and CI, preserve A1 and the blocked-probe boundary, report to root without merging.

## Lessons

Time sampled after locks can still be stale after an awaited status query. Code Autopilot/Caveman remain enabled; API review evidence is distinct from green CI.
