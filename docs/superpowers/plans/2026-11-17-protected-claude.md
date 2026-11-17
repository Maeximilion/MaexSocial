# Protected Claude Review Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans in this chat. The coordinator authorized implementation; the ordinary Claude API workflow supplies the required independent PR review.

**Goal:** Safely review later protected-reviewer changes through one trusted manual route.

**Architecture:** New workflow dispatches a trusted Python prepare/publish helper. Reuse `claude_input.build_input`, `claude_messages.main` and `result_from`; leave their files and the ordinary workflow unchanged.

**Tech Stack:** Python standard library, GitHub Actions, existing `gh` CLI.

**Spec:** [Accepted design](../specs/2026-11-17-protected-claude-design.md).

## Global constraints

Preserve the three protected files byte-for-byte, API limits/credential isolation, one request/no retries, 20-minute job and exact revision checks. Root alone merges. No paid probe.

## Review focus

- Rerun or stale result file must not create completed coverage.
- Renaming a route file must still trigger self-protection.
- Closed/fork/retargeted/moved PRs must not receive stale findings.
- Unknown or mismatched merge candidates must fail before spending.
- External exception text and raw provider content must stay outside logs.

## Task 1: Trusted route and offline regression matrix

**Files:** Create `.github/workflows/claude-protected-review.yml`, `scripts/claude_protected_review.py`, `tests/test_claude_protected_review.py`.

**Interfaces:** `snapshot(env) -> (pull, evidence)` validates the exact dispatch/PR/candidate; `prepare(env)` writes bounded input and evidence; `publish(env)` requires successful API outcome and revalidates evidence before each write; `main(argv=None)` emits only fixed diagnostics.

- [x] Write realistic mocked GitHub lifecycle tests for success, fork/closed/moved revisions, authorization, incomplete input, rename/self-change, candidate parents, stale publication, overflow/API failure and secret-safe errors.
- [x] Run `python -m unittest discover -s tests -p test_claude_protected_review.py -q`; observe the missing implementation failure.
- [x] Implement the workflow and helper against those tests, with pinned checkout and step-scoped credentials.
- [x] Run all `test_claude*.py` tests; assert protected files unchanged with `git diff --exit-code origin/main -- .github/workflows/claude-review.yml scripts/claude_input.py scripts/claude_messages.py`.

## Task 2: Operational evidence and delivery

**Files:** Create `docs/tooling/claude-protected-review.md` and session handover; update relevant existing status/preflight/evaluation references only.

- [x] Document exact dispatch inputs, coordinator authorization, failure handling, independent self-protection and the remaining live-proof boundary.
- [x] Run repository validation, Python foundation tests, Node foundation tests and whitespace checks.
- [ ] Commit/push one focused task branch; open and attach one normal PR with exact validation results and `Closes #127`.
- [ ] Record ordinary Claude API review/CI evidence and report exact candidate, branch/SHA and remaining limits to Root. Fix confirmed findings in the same PR.

## Execution ledger

- Baseline: 31 existing Claude tests and repository validation passed on `959b248612eeb0b80a4b392160e23826fb0d7bc9`.
- Ruling: use this compact plan as the progress ledger instead of a second disposable workspace. Root requires minimal focused implementation and no additional reviewer rounds.
- Task 1 complete: 18 new tests and all 49 Claude tests pass. Initial missing-module failure was observed; a test helper name initially shadowed `TestCase.run` and was corrected before the first green run. A merge-parent assertion was separated from revoked-actor setup to ensure the intended denial was exercised.
- Task 2: documentation and local validation complete; hosted CI and actual ordinary Claude review remain pending when this plan is committed. PR delivery evidence belongs in the PR and coordinator checkpoint, without triggering a documentation-only paid rerun.
