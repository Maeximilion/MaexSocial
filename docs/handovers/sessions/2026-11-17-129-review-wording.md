# Handover 2026-11-17 — Maintenance #129

## Status

Checkpoint at (UTC) — 2026-11-17T14:33:57Z. Wording correction and regression checks are complete locally; hosted CI and independent Claude API review are pending. This checkpoint precedes publication and review. Subsequent run/candidate evidence belongs in the linked issue and PR comments, without changing the reviewed head solely to record receipts.

Implementation/review — Codex implementation, actual runtime `gpt-6-astra` / `high`, no service-tier override; Claude API review pending. The configured reviewer is Opus 5.5/high/standard; no live review has executed for this change. Only the coordinator may dispatch the trusted independent route and decide merge.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial).
- Task — [Maintenance #129](https://github.com/Maeximilion/MaexSocial/issues/129).
- Branch — `dev-codex/129-review-wording`.
- Base — `ee361af300a40c1f6bc3e045f6c2cd2088480076` on `main`.
- Work head before the handover commit — `080e228154956cce713de3fc913a7b11f2fa812a`.
- PR — not yet opened; publish one normal PR with `Closes #129` after this handover is committed.
- Changed implementation — workflow display name/comment and two publisher headers in `.github/workflows/claude-review.yml`; review task wording in `scripts/claude_input.py`. Existing tests in `tests/test_claude_review.py` cover headers across success, self-skip, failure and incomplete outcomes, plus input task wording.
- Verification on the exact work content committed as `080e228154956cce713de3fc913a7b11f2fa812a`: `python -m unittest discover -s tests -p 'test_claude*.py' -q` passed 51 tests; `python scripts/check_repo.py` passed; `python -m unittest discover -s tests -q` passed with 121 discovered, 32 skipped because Gitleaks was unavailable; `node --test tests/*.test.cjs` passed 20 tests; `git diff --check` passed. The first targeted run failed one existing assertion for the old `Claude reply` header; updating that assertion produced the passing run above.
- A local assert-based comparison against the base proved exactly five wording replacements across the two implementation files. The Messages client and both independent-route executable files remain identical in Git content; all execution, trust, permission, trigger, limit and job contexts are unchanged. Offline mocks do not prove live API execution.

## Decisions

Name the result Claude API review, without a separate Codex/Astra requirement. The automatic header identifies a findings report and asks the reader to check coverage; it explicitly separates CI, product gates and the coordinator's merge decision. A mention reply does not claim a complete PR review. Existing incomplete/self-skip logic and result validation remain unchanged.

The new independent route remains untouched, so it can review this genuine protected-file correction from trusted `main`. Do not bypass the expected ordinary-route self-skip or launch a paid diagnostic, review mention, substitute reviewer or task-branch dispatch.

## Gate

Maintenance only; no product-gate change or deployment authority. [The review policy](../../tooling/agent-workflow.md#pr-review-policy) and [protected-route procedure](../../tooling/claude-protected-review.md) require actual complete current-head/base review evidence and current CI before the coordinator's merge decision. This PR is the first genuine live-use candidate for #127's previously deferred verification; success is not yet established.

## Open

Publish this committed handover and one normal PR, attach it to its creating chat, then report exact head/base/target/test-merge candidate and observed CI to the coordinator. The coordinator owns the single authorized initial protected-review dispatch and any evidence-backed subsequent decision. Fix confirmed findings in this same PR. After merge prepare recovery outside this worktree; the coordinator owns archival. Do not start another task.

- Console — PowerShell.
- Folder/worktree — `C:/Users/Maxi/.codex/worktrees/129-review-wording/MaexSocial`.
- Full start command — `Set-Location 'C:/Users/Maxi/.codex/worktrees/129-review-wording/MaexSocial'; git status --short --branch; git fetch origin --prune; gh pr list --repo Maeximilion/MaexSocial --head dev-codex/129-review-wording --json number,url,headRefOid,state`.
- First message — Continue only #129 from this handover; verify the existing PR and exact revisions, report its CI/review gap to the authorized coordinator, and preserve the independent route and all execution controls. Do not dispatch or merge.

## Lessons

Code Autopilot and Caveman remain enabled through their canonical installed skills; Ponytail supplies the small-change workflow. Advisory security/quality checks run only on explicit `/start` or `/task`. A successful self-skip is not an API review, and a zero-finding report alone does not prove complete coverage or merge approval.
