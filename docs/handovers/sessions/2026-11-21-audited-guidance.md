# Handover 2026-11-21 — #170

## Status

Stopped at (UTC) — 2026-11-21T15:08:06Z. The four developer guides were reconciled against the audit and rebased onto main at `091f666e502d9a5458e509bf3a0a52ce17198acf` after PR #172 merged. The #155 status paragraph matches main exactly. The #169 preview entry preserves the local observation and links the subsequent merge and review evidence.

`python scripts/check_repo.py`, `node --test tests/*.test.cjs` (20 passed) and `git diff --check origin/main...HEAD` passed on the work head. The first direct Python suite invocation failed when the Windows subprocess lost an empty temporary Git configuration value. Re-running `python -m unittest discover -s tests` in a child process without those unrelated Sites Git environment variables succeeded before and after rebase (91 passed, 32 skipped on Windows). No local product runtime was needed for this documentation change.

Implementation — Codex. Exact model and effort were not independently verified. The [Claude API workflow](../../tooling/agent-workflow.md#pr-review-policy) supplies review after publication. There is no run or result for #170 at this checkpoint.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial)
- Task — [Maintenance #170](https://github.com/Maeximilion/MaexSocial/issues/170)
- Branch — `dev-codex/170-audited-guidance`
- Work head before the handover commit — `ae3af1127d9af4be6c1f55d989bcd7c425f0e7ff`
- PR — pending publication at this checkpoint
- Updated guides — [status](../../01_STATUS.md), [work packages](../../07_WORKPACKAGES.md), [evaluations](../../08_EVALS.md) and [media library](../../18_MEDIA_LIBRARY.md)
- Sources — [audit tracker #162](https://github.com/Maeximilion/MaexSocial/issues/162) and [published audit comparison](https://github.com/Maeximilion/MaexSocial/tree/4a79c84e8d6d156bca3ea9cd07aad82c111f41b9)

## Decisions

Keep the audit's task order and later-gate evidence. Use main for newer delivery facts, including [#137's non-reproduction disposition](https://github.com/Maeximilion/MaexSocial/issues/137#issuecomment-7064444214), [#155 / PR #172](https://github.com/Maeximilion/MaexSocial/pull/172) and [#169 / PR #171](https://github.com/Maeximilion/MaexSocial/pull/171). [#168](https://github.com/Maeximilion/MaexSocial/issues/168) remains blocked on native callback attribution and effective runtime routing after recording synthetic measurements. Follow the existing Claude API policy for review.

## Gate

G2 authorized the [bounded local synthetic text pilot](../../superpowers/specs/2026-11-06-g2-acceptance-packet.md). G3–G5 remain open. #131 retains identity lifecycle and MFA evidence, and #124 retains actual approval. Staging, external tests, real data, product spending and deployment are outside this delivery.

## Open

Finish pinned full-input preflight, publish one normal PR against verified main and attach it to the originating chat. Recheck with real PR metadata and verify Claude execution and CI on the actual candidate. The coordinator owns merge and archive. Preserve the task Git state and private verification material for recovery.

- Console — PowerShell in the existing task worktree for `dev-codex/170-audited-guidance`. The originating chat records the absolute path privately.
- Full start command — `Set-Location (git rev-parse --show-toplevel); git status --short --branch; git fetch origin --prune; gh pr list --repo Maeximilion/MaexSocial --state all --head dev-codex/170-audited-guidance`
- First message — Continue only the #170 documentation delivery. Read this handover and reconcile the live main tip, task head, PR state and coordinator instructions before acting.

## Lessons

Graphify matched main at `4391dd4` during discovery and located the Claude input builder, transport and preflight tests. The four documentation files and full task relationships required direct local and GitHub reads. Preserve dated observations, including the unknown cause of #137, when updating active guidance. Use the enabled Code Autopilot and Caveman skills as documented in [development skills](../../tooling/development-skills.md). The advisory check still requires an explicit `/start` or `/task`.
