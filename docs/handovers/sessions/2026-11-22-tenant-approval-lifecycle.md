# Handover 2026-11-22 — #271 private publishing lifecycle

## Status

Checkpoint at 2026-11-22T22:04:52Z. Codex GPT-6.2 Sol high implemented the private lifecycle binding.
The six focused test files passed on the integrated work head. They covered private approval,
dispatch, hold, export, cold-pair verification and refusal of an existing restore target.
The ordinary fixture's empty up/down/up drill and populated 010-to-011 upgrade passed. Earlier
draft and occurrence-detail tests failed on altered UTF-8 punctuation. Both suites passed after
the source bytes were corrected. A full pilot rerun on the integrated code was started. The
Claude Messages API review and hosted candidate results belong in the delivery PR.

## Artifacts

- Repository and issue — [Maeximilion/MaexSocial #271](https://github.com/Maeximilion/MaexSocial/issues/271).
- Branch — `dev-codex/271-tenant-approval-lifecycle`.
- Work head before the handover commit — `8c3cf7405828fd588aa5fd65fd00240af8835e6d`.
- Base — [7c9f40a9](https://github.com/Maeximilion/MaexSocial/commit/7c9f40a9d66339354abee6b1b41245e2eff7a72d), the verified #268 merge.
- PR — Opened after this checkpoint. Find its URL and current checks through the issue.
- [Local contract and repeatable fixture command](../../../ops/local/README.md#private-approval-across-tenant-reactivation-271).

## Decisions

Before suspension, the fixture committed one terminal export, held a separate occurrence and
created one in-flight attempt. Reactivation advanced the tenant version from 1 to 3. Old previews
and new effects on stale approvals were refused. A fresh Manager approval created a separate
immutable row and allowed one fake create or one terminal export event. An authorized repeat
returned text without writing again. An independent tenant exported while the first tenant was
suspended and repeated after reactivation. Hold, quarantine and the old terminal export stayed
protected. Readback advanced the original attempt to pending with its original approval and one
fake create.

A cold pair captured by revision `d7076a0adbba65c2ccd34b50db0694d8b3e7d4a8` was imported
by the 011 implementation at `3e524361b4c61efc36bf6e9eff55ace5cab6a58b`. Both databases
were verified and five occurrences quarantined, two retaining their prior approval links.
Dispatch stopped, application login was disabled, zero host ports were published and repeat
quarantine changed zero rows. The 010 schema and original archive hashes were preserved.

## Gate

G3 remains open. [#165](https://github.com/Maeximilion/MaexSocial/issues/165) retains Task 4
integration. [#223](https://github.com/Maeximilion/MaexSocial/issues/223) retains the authenticated
approval journey and [#131](https://github.com/Maeximilion/MaexSocial/issues/131) retains real identity and MFA.

## Open

Verify the authentic full Claude API review and required CI for the current PR head and merge
candidate. The coordinator owns the merge and confirms it before worktree archival.

- Console — PowerShell in the attached `issue-271-tenant-approval-lifecycle` checkout.
- Command — `git fetch origin --prune` followed by `gh pr view dev-codex/271-tenant-approval-lifecycle --json url,headRefOid,baseRefName,statusCheckRollup`.
- Resume with #271 and compare the live PR with this checkpoint before taking action.

## Lessons

The first offline restore attempt stopped in target creation. A fresh target restored the same
verified pair and passed the state and archive checks. The pinned runner executed the substantive
SQL and fake-provider tests. Code Autopilot and Caveman remain enabled. Advisory scans require an explicit command.
