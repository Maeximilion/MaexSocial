# Handover 2026-11-06 — maintenance #107

## Status

Checkpoint at 2026-11-06T00:05:48Z. The coordinator wrote the standing rule. The #107 delivery chat verified the rule and published it in PR #108. The work head passed the repository check, the Python suite (86 total, 54 passed, 32 skipped) and 20 Node tests. The local plugin inventory reported Superpowers 7.0.1 installed and enabled. The entry skill was readable.

Implementation/review — Codex → Claude review. For #107 the delivery assignment explicitly requires a fresh GPT-6 Astra high review and the automatic Claude review through the [direct Messages API verified on #102](https://github.com/Maeximilion/MaexSocial/issues/102#issuecomment-6672762871). The assignment excludes manual review mentions. Verify both results on the final PR revision.

## Artifacts

- Repository and task — [MaexSocial maintenance #107](https://github.com/Maeximilion/MaexSocial/issues/107).
- Branch — `dev-codex/107-coordinator-superpowers`.
- Work head before the handover commit — `02a0104eb5aca8762438f8a1c09fbf9e5f2672b5`.
- PR — [#108](https://github.com/Maeximilion/MaexSocial/pull/108), open. The issue will link final review evidence.
- Entry path — [repository instructions](../../../AGENTS.md), [standing agreement](../../../.codex/orchestration/README.md), [current handover](../../../.codex/orchestration/CURRENT.md).

## Decisions

Keep the orchestration rule in the standing agreement. The current handover links back to that agreement. The repository coordination skill owns queue and review decisions.

## Gate

Repository maintenance. Product gates and owner decisions are outside #107.

## Open

Verify both reviews on the final PR SHA and record the evidence on #107. The coordinator owns the merge decision and archive readback.

- Console and folder — PowerShell, existing issue worktree.
- Start command — `Set-Location (Join-Path $env:USERPROFILE '.codex/worktrees/107-coordinator-superpowers/MaexSocial'); git status --short --branch; gh issue view 107 --comments`.
- First message — Resume maintenance #107 from this handover and its issue. Verify the current PR SHA, checks, reviews and latest coordinator control before proceeding.

## Lessons

The plugin inventory and entry file establish local availability. A future coordinator's execution is verified in that session.
