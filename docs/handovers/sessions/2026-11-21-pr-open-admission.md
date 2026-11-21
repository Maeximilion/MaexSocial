# Handover 2026-11-21 — Maintenance #173

## Status

Checkpoint (UTC) — 2026-11-21T15:17:01Z. The designated Codex delivery chat integrated the coordinator's source commit in a clean task worktree and checked the written rule against six cases. The ordinary delivery PR is pending verification and preparation on the coordinator-authorized native stack parent. The existing Claude Messages API workflow is the PR reviewer. Its configured request is `claude-opus-5-5`, high effort, standard speed and `standard_only`; no run or result exists for this delivery yet.

On work head `c2a6771eb134d2d854baba20175179847a4a52a4`:

- `git diff --check 091f666e502d9a5458e509bf3a0a52ce17198acf HEAD` and scoped byte comparison with the source commit passed.
- `python scripts/check_repo.py` passed. `node --test tests/*.test.cjs` passed all 20 tests.
- `python -m unittest discover -s tests -v` initially hit an inherited Windows `GIT_CONFIG_VALUE_0` error in the temporary repository hook fixture and skipped 32 Gitleaks cases. The test-only rerun excluded the injected `GIT_CONFIG_COUNT`, `GIT_CONFIG_KEY_*` and `GIT_CONFIG_VALUE_*` environment in the Python child. It passed with 91 executed and 32 skipped. A second isolated rerun with the repository-configured Gitleaks 8.30.1 passed with 122 executed and one POSIX-only filename case skipped on Windows.
- Hosted CI and the actual Claude API step and result remain pending publication. The local walkthrough did not open test chats or mutate the coordinator's roster.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial)
- Task ID and issue — [Maintenance #173](https://github.com/Maeximilion/MaexSocial/issues/173)
- Branch — `dev-codex/173-pr-open-admission`
- Work head before the handover commit — `c2a6771eb134d2d854baba20175179847a4a52a4`
- PR — not yet opened. [Predecessor #174](https://github.com/Maeximilion/MaexSocial/pull/174) has merge priority under the [verified reservation](https://github.com/Maeximilion/MaexSocial/issues/173#issuecomment-7064674500).
- Sources — [startup prompt](../../../.codex/orchestration/START.md), [standing agreement](../../../.codex/orchestration/README.md) and [coordination skill](../../../.agents/skills/coordinate-project-chats/SKILL.md) match the coordinator's [source commit](https://github.com/Maeximilion/MaexSocial/commit/3c4eeb453e02827fcb20b8b7438fcb3b2e9adf51).

## Decisions

| Written scenario | Outcome in the three sources |
| --- | --- |
| Verified unused normal PR, free slot, independent successor | The acting coordinator reserves the slot and claims the PR once, publishes and verifies the reservation, then dispatches. The two chats occupy separate slots. |
| Roster reaches the applicable limit, including pending reservations | Hold intake. The hard limit is five and the selected large issue or gate limit is two or three. The original chat stays counted until verified archive. |
| A real prerequisite or the preceding gate blocks the proposed work | Hold that task. An open PR and a free slot do not satisfy a task prerequisite or grant gate authority. |
| The PR was already claimed and later merges | Finish delivery, verify recovery and archive, then release only the old occupied slot. The PR supplies no second admission. |
| Owner pause or unavailable weekly reading | A pause stops intake and in-scope execution. Unknown quota stops new intake. The current owner control is applied separately from the reusable standing threshold. |
| A historical unused merge and verified archive pair exists | It can supply one reservation after reconciliation if the assignment is eligible and capacity is available. A no-PR closeout does not supply a pair. |

Only the acting coordinator controls admission, the ledger and the merge queue. The worker owns this task and its delivery evidence. A concurrent delivery requires native stack membership and a real parent base, and #174 must merge first.

## Gate

Maintenance instructions only. The [bounded G2 acceptance](https://github.com/Maeximilion/MaexSocial/issues/15#issuecomment-6681723454) and the open G3–G5 product gates retain their existing scope and evidence requirements. The delivery requires Foundation CI and an authentic complete Claude result for the current head/base.

## Open

The coordinator authorized #174 as the native stack parent at `f25d827e00aa12db3a991fab36d684f92348e0fd`. Recheck that exact open parent, preserve the original local head, and verify parent ancestry and the child diff. Complete the input preflight, open the ordinary PR against #174's head branch, and verify native stacking. If that parent changes, reconcile the base with the coordinator. Attach it in the owning chat and verify the attachment. Record hosted CI and actual Claude coverage, then hand the evidence and verified private restore to the coordinator.

- Console — Windows PowerShell.
- Folder/worktree — the checkout mapped to `dev-codex/173-pr-open-admission` by `git worktree list --porcelain`. The host-specific absolute path and restore evidence are in the private checkpoint.
- Full start command — from a checkout of this repository, find the task worktree and verify its state and predecessor with the following command:

  ```powershell
  $taskWorktree = git worktree list --porcelain |
      Select-String '^branch refs/heads/dev-codex/173-pr-open-admission$' -Context 2,0
  Set-Location -LiteralPath ($taskWorktree.Context.PreContext[0] -replace '^worktree ', '')
  git status --short --branch
  git rev-parse HEAD
  gh pr view 174 --repo Maeximilion/MaexSocial --json state,baseRefName,baseRefOid,headRefName,headRefOid,mergeCommit
  ```

- First message — Resume issue #173 from this handover. Verify the owner control, weekly reserve, local branch and the coordinator's exact publication base. Finish the one PR, using existing Foundation and Claude checks. Return the artifacts and evidence to the coordinator for merge and archival.

## Lessons

Graphify matched the starting revision and pointed to Foundation CI and its tests. Its partial result did not expose the three instruction sections, so the scenario check used the local texts. Code Autopilot and Caveman are active under the owner's recorded preference. No settings or product fixture was part of this maintenance.
