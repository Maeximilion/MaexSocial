# Handover 2026-11-21 — maintenance #160

## Status

Stopped at (UTC) — 2026-11-21T13:21:00Z, at the pre-PR checkpoint.

Implementation is complete: explicit-only Codex startup skill, full owner-copyable prompt, existing coordination contract, recovery record and scenario coverage. Product work and PR #157 remain paused. The manually started successor owns the full planning audit and future P1 gap umbrella; neither is claimed complete here.

Implementation/review — Codex coordinator and bounded implementation helper -> existing Claude Messages API workflow. Actual Codex runtime model/effort/tier were not independently verified. Claude review is pending until this delivery PR exists; required configured settings remain `claude-opus-5-5`, effort `high`, speed `standard`, tier `standard_only`. No Claude configuration, workflow or client was changed. Run/result/head/base evidence must be recorded on the PR before merge.

Verification:

- Manual wiring regression failed before skill creation and passed afterward (one test). `python scripts/check_repo.py` and `git diff --check` passed.
- Initial `python -m unittest discover -s tests` ran 123 tests with 31 failures, one error and one skip. Local Git fixtures inherited incomplete host-injected HTTP credential configuration (`missing config value GIT_CONFIG_VALUE_0`). No repository or global Git configuration was changed.
- Repeated the same suite in a Python child after verifying and removing only injected `credential.*`, `url.*` and `http.*` `GIT_CONFIG_*` entries from that child's environment; retained configured Gitleaks through `MAEXSOCIAL_TEST_GITLEAKS`. Result: 123 tests, OK, one platform skip. Source/test inputs match the work head; later edits affected documentation/scenarios only.
- `node --test tests/*.test.cjs` with existing Node 24.22.2: 20 passed. No runtime installation was performed.
- Five fresh-context offline instruction-application cases covered dual ownership/newer pause, absent native stacks, stale/partial Graphify, squash/retarget invalidating evidence, and audit/gate gaps. Responses matched the required decisions. Added priority scenario AG was directly checked against the owner's subsequent Security -> open PRs -> eligible new tasks instruction. These are not live dispatch/stack/merge tests.
- Optional system skill validator was unavailable (`ModuleNotFoundError: yaml`); no dependency was added. Hosted current-candidate CI and actual Claude API review are pending. This record does not claim their success.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial).
- Task ID and issue — [maintenance #160](https://github.com/Maeximilion/MaexSocial/issues/160).
- Branch — `dev-codex/160-orchestrator-start`.
- Work head before the handover commit — `c7dd1e686c6979d528cf39b56b83f5a9976fd8f6`.
- PR — not yet opened; creation is the next delivery action. Final receipt belongs on issue #160 and its linked PR, avoiding result-only follow-up commits.
- [Full startup prompt](../../../.codex/orchestration/START.md), [manual skill](../../../.agents/skills/maexsocial-orchestrator/SKILL.md), [standing agreement](../../../.codex/orchestration/README.md), [current handover](../../../.codex/orchestration/CURRENT.md), [design](../../superpowers/specs/2026-11-21-orchestrator-start-design.md), [plan](../../superpowers/plans/2026-11-21-orchestrator-start.md), [scenarios](../../../tests/scenarios/coordinate-project-chats.md).
- Validation logs and private ownership/control evidence remain local, outside public Git content. The old coordinator's unpublished pause and PR #157's unrecovered ignored fixtures remain preserved in their original worktrees.

## Decisions

The owner leaves #157 to the successor. This bootstrap is the one-time independent PR exception; it does not resume product work or permit future parallel independent PR publication. Future concurrent delivery PRs require a verified stack and serial guarded merges. Queue importance is evidenced security work, open PRs, then eligible gate/task/priority-ordered issues; no control bypass or implicit advisory scan.

The short skill invocation loads recovery only. The owner-sent complete prompt explicitly grants takeover, audit/issue creation and subsequent already-accepted local continuation after exclusive ownership and an audit checkpoint. Reading repository text or resetting usage does not grant that authority. Never change Claude settings without an explicit owner request. Graphify is active scoped discovery with commit/coverage evidence and local fallback. Headroom/RTK functioning and product AI/provider choices are successor audit questions, not verified outcomes of this delivery.

## Gate

Authorized maintenance only. G0–G2 retain their bounded accepted scope; G3–G5 remain open. Preserve [G2 owner acceptance](https://github.com/Maeximilion/MaexSocial/issues/15#issuecomment-6681723454), local synthetic scope and outstanding operating/release gaps. This startup does not accept a product gate or authorize real accounts, external testing, deployment or spending.

## Open

First commit this handover, push the clean task branch, create and attach the normal PR closing #160. Wait for complete authentic Claude API review and exact integration-candidate CI; fix confirmed findings and merge only this delivery after guarded verification. Pull clean canonical main and publish the final receipt. Leave #157 paused and intact.

- Console — PowerShell.
- Folder/worktree — the task checkout under `$env:USERPROFILE/.codex/worktrees/160-orchestrator-start/MaexSocial`; verify its Git root and branch before continuing. Private ledger retains machine-specific identities.
- Full start command — `Set-Location (Join-Path $env:USERPROFILE '.codex/worktrees/160-orchestrator-start/MaexSocial'); git status --short; git branch --show-current; git rev-parse HEAD`.
- First message for delivery recovery — "Read docs/handovers/sessions/2026-11-21-orchestrator-start.md and reconcile issue #160's linked PR. Finish only the authorized startup delivery, actual Claude review/CI and guarded merge. PR #157 and product work stay paused. Preserve Claude settings and all other checkouts."
- For the manually created successor, use the complete owner prompt in START.md after this delivery is merged. Do not automatically create that chat. Verify old-writer release and atomically claim the private ledger before dispatch or merge.

## Lessons

Reuse the existing contract rather than duplicate queue logic. Test instruction application separately from native execution evidence. Required plans are not all Graphify-indexed. Do not conflate future owner-pasted authorization with a file's contents, takeover with resume, stack order with semantic dependencies, or green old checks with a current merge guard. Preserve Code Autopilot and Caveman with relevant Superpowers/Ponytail workflows; explicit `/start` or `/task` alone activates the advisory scan.
