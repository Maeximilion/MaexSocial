# Handover 2026-11-17 — Maintenance #125

## Status

Stopped at (UTC) — 2026-11-17T13:39:46Z, pre-publication checkpoint.

Active instructions now route MaexSocial PRs through the Claude API, with authentic complete current-head/base evidence required. Precise assignments, delegated technical decisions, bounded retries and semantic pause/resume are documented. Root authored the two coordinator-record edits included in this delivery; the issue owner preserved them unchanged.

Implementation/review — Codex → Claude API review. Implementer runtime verified as `gpt-6-astra` / `high`; no Fast tier was recorded, with Standard required by the assignment. Reviewer configuration remains `claude-opus-5-5` / `high` / `standard`, `standard_only`. Actual API execution and published review are pending, not inferred from configuration.

At work head `579c42278d3628413336a7ff13df65d8468e771c`, `python scripts/check_repo.py` passed and `git diff --check` passed. A targeted `rg` audit covered active instructions, shared commands, agent/coordination/development guidance, templates, handover briefs and operations guidance. Remaining Astra/fallback references are explicit supersession notices or historical evidence. The legacy workflow comment and reviewer configuration remain unchanged and are superseded by the canonical policy. No prose-mirroring tests or full product suite were run for this documentation-only change. Final handover validation and hosted results must be recorded with the PR.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial).
- Task ID and issue — [Maintenance #125](https://github.com/Maeximilion/MaexSocial/issues/125).
- Branch — `dev-codex/125-review-policy`.
- Work head before the handover commit — `579c42278d3628413336a7ff13df65d8468e771c`.
- PR — Not yet opened at this checkpoint; create the single normal delivery PR and attach it in the originating chat. Its native closing link on #125 identifies the delivery.
- Files and evidence — [Canonical review policy](../../tooling/agent-workflow.md#pr-review-policy), [coordination skill](../../../.agents/skills/coordinate-project-chats/SKILL.md), [root-owned coordinator record](../../../.codex/orchestration/CURRENT.md). Commands, templates, operations guidance and active briefs link to the canonical rule.

## Decisions

The owner decision of 2026-11-17 replaces earlier mandatory Astra and Codex fallback directions for these PRs. Historical reports and handovers remain dated evidence. No product code, Actions/client/scripts, model settings, cost limits, trust or secret controls changed. No paid probe, manual review trigger or separate Codex review was initiated. The existing automatic workflow reviews the genuine PR.

Root alone owns coordinator records, verifies actual review evidence, performs the authorized serial merge and verifies recovery before archival. This chat retains ownership of findings on this one PR. Larger #117 publication follows this smaller delivery's confirmed merge. No new issue or replacement chat is assigned here.

## Gate

Maintenance only; no product acceptance changes. Required CI, complete current-candidate review, unresolved findings, integration checks and existing product gates remain effective. Protected reviewer self-skips must be reported to root as gaps, never treated as successful reviews.

## Open

1. Validate this handover, commit and push; verify remote SHA and clean state. Open and immediately attach the normal PR with `Closes #125`, Maintenance metadata and honest pending-review checklist.
2. Let the automatic Claude workflow run. Root verifies actual API execution and authentic full head/base result; the worker fixes genuine findings in the same PR with targeted checks. Diagnose before any corrected retry; no identical paid retry.
3. Report final branch/SHA, PR/run links, actual checks, remaining gaps and in-flight work to the authorized coordinator. Root merges and verifies recovery/archive; no automatic merge is enabled by this handover.

- Console — PowerShell.
- Folder/worktree — `C:/Users/Maxi/.codex/worktrees/125-review-policy/MaexSocial`.
- Full start command — `Set-Location 'C:/Users/Maxi/.codex/worktrees/125-review-policy/MaexSocial'; git status --short; git fetch origin --prune; gh issue view 125 --repo Maeximilion/MaexSocial`.
- First message — Continue only Maintenance #125 and its linked delivery PR. Read this checkpoint and the canonical PR review policy, verify current head/base and hosted evidence, then fix genuine findings or report the precise gap to the authorized coordinator. Preserve root-owned coordinator files and other workers' changes. Do not create another PR, substitute a reviewer or merge.

## Lessons

Active commands and handover templates can silently restore obsolete review requirements. Canonical routing plus dated supersession preserves history without retaining those requirements. Code Autopilot and Caveman remain enabled; Ponytail supplies the bounded documentation workflow. Advisory security checks run only on explicit `/start` or `/task`, neither invoked for this task. No subprocess, subagent or local-only product fixture was started by this work chat.
