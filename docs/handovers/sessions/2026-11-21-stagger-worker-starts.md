# Handover 2026-11-21 — Maintenance #185

## Status

Stopped at (UTC) — 2026-11-21T17:21:23Z, at the source commit before saving this handover. The assigned Codex work chat integrated the coordinator's revised patch on current main. The source-only change covers three coordination entry points. The existing Claude Messages API workflow is the PR reviewer. Its configured request is `claude-opus-5-5`, high effort, standard speed and `standard_only`. Actual Claude execution, hosted CI and Codex runtime settings are unverified at this checkpoint.

- The coordinator patch passed SHA-256 verification and `git apply --check`. `git diff --check 4f36d6fad83c236640b8fdd62d7eb1d772900423 HEAD` and `python scripts/check_repo.py` passed.
- `python -m unittest discover -s tests` passed with 91 executed and 32 skipped without a discoverable Gitleaks executable. The test child excluded the host-injected `GIT_CONFIG_COUNT`, `GIT_CONFIG_KEY_*` and `GIT_CONFIG_VALUE_*` entries. The targeted retry, `python -m unittest discover -s tests -p test_secret_hooks.py`, used configured Gitleaks 8.30.1 in the same isolated environment. It passed with 31 executed and one POSIX-only case skipped. No Git or workstation configuration changed.
- `node --test tests/*.test.cjs` passed all 20 tests. The scenario walkthrough below applied the written instructions to synthetic cases without dispatching live chats or changing the scheduler, roster or account settings.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial)
- Task ID and issue — [Maintenance #185](https://github.com/Maeximilion/MaexSocial/issues/185)
- Branch — `dev-codex/185-stagger-worker-starts`
- Work head before the handover commit — `16ca7896a6879d45b9762908924ea41d535470ca`
- PR — not yet opened. [Reservation](https://github.com/Maeximilion/MaexSocial/issues/185#issuecomment-7066331735) verified. Confirm the publication window with the coordinator and preserve [#183](https://github.com/Maeximilion/MaexSocial/issues/183)'s publication priority if both deliveries are ready.
- Sources — [startup prompt](../../../.codex/orchestration/START.md#complete-prompt-to-copy), [standing agreement](../../../.codex/orchestration/README.md), [coordination skill](../../../.agents/skills/coordinate-project-chats/SKILL.md#establish-ownership), and [existing dry run](../../../tests/scenarios/coordinate-project-chats.md).

## Decisions

| Written scenario | Outcome |
| --- | --- |
| Three free slots and several eligible issues | A due, authorized tick permits one start. An independently authorized tick needs no predecessor PR. |
| A normal PR opens at 12:04 UTC after a 12:00 UTC actual start | Prepare eligible follow-up work. No new start at 12:09:59. At 12:10:00 the interval is satisfied if the tick is due and all other checks pass. The existing PR may progress in the meantime under the usual review and serial merge guards. |
| A reservation at 12:10 becomes a native chat at 12:13 | Count the reservation once until it converts to one chat. The earliest next start is 12:23 UTC, subject to a due tick. Neither reservation time nor PR publication, review, merge or archive starts the clock. |
| The create result or native start time is still unknown after restart | Keep the slot reserved and hold all further reservations. Reconcile the actual roster and issue notice. Release the reservation and any claim only on confirmed creation failure. |
| The coordinator resumes after several missed ticks | Reconcile authority, reservations and the most recent actual start. If the interval has elapsed and a tick is due, start up to one worker. Unverified authority or unknown quota holds intake. |
| A PR-based trigger is already claimed | The later merge and verified archive release the originating occupied slot. They do not supply another claim. An unused verified merge/archive pair can qualify once under the active admission rule. |
| Dry-run U with two small chats still counted | A gate cap of three can fit one new worker, while a cap of two cannot. In the earlier PR-based mode, the unused verified pair can qualify the gate. Under a separately authorized independent cadence, a due window can qualify without that pair. A pending create, full pause or stricter limit still takes precedence. The large PR waits for smaller predecessors to merge or for owner disposition of a blocked predecessor. |
| The latest owner control enters serial mode or full pause | Serial mode prevents new overlap. Existing admitted deliveries may still advance under the applicable controls. A full pause freezes in-scope execution, intake, PR publication and merges. |

## Gate

Authorized maintenance under [#185](https://github.com/Maeximilion/MaexSocial/issues/185). The [bounded G2 acceptance](https://github.com/Maeximilion/MaexSocial/issues/15#issuecomment-6681723454) and open G3–G5 product gates retain their existing scope. The coordinator owns admission, merge and archive. This delivery needs exact-candidate CI and an authentic complete on-head/base Claude API result.

## Open

Confirm the authorized PR window and exact base with the coordinator, then publish the normal PR closing #185 and verify its Codex attachment. Report actual CI and Claude API evidence and confirmed findings, if any, for the current candidate. Reconcile the intended base again if it moves. Keep the private recovery checkpoint outside the task worktree for the coordinator's archival procedure.

- Console — PowerShell.
- Folder/worktree — the checkout mapped to `dev-codex/185-stagger-worker-starts` in the local worktree inventory. The host-specific absolute path stays in the private checkpoint.
- Full start command — from any MaexSocial checkout:

  ```powershell
  $task = git worktree list --porcelain |
      Select-String '^branch refs/heads/dev-codex/185-stagger-worker-starts$' -Context 2,0
  Set-Location -LiteralPath ($task.Context.PreContext[0] -replace '^worktree ', '')
  git status --short --branch
  git rev-parse HEAD
  gh pr list --repo Maeximilion/MaexSocial --head dev-codex/185-stagger-worker-starts --state all
  ```

- First message — Resume #185 from this handover. Verify the newest owner control and the confirmed publication window. Continue this delivery's PR, current-candidate CI, actual Claude review and recovery handoff to the coordinator.

## Lessons

Graphify returned the same starting commit as the worktree (`1fab45bfe10b68088c7cee2496de57a95bf80636`) and no orchestration matches or indexed startup file. Local source and the existing dry run supplied the scenario evidence. Preserve the difference between a tick, a reservation and a native start on resume. Code Autopilot and Caveman are active locally. The explicit-only advisory check remains tied to `/start` or `/task`.
