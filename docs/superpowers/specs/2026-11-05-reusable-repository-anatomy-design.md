# Repository anatomy standard for MaexSocial

Design proposal, 2026-11-05. Owner direction: prove a reusable standard in MaexSocial first and defer product UI. This proposal extends the [accepted repository assessment](2026-11-05-repository-anatomy-review.md). It does not grant a product gate or change the nine-PR merge queue.

**Authoring roles.** Maxi uses ChatGPT/Codex as the primary implementation agent for MaexSocial. The Codex entry is the first path documented and exercised here. Claude may take an explicitly assigned research or review role under the current project policy. Maxi generally uses Claude Code as the primary programmer in his other repositories. A repository adopting this standard declares its own primary client and independent review route; it does not inherit MaexSocial's authoring assignment.

## Outcome

A maintainer running the manual anatomy command can answer three questions from the repository and verified GitHub state: what a visitor sees, how a task moves from issue to delivery, and which evidence allows a PR or gate to advance. Each finding names its source, the observed state, the gap and the responsible next action. The report identifies the repository, base and head. When information cannot be read, it says what was unavailable.

## Approaches considered

| Approach | Decision and reason |
|---|---|
| Import the Voice-Agent folders, workflows and plugins as a kit | Use Voice-Agent as a reference. Its telephony stack, review metrics, agent runner and local policies are specific to that project. Its [source license](https://github.com/Maeximilion/Maex-Voice-Agent/blob/b707a739d20aaa26dfb713ec7778170774ad3f51/LICENSE) reserves rights. Write the MaexSocial procedure independently. |
| Extend MaexSocial's existing commands with one shared anatomy procedure | **Selected direction.** It fits both existing agent entry points, preserves the owners of each rule and can be evaluated on real tasks immediately. |
| Publish a generic plugin or template repository now | Revisit after a second repository successfully uses the procedure with its own references. A separate distribution channel adds no evidence of portability today. |

## First deliverable

Expose a manual `source-command-anatomy` skill through Codex's native repository skill discovery. It points to the shared `.claude/commands/anatomy.md` procedure, following MaexSocial's existing command layout. Claude Code can invoke the same file as `/anatomy` where it is the chosen client. Link both entries from the existing [tooling guide](../../tooling/agent-workflow.md) and [documentation index](../../README.md), with the project's primary client first. The entry point follows the caller's scope: a repository overview or a targeted check. It reads the smallest relevant set of public tracked files and GitHub facts. It reports findings without writing files, changing settings, launching models or starting unrelated alert scans. The existing repository checker owns technical validation.

| Lens | MaexSocial evidence and expected behavior |
|---|---|
| GitHub landing page and brand | Compare the README's purpose, current stage, next step, links and accessible original artwork with [the brand guide](../../15_README_STRATEGY.md). Verify About fields, topics and uploaded preview separately from tracked assets. Distinguish product proposals from working features. |
| Structure and navigation | Identify the charter, status, work packages, decisions, security policy, operations and handovers by actual path. The [work package list](../../07_WORKPACKAGES.md) should lead to the spec or acceptance evidence. Report stale navigation instead of inventing product directories. |
| Planning and ownership | Trace the issue's owner, scope, dependencies, acceptance and milestone through the [existing Project](../../16_GITHUB_PROJECT.md). Check the PR's issue relation and whether a merge closes the whole issue or only delivers part of it. Preserve manually owned fields. |
| Delivery and maintenance | Inspect the PR template, workflow triggers, pinned actions, permissions, actual required checks and their results on the current revision. Record what post-merge exercise demonstrated separately. Route fixes to existing commands. |
| Independent reviews and stacks | Identify author and reviewer, reviewed base/head, actionable findings and unresolved threads. Distinguish a requested bot review from a completed one. Only stack genuine dependencies. Verify the parent is contained in its child and the child diff contains only its layer. Merge the eligible bottom PR individually, sync main, recheck child base/head and repeat review when it changes. Among independent ready work, use priority, then number. Finish an active dependency chain before the unrelated P2 item when the owner has specified that order. |
| Gates and handovers | Link each applicable [gate criterion](../../00_PCF.md) to evidence and owner decision. Unknown or missing evidence stays open. Use the stable [handover entry](../../handovers/README.md) for separate dated session records. Refer to `/gate` for actual gate processing. |

The reusable portion is the set of questions and the evidence format. Project identity, approved palette, gate charter, work-package index, Project, required checks, owners and current review policy come from a short map of existing sources. On another repository, replace this map. A missing capability becomes a reported gap. No new registry, scheduler, global installation or duplicate policy file is required.

## What transfers from Voice-Agent

Adopt the relationship between purpose, evidence, owner and reader shown in its [README](https://github.com/Maeximilion/Maex-Voice-Agent/blob/b707a739d20aaa26dfb713ec7778170774ad3f51/README.md), [feature issue form](https://github.com/Maeximilion/Maex-Voice-Agent/blob/b707a739d20aaa26dfb713ec7778170774ad3f51/.github/ISSUE_TEMPLATE/feature_request.yml), [Project operations](https://github.com/Maeximilion/Maex-Voice-Agent/blob/b707a739d20aaa26dfb713ec7778170774ad3f51/docs/16_GITHUB_PROJECT.md) and [review procedures](https://github.com/Maeximilion/Maex-Voice-Agent/blob/b707a739d20aaa26dfb713ec7778170774ad3f51/docs/21_REVIEW_AUTOMATION.md). Reuse existing MaexSocial templates, documented operating lessons and original assets.

- Adapt the evidence-checking idea from [gate-review.js](https://github.com/Maeximilion/Maex-Voice-Agent/blob/b707a739d20aaa26dfb713ec7778170774ad3f51/.claude/workflows/gate-review.js) in a later focused improvement to the shared MaexSocial `/gate`. First-stage anatomy reports point to the existing procedure. Gate acceptance, tags and alert checks require their own established triggers.
- Defer [review-load-audit.js](https://github.com/Maeximilion/Maex-Voice-Agent/blob/b707a739d20aaa26dfb713ec7778170774ad3f51/.claude/workflows/review-load-audit.js). Voice-Agent's PR cutoff, historical baseline, actors and measured paths do not describe MaexSocial. Reconsider with a defined local observation window, at least five comparable PRs, traceable review provenance and complete data.
- Leave Voice-Agent application folders, latency budgets, integrations, branding, hardcoded accounts, deploy jobs and private operating material in their original project. The two JavaScript files use a Claude-specific runtime. The shared anatomy procedure needs neither executable JavaScript from that repository nor Claude inference.

## Design skills

GitHub counts below are repository stars observed on 2026-11-05. They describe adoption of a collection, not quality or usage of a particular skill.

| Source | Stars | Decision |
|---|---:|---|
| [GitHub create-readme](https://github.com/github/awesome-copilot/blob/96543145e9cb97711020b57b9d88f968062c4fc7/skills/create-readme/SKILL.md) | 40,813 | Reference for a greenfield README. MaexSocial already has an established README and visual identity. |
| [good-readme](https://github.com/adewale/good-readme/blob/c40e2c3c5e2490c17d02c7c90c0e46f53cacb9df/skills/good-readme/SKILL.md) | 13 | A useful editorial comparison for the existing README. Keep reads bounded to project sources. |
| [Anthropic frontend-design](https://github.com/anthropics/skills/tree/ca45fc496a3436251f191354091d557da31c15b5/skills/frontend-design) | 187,546 | First candidate for an approved product UI later. Small text skill, explicit skill license, no design tooling required for this release. |
| [UI UX Pro Max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) / [Impeccable](https://github.com/pbakaus/impeccable) | 145,412 / 103,240 | Compare later for UI pattern lookup or a running interface audit. Neither supplies repository ownership, gate or Project rules. |

The available Design and Figma plugins can support later reviews and handoff. Installing or enabling a plugin, or running its scripts, is a separate decision. The existing MaexSocial palette governs any future design trial.

## Acceptance and delivery

1. From the repository root and a nested task worktree, verify that Codex discovers its skill and dispatches to the shared procedure. Check the Claude entry's path and report separately whether its runtime was exercised. MaexSocial delivery can proceed through its primary Codex path. Do not invoke Claude for a review while the owner's pause is in effect.
2. Run a read-only README check. Confirm the difference between a tracked preview PNG and GitHub's displayed image, and compare the research next step with the merged report and still-open research issue.
3. Trace a real issue and PR through the Project. Distinguish a closed unmerged disposable test from a delivered change using [#53](https://github.com/Maeximilion/MaexSocial/pull/53), [#54](https://github.com/Maeximilion/MaexSocial/pull/54) and [#60](https://github.com/Maeximilion/MaexSocial/pull/60).
4. Demonstrate the bottom-first review and merge rules on [#20](https://github.com/Maeximilion/MaexSocial/pull/20) and [#21](https://github.com/Maeximilion/MaexSocial/pull/21). Do not infer a merge method from the stack link. Verify current settings, actual commit and remaining child work. No write action is part of the anatomy dry run.
5. Repeat the source-mapping exercise on Voice-Agent without editing it. Verify the same questions lead to different project-specific evidence. Run the repository checks, scoped tests and a final independent review before delivery.

For delivery during Maxi's pause through the start of Monday, 9 November 2026 (Berlin), the independent Codex reviewer uses GPT-6 Astra with high reasoning on the final commit, and the owner chat mentions `@codex review` on that commit. Record the local verdict and the bot response separately. Resolve actionable findings, check required CI and open threads, and repeat the affected verification after any push. This is sufficient during the pause. On later dates consult the project's then-current owner instruction; choosing a primary programmer does not choose the reviewer for every repository.

The first implementation is the shared command, its wrapper, discoverability links and a small regression check for that wiring if existing tests do not cover it. Handle broader kit changes in the already accepted [delivery sequence](2026-11-05-repository-anatomy-review.md#delivery-sequence-and-acceptance). The owner reviews this design before implementation.
