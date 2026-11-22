# Handover 2026-11-22 — #273 private approval withdrawal

## Status

Checkpoint at 2026-11-22T22:34:01Z. Codex GPT-6.2 Sol high implemented private withdrawal for the original
approving Manager on the verified #275 base. The strict build, empty migration up/down/up, historical
approval upgrade and fresh Windows pilot passed. The fresh pilot reported 57/57. The retained Windows
pilot and its dispatch stop/reopen drill were running at this checkpoint. The delivery PR records
the retained results, Claude Messages API review and hosted candidate CI.

## Artifacts

- Repository and issue — [Maeximilion/MaexSocial #273](https://github.com/Maeximilion/MaexSocial/issues/273).
- Branch — `dev-codex/273-manager-approval-withdrawal`.
- Tested work head before the handover commit — `15011da201489163f4dd6a18c1f992e24a346df4`.
- Base — [f8ebae7](https://github.com/Maeximilion/MaexSocial/commit/f8ebae76a7cd9507cf88b32fe0e543e117311c08).
- PR — Pending at this checkpoint. Find the live link and results through the issue or branch.
- [Private operation and fixture command](../../../ops/local/README.md#private-manager-approval-withdrawal-273).

## Decisions

The existing customer session and enrolled-MFA contract applies before and after domain lock waits.
The append-only audit references the exact withdrawn approval. A proposal observed before withdrawal
cannot approve again. A fresh proposal can produce a new snapshot, which a retry of the old withdrawal
leaves intact. The isolated fake recorded zero creates when withdrawal beat claim and one when claim
won. The original attempt reconciled to pending. Both export commit orders respected the same lock,
and the existing terminal export remained repeatable under current customer authority.

## Gate

G3 remains open. [#223](https://github.com/Maeximilion/MaexSocial/issues/223) retains public UI and
the authenticated approval journey. [#131](https://github.com/Maeximilion/MaexSocial/issues/131) retains
real identity and MFA.

## Open

Complete the retained pilot and read back the authentic Claude API result and candidate CI in the
delivery PR. The coordinator owns merge and confirms the merge before worktree archival.

- Console — PowerShell in the attached `issue-273-manager-approval-withdrawal` worktree.
- Command — `git fetch origin --prune`, then `gh pr view dev-codex/273-manager-approval-withdrawal --json url,headRefOid,baseRefName,statusCheckRollup`.
- Resume with #273 and reconcile the PR head, base and tests with this checkpoint.

## Lessons

The two Windows observations tracked in #233 and #238 did not appear in the fresh run.
Code Autopilot and Caveman remain enabled. Advisory checks require an explicit command.
