# Handover Structure Implementation Plan

**Goal:** Preserve complete session handovers and stable lane briefs before MS-014.

**Architecture:** Markdown-only changes reuse the existing handover command and status index. No new tooling or dependencies.

**Tech stack:** Markdown; existing Python link validation, Python unit tests and Node.js tests.

**Spec:** [Maintenance issue #45](https://github.com/Maeximilion/MaexSocial/issues/45) and the owner's supplied handover requirements.

## Scope and verification

- Add `docs/handovers/README.md` with both kinds, five briefs and all required template fields.
- Add the supplied review brief at `docs/handovers/review-workflow.md`, preserving its manual procedure and replacing its Start message exactly as requested. The external source stays in Documents until this PR merges, as instructed by the owner.
- Update `.claude/commands/handover.md`, `docs/12_CLAUDE_CODE_PLAYBOOKS.md`, `docs/README.md` and the root `README.md` folder map.
- Record this session in a new dated `docs/handovers/sessions/` file and one linked line in `docs/01_STATUS.md`; keep earlier briefs unchanged.
- Run `python scripts/check_repo.py`, `python -m unittest discover -s tests` and `node --test tests/*.test.cjs`. Existing tooling needs no code changes or new mirrored documentation tests.
- Commit, push and open the requested PR with `Closes #45`. Request Claude review using the supplied procedure; wait for its publication before MS-014. No merge or new agent session is part of this step.

## Review focus

Check all local links after relocation, every required restart field, duplicate date/topic handling, the distinction between the recorded work SHA and the later handover commit, and pending-review wording. This PR's explicitly requested review direction is Codex → Claude review.

## Execution notes

- Baseline: local links/JSON valid; 9 Python tests and 20 Node.js tests passed.
- Scope decision: preserve the owner's brief as an assignment snapshot. Its requested MS-014 review task conflicts with existing upload-security issue #43; flag the collision without renaming or editing that issue in this PR.
- Review follows the owner's explicit manual Claude procedure. No same-family review or automatic reviewer session substitutes for it.
- Concurrent foundation PR #46 merged while this task was in progress. Incorporated main `b9e08c79415d85779bcac39c739f5d4a8ae9070e`, retaining its expanded folder map and this task's handover entries. Post-merge checks passed: repository validation, 29 Python tests and 20 Node.js tests.
- Implementation is in draft PR #47. This session record and its one-line status link complete the documentation delivery; independent Claude review remains pending on the PR.
