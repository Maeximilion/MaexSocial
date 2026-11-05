# Handover 2026-11-06 — maintenance #104

## Status

Stopped at (UTC) — 2026-11-05T23:39:19Z (implementation checkpoint). Codex implemented and tested the reviewer locally. Independent GPT-6 Astra/high and the requested Codex bot fallback must review the final delivery SHA; neither verdict is established by this checkpoint.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial)
- Task — [maintenance #104](https://github.com/Maeximilion/MaexSocial/issues/104); [#102](https://github.com/Maeximilion/MaexSocial/issues/102) retains the live receipt.
- Branch — `dev-codex/104-messages`
- Work head before the handover commit — `11fff960fd0e0dc65ac7508b5d314d0f69c2973c`
- PR — not yet opened at this checkpoint; find the normal PR via #104. The PR will record its SHA, hosted checks and review evidence.
- Checks — repository validation passed; Python suite reported 83 tests (32 Windows skips), Node 20 passed. All 13 reviewer tests passed after the last request-settings change. No live Anthropic request.

## Decisions

[Review operations](../../08_EVALS.md#advisory-pr-reviews) describe the direct, tool-free Messages request, standard pricing estimate, local schema bounds and failure categories. The [historical run](https://github.com/Maeximilion/MaexSocial/actions/runs/42129500055) produced no structured output and did not prove the cause. Do not infer credit type, change spending settings or retry on error.

## Gate

No product gate or activation. Keep product work paused and use the exact-head Codex fallback until the coordinator records the live #102 receipt or the owner explicitly changes direction.

## Open

Open the normal PR with this handover, obtain both final-head reviews and report them. The coordinator owns merge, activation and the single subsequent [#60](https://github.com/Maeximilion/MaexSocial/pull/60) fixture run on `cc10b281671bf88cce725936c2441a8a27d572f8`. Record the run, usage and genuine inline and main comment links, or record the failure category and leave #102 unverified.

- Console — PowerShell
- Worktree — `$HOME/.codex/worktrees/104-messages/MaexSocial`
- Full start command — `Set-Location (Join-Path $HOME '.codex/worktrees/104-messages/MaexSocial'); codex`
- First message — Read this handover and the delivery PR on #104. Verify its actual head, CI, independent Astra/high and Codex bot evidence before reporting to the coordinator. Do not merge or activate.

## Lessons

The raw API schema accepts fewer constraints than the old CLI schema; the client must validate lengths, ranges and finding count. The synthetic transport test uses the historical diff and verifies publisher placement; it cannot establish workspace access, billing or live model quality.
