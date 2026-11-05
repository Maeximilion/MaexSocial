# Handover 2026-11-05 — MS-014, independent cross-model review

This is a forward-looking brief, preserved from the owner's assignment. Session stopping points belong in separate records under `sessions/`, indexed from [status](../01_STATUS.md).

Task identity note (2026-11-05): the handover-structure task is [Maintenance #45](https://github.com/Maeximilion/MaexSocial/issues/45). MS-014 is already assigned to [upload security #43](https://github.com/Maeximilion/MaexSocial/issues/43); the references to MS-014 below identify the owner's intended follow-on review-workflow task, not permission to replace #43. Resolve its task number before creating that issue. The assignment snapshot below is historical; use the latest session handover and live Git refs for current branch, SHA, PR and review state.

Status — Nothing implemented in MaexSocial yet. `AGENTS.md`, `docs/00_PCF.md` (decision of 2026-11-04), `.claude/commands/done.md`, `docs/handovers/build.md` and the PR template require every code review to use `gpt-6-astra` at `high`. For a repository Codex mostly writes, that is a same-family self-review. Maex-Voice-Agent replaced this pattern with cross-model review in PR #542 (merged 2026-11-05, merge commit `65ed60fa60ba137c884d05b5119d45ec7979ab53`), and the procedure ran end to end there: four manual Claude reviews, inline findings, verified fixes, a relayed merge-gate decision and the merge.
Artifacts — Repository `Maeximilion/MaexSocial`, canonical checkout `C:/Users/Maxi/Documents/GitHub/MaexSocial` (clean `main` at `c4f76e5`). Create the task issues first (see Open); work on task branches in separate worktrees. Reference sources in `Maeximilion/Maex-Voice-Agent` on `main`: `CLAUDE.md` section 6 ("Independent review requests", "Reviews", "Review comment format", "Evaluate feedback before changing code", "Review loop limits"), `AGENTS.md` "Code Review Rules", `docs/21_REVIEW_AUTOMATION.md` ("Current rollout: manual independent review", "Focused follow-up reviews"), `.claude/commands/ship.md` (first paragraph). Port the substance, not the wording.
Decisions — Maxi, 2026-11-05: MaexSocial is mainly written by Codex and reviewed by Claude, the same way as Maex-Voice-Agent. This replaces the 2026-11-04 charter decision "Code reviews use `gpt-6-astra`" for Codex-written work; GPT-6 Astra at `high` remains Codex's optional self-check before publishing and the reviewer of Claude-written work. Maxi also decided that Codex fixes the handover structure. Code-autopilot and caveman stay disabled.
Gate — Workflow foundation; no product-gate change. Evidence that it works: one real MaexSocial PR with a posted `@claude review` request, a published Claude COMMENT review on the exact head with inline findings, and a second review after a later push.
Open — 1. "Handover structure" PR (issue `[Maintenance] Structure handovers`). 2. MS-014 PR (issue `[MS-014] Require independent cross-model review`), branched from the first PR's branch. Both are Codex-written, so Claude reviews each with the manual procedure below; the first one is the first live test.
Lessons — Wording can reintroduce self-review: in Maex-Voice-Agent a merge-hook message told the implementing model to post its own review as the gate, and a user-level auto-mode permission rule still accepts "a code review run in this session" (tracked there in issue #207). Check commands, templates, handover briefs and permission rules, not only `AGENTS.md`. PR-specific holds belong on the PR, not in `docs/01_STATUS.md`, where they go stale on merge. A resolved thread proves nothing until the fix or rejection is verified.

## Handover structure (first PR, before MS-014)

`docs/handovers/` holds only forward-looking briefs for one line of work. The full `/handover` block of a session is never stored, only a one-line entry in `docs/01_STATUS.md`. Fix this in its own PR (`docs(handovers): add session handovers and a handover index`):

- `docs/handovers/README.md`: the two kinds and when to use each. A **brief** (`docs/handovers/<lane>.md`) assigns future work to a session or a line of work. A **session handover** (`docs/handovers/sessions/YYYY-MM-DD-<topic>.md`, one file per handover, never appended to a shared file) records where a session stopped. The template and the required fields are listed below. List the existing briefs (claude-rea, codex-rea, synthesis, build, review-workflow) with one line each.
- Template: `# Handover YYYY-MM-DD — <task IDs>`, then Status, Artifacts, Decisions, Gate, Open (next concrete action first), Lessons. Required in every handover: repository, task ID and issue, branch, full head SHA and PR, which model implements and which reviews (`Codex → Claude review` or `Claude → GPT-6 Astra review`), and a runnable start: console, folder or worktree, full start command, first message.
- Keep the existing brief paths so no links break. Add this file as `docs/handovers/review-workflow.md` (without the delivery note at the top).
- `.claude/commands/handover.md`: write the block to a new `sessions/` file, add one line with its link under "Delivered evidence and handovers" in `docs/01_STATUS.md`, commit and push.
- Hand over before context runs out: at a clean point, write the handover, commit, push, and only then start a new session.
- Update `docs/12_CLAUDE_CODE_PLAYBOOKS.md` (Handover section), `docs/README.md` and the `README.md` folder map. `python scripts/check_repo.py` must stay green; it checks local links.

## Rules to adopt (MS-014)

1. The reviewer comes from the other model family. Codex-written work: Claude reviews. Claude-written work: Codex (GPT-6 Astra `high`) reviews. Mixed work: each covers the other's changes. Another session of the same model is not independent. A self-review never satisfies the gate, also not when the other reviewer is out of quota: then the PR waits.
2. After creating the PR and after every later push, Codex posts a new top-level comment starting with `@claude review` (template below) and checks that it was posted. Never put `@claude` or `@codex` in a PR title or description: in Maex-Voice-Agent an `@codex` mention in PR text turned PR #373 into a Codex task instead of a review.
3. Until a Claude GitHub action is installed and live-tested, a mention launches nothing. Maxi starts a Claude Code session for the review. A mention without a completed review never counts.
4. The first review covers the full PR diff. A follow-up covers everything since the last completed Claude review (not only the last commit), the affected files and every open finding, with related code read as needed. Use the full diff again when the baseline is missing or the impact is unclear.
5. Every new head needs a new review; a merge from `main` moves the head too.
6. Findings go inline on changed lines. One review body summarises findings, full base/head SHAs, scope, checks run versus checks reported, thread dispositions and limitations. A finding outside the diff is anchored on the nearest changed line it depends on, or posted in its existing thread, and the summary says so.
7. Reviewer identity: findings, summaries and reviewer replies should eventually come from `claude[bot]`. Until that route exists they are posted under Maxi's account, and each review body, inline finding and reviewer reply starts with `**Claude review**`. Check `user.login` and `user.type` before claiming bot authorship.
8. Merging stays with MaexSocial's rules (`ship.md`, squash merge, owner authorization, gates). The ruleset requires resolved threads and the `foundation` and `metadata` checks with zero approvals, so the independent-review condition is procedural: `ship.md` must check it explicitly.

## Files to change in the MS-014 PR

- `AGENTS.md`: replace the GPT-6 Astra rule with rules 1–8, and add the severity and format below.
- `docs/00_PCF.md`: record the new decision next to the 2026-11-04 one, dated, and mark the old one superseded for Codex-written work.
- `.claude/commands/done.md`: "Obtain GPT-6 Astra high review" becomes "post `@claude review` and obtain a completed Claude review of the head (Codex-written), or a GPT-6 Astra `high` review (Claude-written)".
- `.claude/commands/ship.md`: no merge without a completed independent review of the exact head by the other model family.
- `.github/PULL_REQUEST_TEMPLATE.md`: replace the checkbox with "Independent review of the exact head by the other model family (link)".
- `docs/handovers/build.md`: its start prompt says "obtain gpt-6-astra high review on current head"; change to the independent reviewer.
- `docs/12_CLAUDE_CODE_PLAYBOOKS.md`, `docs/07_WORKPACKAGES.md` (MS-014 row), `docs/01_STATUS.md`.

## Severity and comment format

- `[P0]`: secrets or personal data exposed, data loss, a broken hard rule with direct external impact.
- `[P1]`: a concrete wrong outcome on a guarded path (cross-tenant access, publishing without authorization, a duplicate publish, a claim not backed by approved business facts, a budget overrun), a security gap, or broken `main`.
- `[P2]`: any other concrete defect with a failing input or sequence. No scenario, no finding; no style findings.
- One comment per root cause: `[P1] <specific title, about 80 characters at most>`, then one paragraph of about 40–100 words: trigger, wrong behaviour and impact, required outcome, a verification case. State facts and assumptions separately; code suggestions are optional and short.
- Triage by the implementer: a finding is a claim. Check it against the code, fix a confirmed one with a regression test, answer a wrong one in its thread with evidence, and resolve a thread only after a verified fix or an evidence-backed rejection. P0 and P1 always block. After three consecutive P2-only rounds, decide explicitly and record why on the PR.

## Request comment (posted by Codex)

```text
@claude review

Please perform the independent <first|follow-up> review of PR #<n>.

Base (main):            <full sha>
Last Claude-reviewed:   <full sha or "none">  <review URL>
Requested head:         <full sha>

Changes since the last review: <commits and paths>
Open or newly fixed threads: <thread URLs and what changed>
Local evidence on this head: <exact commands and results, or what was not run>

Publish a COMMENT review on the verified head with full base/head SHAs and inline findings.
Keep the branch and PR state unchanged.
```

## Manual Claude review (reviewer side)

1. Compare the live PR refs (`gh api repos/Maeximilion/MaexSocial/pulls/<n> --jq '.head.sha, .base.sha'`) with the request and the local checkout. If the head moved, review the new head.
2. Read `AGENTS.md`, `CLAUDE.md`, `docs/01_STATUS.md` and the newest handover, then the diff: the full PR diff the first time, `<last reviewed head>..<head>` plus open threads and affected context afterwards.
3. Run what is cheap and relevant (`python scripts/check_repo.py`, `python -m unittest discover -s tests`, `node --test tests/*.test.cjs`, `git diff --check`) and read CI for the exact head. Never claim a check that did not run.
4. Publish one review: `POST /repos/Maeximilion/MaexSocial/pulls/<n>/reviews` with `commit_id` set to the head, `event: COMMENT`, the summary as `body`, and each finding in `comments[]` (`path`, `line`, optional `start_line`, `side: RIGHT`). Recheck the head right before posting. Write bodies to files and pass them with `--input` or `--body-file`.
5. Reply in existing threads instead of posting duplicates.
6. Verify that GitHub recorded the review on the exact SHA, and report its URL and author.
7. Do not edit, push, run `/done` or `/ship`, or merge unless Maxi asks for it in that session. Changes Claude then makes need a Codex review before merge.

## Start

Console: Windows PowerShell, folder `C:\Users\Maxi\Documents\GitHub\MaexSocial` (clean `main`).
Full start command: `codex -C "C:/Users/Maxi/Documents/GitHub/MaexSocial"`. Then send this first message:

> Read AGENTS.md, CLAUDE.md, docs/01_STATUS.md and docs/handovers/review-workflow.md. First do "Handover structure": create its issue, a task worktree and branch, implement it, and run python scripts/check_repo.py, python -m unittest discover -s tests and node --test tests/*.test.cjs. Then open the PR with Closes #<n>, post the @claude review request and stop until the Claude review is published. Then do MS-014 the same way, on a branch based on the first PR's branch.
