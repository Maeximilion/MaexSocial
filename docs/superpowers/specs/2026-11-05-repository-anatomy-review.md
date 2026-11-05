# MS-015 — Repository anatomy assessment

Status: assessment awaiting independent review, 2026-11-05. [Task #49](https://github.com/Maeximilion/MaexSocial/issues/49). Codex authors; Claude independently reviews. This document proposes follow-up work; it does not change review policy, merge settings, hooks, history storage or any product gate. O1 and O2 are accepted below; implementation waits for the published Claude review and triage of its findings.

## Recommendation and scope

Keep MaexSocial's small numbered entry documents, topic folders, shared hook and thin command wrappers. Reduce routine writes to shared status/history files; retain separate session records. Adopt the owner-selected cross-model review procedure through one focused rules PR. Add only tooling that has a concrete consumer: no copied Voice-Agent application folders, status-version script, merge hook or hosted reviewer service.

The owner supplied `C:/Users/Maxi/Documents/MaexSocial-architecture-kit/`: README, HANDOVER, eight topic papers (06–08 were supplied during assessment) and seven draft templates. All were read. The kit is evidence and proposed options, except its explicit owner decisions. This assessment covers every numbered candidate, the review, stacking and autonomy rules, and all templates. Findings below concern repository/workflow design, not a code-review certification.

Already decided by Maxi: Codex-written work receives Claude review; Claude-written work receives GPT-6 Astra high review. Repository patterns must be assessed rather than copied. Status should not require constant upkeep. MS-014 remains upload security (#43); this assessment uses the next free ID, MS-015.

Later owner instructions on 2026-11-05 supersede the kit's disabled-skill statements: use the canonical local Code Autopilot and Caveman skills (Caveman lite); synchronized duplicates remain disabled. The canonical files were read and contain Codex adaptations. This establishes the requested working practice, not verified behavior in every runtime. Ponytail covers reviews and small/medium tasks; Superpowers covers larger design/planning, without duplicate loops or new delegation authority. Repository instructions still contain the older disabled wording; reconcile it in the later rules change. Advisory Security/Quality/Dependabot checks run only on an explicit `/start` or `/task`, never implicitly or on a timer; the paused automation stays paused. Required task CI is separate.

Updated owner instruction received during this assessment (2026-11-05): workflow reminders and quality hooks should be advisory, without stopping/pausing tasks or forcing extra agents or remediation chats. Model routing retains its explicit decision pause. Credential-protection checks, required CI and product approvals remain separate controls. This changes the hook recommendations below, not any running hook configuration. The assessment-review prerequisite still applies; local reviewer startup is now expressly authorized.

Further owner instruction: open normal PRs, not drafts, unless explicitly requested. PR #52 was verified non-draft before this update. Pending checks/review remain explicit limitations and never become merge authorization. From kit step 2 onward, continue authorized dependent work in stacked PRs rather than waiting for a lower PR to merge; the assessment/review and owner-decision prerequisite still applies.

O2 accepted by Maxi on 2026-11-05: **allow merge commits for PR chains**. Squash may remain available for standalone PRs; rebase merging is not requested. This is recorded authority for the later settings/procedure change, not a claim of activation. Live settings were still squash-only during this assessment.

O1 accepted by Maxi on 2026-11-05: **use a static session-folder pointer**, replacing the mandatory new status line per session handover. Status is updated for actual gate, work-lane or blocker changes. The separate session records and their provenance/start requirements remain. This supersedes the earlier per-handover-link instruction for the later implementation; existing records are preserved. Both owner decisions are resolved; implementation still waits for the independent assessment review.

The updated HANDOVER also authorizes the autonomous PR loop, local headless Claude reviews now (option B), a hosted Action later as a separate task, reaction signals, and a Codex entry document with adapted skills/agents. The local reviewer may read and publish review evidence, never edit or push. For this assessment's first local review only, Maxi explicitly accepted the existing versioned manual procedure from PR #47, avoiding implementation of the future review skill before the assessment gate. This exception does not authorize kit steps 2–7 early.

## Evidence and corrections

Repository facts were read from Git objects at these full SHAs, not inferred from whichever branch a local folder displayed:

- **S:** MaexSocial main `b9e08c79415d85779bcac39c739f5d4a8ae9070e` ([tree][S]).
- **S2:** main `fc335a0c8b1486fe7c36904eba3c5c2480bf6c35` after PR #51 merged during this assessment. Original S measurements remain pinned historical observations; the hosted-review observations below use S2. S2 was merged into this task branch before the follow-up review.
- **V:** Maex-Voice-Agent main `65ed60fa60ba137c884d05b5119d45ec7979ab53` ([tree][V]). The reference checkout was not edited or switched; its remote refs were fetched.
- **H:** pending MaexSocial [PR #47](https://github.com/Maeximilion/MaexSocial/pull/47), head `072fbdc1a1bbd2b80e528a6964466dd53ed5140a`. Its handover index/template and session file already implement part of kit 02, but are not on main. No Claude review was published at inspection. Preserve this work; do not implement a competing handover tree.
- Live GitHub REST observations on 2026-11-05: branch rules, repository merge settings, security/default-CodeQL setup and reference PR #542 reviews/comments. These are point-in-time observations, separate from the checked-in ruleset files.

| Kit claim | Verification and implication |
|---|---|
| Voice-Agent has 1,201 non-merge commits, 752 merges; 644 non-merge commits touch status | Reproduced at V with `git rev-list --count`. That is 53.6% status touch frequency, not a measured conflict probability. |
| MaexSocial: 10 main commits, 9 touch status | Reproduced at S; also 8 touch `CHANGELOG.md`. Frequent shared edits are established; this does not prove they caused conflicts in MaexSocial. |
| Document sizes | Reproduced with UTF-8 `splitlines()`: V charter 1,496, status 1,352, CLAUDE 366, AGENTS 158, voice-layer 1,045; S status 60 and all numbered docs 775. V's handover-history heading begins at line 538 (roughly 959 lines to EOF), so “about 920” is approximate. |
| Replay: 313 merges, 228 conflicts, 217 in status; counterfactuals 222/117/60 | **Not independently verified.** The kit supplies no replay script, merge list or raw results. V's [D22 entry][V-status] instead records 95 merges, 68 conflicts, 62 in status and counterfactuals 55/23; it still lists the restructure as open with Maxi as owner. These can be different samples, not automatically contradictory. Do not quote the kit's larger sample as reproduced or promise its reductions. A subject-based count at V finds 335 main-merge messages; it does not reconstruct the historical 313 sample. |
| Reading shrank from 476 KB to 49 KB; D22 is a decided 2026-10-29 fix | The byte claim is recorded in D22, not measured here; its checked-in entry is dated 2026-10-19 and remains open. The kit alone does not prove acceptance of the complete proposed fix. MaexSocial does not inherit that authority. |
| Voice-Agent requires resolved review threads | **Incorrect at V and live inspection.** `required_review_thread_resolution` is false. The reference requires merge-only and strict `test`, `docker-smoke`, `title`, `dependency-review`, with zero approvals. Preserve MaexSocial's stronger thread-resolution setting. [V rules][V-rules] |
| MaexSocial allows every merge method | Incomplete: its checked-in ruleset omits the field; live branch rules allow merge/squash/rebase, but repository flags allow **squash only** (`allow_merge_commit=false`, `allow_rebase_merge=false`). Effective behavior matches [ship](../../../.claude/commands/ship.md). Changing method requires both settings and procedure. [S rules][S-rules] |
| Reference manual Claude review ran four times on #542 | Verified four substantive review summaries across four heads, plus six empty-body review records associated with inline/reply activity. Ten API records must not be described as ten independent review rounds. All published as `Maeximilion`, type `User`, not a bot. [First review][V-review-first], [final review][V-review-final], [relay][V-relay]. #542 merged as V. The relay reports verified fixes; this assessment did not rerun Voice-Agent's tests or independently re-review those fixes. |
| Hidden permission wording still permits self-review | The [#542 relay][V-relay] identifies `docs/19_CLAUDE_CODE_SETUP.md` and user-level auto-mode wording as outstanding under #207. This supports a reported gap, not proof of currently active user settings. No personal permission file was inspected or changed. |
| Kit 01/03/04 inventories | File inventories confirm numbered core/topic documents, V's lack of `docs/README.md`, Spec columns, nine versus eight commands, grouped V Dependabot config and the named workflows/hooks. V embeds command text in Codex wrappers and has two sync scripts; S uses pointers and one shared Stop script. Configuration presence is not evidence of loading, successful hook execution or claimed historical causation. [V docs][V-docs], [V tooling][V-tooling], [S tooling][S-tooling] |
| Security and automation state | Live S flags confirm secret scanning, push protection and Dependabot security updates enabled; default CodeQL is configured on both repositories. S's strict required checks remain `foundation` and `metadata`, with zero approvals and thread resolution. No setting was changed. |

Reference anecdotes such as a stale clone being 192 commits behind, ten agents draining quota, and shell receiving “most” review findings are historical reports in the kit/reference instructions. They were not independently measured and do not justify new MaexSocial automation by themselves.

### Reproduction notes

Run in each repository with its pinned SHA above (substitute the literal full SHA for `<SHA>`):

```text
git rev-list --count --no-merges <SHA>
git rev-list --count --merges <SHA>
git rev-list --count --no-merges <SHA> -- docs/01_STATUS.md
git rev-list --count --no-merges <SHA> -- CHANGELOG.md
git ls-tree -r --name-only <SHA>
git show <SHA>:docs/01_STATUS.md
```

Line counts used Python `len(subprocess.check_output(['git', 'show', sha + ':' + path]).decode('utf-8').splitlines())`, including blank lines. The numbered-doc total includes paths matching `docs/\d\d_[^/]+\.md`. REST reads used `gh api repos/Maeximilion/<repo>/rules/branches/main`, the repository endpoint for merge/security flags, `code-scanning/default-setup`, and `pulls/542/reviews`, `pulls/542/comments`, `issues/542/comments`. No private tokens or raw authenticated captures are part of this report.

## Candidate decisions

“Adopt” means recommended for the later scoped implementation (or retain if already present), not implemented here. “Adapt” changes the proposed mechanism; “reject” includes explicitly deferred machinery with a stated revisit condition. Evidence keys refer to the pinned sources above and the file links below.

### Kit 01 — Documentation

| ID / candidate | Assessment | MaexSocial reason and resulting scope |
|---|---|---|
| D1: fixed core versus more numbered files | **Adapt:** keep every existing numbered path; add new depth in topic folders. | S has only 775 numbered-document lines and a usable index. Preserve `12`, `15`–`18` too; no mass migration or filling unused numbers for symmetry. [Docs index](../../README.md) |
| D2a: architecture pair | **Retain/adapt:** responsibilities and invariants in `02`; proposed layout in `architecture/README`. | These already link to each other and answer different questions. Both remain G2 proposals; a folder diagram is not a deployed security boundary. [02](../../02_ARCHITECTURE.md), [layout](../../architecture/README.md) |
| D2b: playbook/tooling pair | **Adapt:** procedures in commands, session guidance in playbooks, loading/configuration in tooling. | Remove repeated procedural detail only when it disagrees; link shared commands instead. Do not merge different audiences into another always-read long file. [Playbooks](../../12_CLAUDE_CODE_PLAYBOOKS.md), [tooling][S-tooling] |
| D2c: access/upload pair | **Reject consolidation.** | MS-013 owns identity/tenant authority; MS-014 owns hostile media and delivery. Cross-link shared tenant requirements; preserve ACCESS/UPLOAD acceptance IDs and their separate dependencies. [Access](../../17_ACCESS_SECURITY.md), [uploads](../../security/uploads.md) |
| D3: rename misleading `12` and `15` filenames | **Reject now:** retain paths and explain scope in titles/index. | Internal-link checks cannot preserve old external GitHub URLs or pasted prompts. Existing titles already describe shared agents and branding. No navigation failure warrants redirects and churn. |
| D4: one decision authority | **Adapt:** extend existing ADR practice with explicit date, decider, status and supersession links. | Keep historical charter decisions as historical, link to their replacements, and let status point to current decisions. No second parallel decision log. Operational rules remain concise in AGENTS; rationale/acceptance links live in docs. [ADR 0001](../../decisions/0001-application-language.md) |
| D5: index “Read before” column | **Adopt.** | Add triggers to existing rows; preserve all links. Read boundaries/contracts for the touched work, not the entire archive every session. S already has the index V lacks. |
| D6: Spec link per work package | **Adopt.** | S's deliverable rows mostly link issues, with specs dispersed below the table. Add a primary spec/acceptance pointer per task; keep gates and dependency IDs authoritative. [Work packages](../../07_WORKPACKAGES.md) |
| D7: machine-written history and union | **Adapt:** separate immutable run artifacts when actual eval/cost runs exist; reject automatic union adoption. | Unique run IDs and a reader/aggregation step avoid shared-line conflicts. Decide format with the first real consumer. Neither a directory nor union ensures valid, ordered or deduplicated measurements. |

### Kit 02 — Status, history and handovers

| ID / candidate | Assessment | MaexSocial reason and resulting scope |
|---|---|---|
| H1: status changes only with state | **Adopt**, with O1 now accepted by Maxi. | Keep stage/gates, lane state, next action, blockers, evidence limits and decision/history pointers within roughly 80 lines. That is a readability target, not a line-count CI gate. PR checks/holds/results stay on the PR. Gate evidence remains mandatory. |
| H2: one changelog fragment per PR | **Adapt:** fragments for meaningful user/maintainer behavior; no compulsory fragment for every research correction or handover. | Unique issue-plus-topic names avoid collisions across multiple PRs on one issue. At a gate/release, a focused PR compiles deterministically and removes only the compiled fragments. Require tests for ordering, duplicates, invalid metadata and repeat execution; never erase uncompiled history. Preserve existing changelog content. |
| H3: union-merged history/changelog | **Reject for the selected design.** | Git documents line preservation with potentially arbitrary ordering, not semantic correctness. Different edits can survive as contradictory records. GitHub conflict checks, Update branch and squash behavior remain untested; no hosted experiment or throwaway branches were created because this recommendation does not rely on union. Revisit only if unique files fail a demonstrated need. [Git merge attributes][git-union] |
| H4: separate session files, optional status link | **Adopt the separation; adapt H from PR #47 after review.** | Retain its six sections, full work-head SHA, provenance and runnable start. Prefer a static folder pointer over a new shared index line every time (O1). Require unique topic suffixes: separate files alone do not guarantee different paths. Do not overwrite completed records; add a dated correction/successor when needed. |
| H5: status version per gate | **Reject adding a status version.** | S has none. Gate dates, acceptance evidence, Git commits and tags already identify state. Do not import `status_bump.py`. |
| H6: validate session structure | **Adapt:** small structural check in existing `check_repo.py` when the format is implemented. | Limit to actual session records, not lane briefs or example templates: six headings, required metadata and full work SHA; unit-test missing fields and the template exception. A format check cannot prove a PR, push, review or start command actually ran. No validator changes in this PR. |

Snapshot/history split: current lane state can be replaced; a historical claim belongs in a dated record. A session keeps the checks/results known at its stopping point with tested SHA; live holds and updated checks stay on the linked PR. Do not require constant edits to historical handovers merely because CI later finishes.

### Kit 03 — GitHub

| ID / candidate | Assessment | MaexSocial reason and resulting scope |
|---|---|---|
| G1: required dependency-review check | **Adapt:** add in its own verified workflow PR; make required only after successful real runs. | Useful for current Actions dependencies and future npm dependencies; public-repository availability is documented, but graph coverage and workflow success must be observed. Pin the action, use read permissions, fail on high/critical introductions, keep it always running and test a harmless fixture change plus the failure policy. No new check required before it exists. [Dependency review][dependency-review] |
| G2: automatically close outside PRs | **Reject for now; retain manual owner review/contact policy.** | Public visibility does not grant contribution rights, but S's [Contributing](../../../CONTRIBUTING.md) does not authorize automatic closure. No measured abuse merits a new privileged writer. If requested later, owner selects the allowed actors and response; never execute fork code with privileged credentials. |
| G3: merge method | **Adapt:** Maxi accepted O2, allowing merge commits for dependent PR chains. | Preserve the no-cascade-rebase rule: merge the live trunk into the next eligible branch, resolve actual conflicts and renew checks/review. Merge commits preserve ancestry and simplify that sequence; they do not eliminate genuine overlapping-edit conflicts or strict-check updates. Settings remain squash-only until the authorized later implementation. [GitHub merge methods][merge-methods] |
| G4: always-running required checks | **Adopt/retain.** | Keep `foundation` and `metadata` unfiltered. Add application checks with application code, not empty jobs now. Also adapt V's concurrency distinction: cancel superseded PR runs, give main runs unique groups so a newer push does not cancel evidence for an earlier main commit. S currently groups all main runs together. [S CI][S-ci], [V CI][V-ci] |
| G5: verified-only template checkboxes | **Adopt.** | Retain S's headings; explain unchecked pending work versus reasoned “not applicable”, tested revision and local versus hosted checks. Replace the review checkbox in the review-rules PR; don't tick Astra-only wording for a Claude review. |
| G6: live ruleset versus checked-in JSON | **Adapt:** compare normalized policy fields after authorized setting changes; defer a scheduled drift checker. | The current merge-method discrepancy includes repository flags, not only the ruleset. Ignore server IDs/default-field serialization when comparing; preserve strict checks, zero bypass actors and S's thread-resolution rule. Do not copy V's false thread-resolution setting. |

Retain S's event-plus-hourly metadata/Project reconciliation, tested metadata helpers and trusted-main checkout for Project operations. V's separate daily job adds no demonstrated coverage here. Keep current Actions-only Dependabot coverage until real manifests/images exist; group future ecosystem updates only when their compatibility tests justify it. Retain original static artwork; do not import generated Voice-Agent charts or its `linguist-generated` rules for files that are not generated. No Windows printbridge, voice container or Docker smoke job belongs in this G1 repository. [S workflows][S-workflows], [V workflows][V-workflows]

### Kit 04 — Agent folders and scripts

| ID / candidate | Assessment | MaexSocial reason and resulting scope |
|---|---|---|
| A1: automatic SessionStart main sync | **Reject for now/defer until repeated local drift is demonstrated.** | Keep explicit fetch and clean-main fast-forward. A hook can run in a task worktree and race another session in the canonical checkout. If later justified, one shared tested script must validate canonical path, branch and cleanliness, never switch/stash/reset, and report conflicts without blocking the task. A configured hook still needs actual platform/trust verification. |
| A2: local merge gate | **Reject blocking workflow hooks under Maxi's updated instruction.** | A CLI allowlist cannot cover GitHub UI/API merges and no MaexSocial bypass incident is established. Keep live rules and exact-head review/owner authorization as separate delivery conditions. Any later local workflow reminder is advisory; importing V's fail-closed workflow gate would need a new explicit owner decision. |
| A3: review-request/wait helpers | **Adapt:** start with the manual procedure; add one small tested helper if repeated requests justify it. | It must use live base/head, last completed review, changed files and open threads; distinguish requested/pending from completed and reject stale/unattributed results. No background polling service, same-family fallback, new dependencies or automatic reviewer launch. This session's manual requests already show the fields that need care. |
| A4: reviewer definitions | **Adapt:** retain Astra high for Claude-written changes; document Claude's manual route first. | A `.claude/agents/reviewer.md` is optional once its actual use is established. A definition does not start a reviewer, grant permissions, establish model identity or make a same-family reviewer independent. Keep the research agent separate. |
| A5: thin CLAUDE and wrappers | **Adopt/retain.** | S already imports AGENTS and its wrappers read shared commands. Fix the source command once; do not generate copies or transplant V's long always-read rulebook, model table or automatic skill activation. |
| A6: user-level setup documentation | **Adapt only when a concrete external setting is needed.** | Add the relevant command, observed activation, date, backup and rollback route in `docs/tooling/`; reference Maxi's existing Windows rollback register. Do not inspect secrets or change global permissions merely to complete an anatomy checklist. |

Adapt the shared Stop checker and its targeted tests in the later agent-tooling PR to the new advisory preference: retain useful diagnostics, avoid blocking decisions or forced continuation/remediation rounds. Its current configuration is not proof of compliance or activation. Keep real credential guards, required CI and product gates separate; do not weaken those to make a warning advisory. Long-lived nontrivial helper logic belongs in a tested script; ordinary one-command Markdown procedures do not need wrappers. Saved multi-agent workflows and agent-limit/routing hooks are not justified by this assignment and confer no delegation permission; the existing model-router decision pause remains the owner's explicit exception. [S tooling][S-tooling], [V tooling][V-tooling]

### Kit 05 — Review rules already selected by the owner

| Rule | Assessment and wiring for the later review PR |
|---|---|
| R1: other model family; mixed work; quota exhaustion | **Adopt.** Codex → Claude; Claude → GPT-6 Astra high; mixed changes need coverage of the other family's contributions. For human/Dependabot changes with no model-authored contribution, retain the owner's existing GPT-6 Astra high default; model-written fixes still require the other family's review of those contributions. This preserves existing policy for the otherwise unassigned case, not a new owner decision. An unavailable reviewer leaves the PR waiting. Never infer provenance from Git commit author alone. |
| R2: new top-level request after opening and each push | **Adopt.** Verify posting and include full base/head, last completed review, scope and evidence. Mentions belong in request comments, not PR titles/descriptions. |
| R3: reviewer launch | **Adapt to the owner-selected local route and current S2:** Codex starts local headless Claude (kit 07 option B). The newly merged advisory Action now also launches on pushes and trusted mentions; it does not satisfy the required result/model contract. Coordinate existing jobs before starting locally, and reconcile duplicate triggers in the rules PR. Hosted replacement of the local route remains a separate task. No secret or bot installation in this assessment. Use the approved manual-procedure exception until the repository skill exists. |
| R4: full first diff, scoped follow-up | **Adopt.** Follow-up covers every commit since the last completed reviewer head, affected context and all open findings; fall back to full diff without a valid baseline. |
| R5: every new head needs review | **Adopt.** Includes merges from main and fixes by the reviewer; changed ownership may require the other model. |
| R6: inline findings and one summary | **Adapt:** publish genuine findings inline with a verified head and full base/head scope in the summary. If none exist, publish the completed summary with no invented comment. Outside-diff findings need a justified changed-line anchor or existing thread. |
| R7: reviewer identity | **Adopt manual attribution now; defer bot identity until verified.** Each manual review body/finding/reviewer reply starts `**Claude review**` or the corresponding Codex label; inspect `user.login` and `user.type`. Never claim a bot author from prose. |
| R8: procedural gate and merge authority | **Adopt**, keeping S's actual controls and O2 separate. `/ship` verifies exact-head independent evidence and dispositions in addition to checks/threads and owner merge authorization. Zero required approvals cannot technically enforce model-family independence. |
| Severity, format and triage | **Adopt:** P0 exposure/data loss/direct hard-rule impact; P1 concrete guarded-path/security/main failure; P2 other reproducible defects. One root cause, specific short title, trigger/impact/outcome/verification in about 40–100 words. Distinguish assumptions. Confirm before fixing, regression-test logic fixes, reject with evidence, resolve only after verification. P0/P1 block; after three consecutive P2-only rounds explicitly decide and record disposition. No style findings or forced inline comments. |

Implementation coverage must include every conflicting occurrence, not just the kit's initial file list: `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, charter decision history, `.claude/commands/done.md` and `ship.md`, the evidence researcher's routing sentence, `.codex/agents/reviewer.toml`, PR template, playbooks, build brief, `docs/tooling/agent-workflow.md`, `docs/16_GITHUB_PROJECT.md`, `docs/08_EVALS.md`, `.github/workflows/claude-review.yml` and the generated Dependabot task body in `.github/workflows/issue-maintenance.yml`. The generated task must name R1's default and account for model-authored fixes; test the generated wording in the existing metadata fixtures. In the same rules PR reconcile the stale disabled-skill wording in AGENTS, CLAUDE, charter, status, playbooks, tooling, Project docs and `.claude/commands/handover.md`; preserve dated historical records rather than rewriting past events. Search all restatements again at implementation time, including root instructions supplied to the session. Keep Codex wrappers pointing to shared commands. No global preference or permission-file change here.

### Kit 06 — Stacked PRs (added to the assessment on 2026-11-05)

The guide is a proposal, not proof of MaexSocial runtime behavior. The installed Windows GitHub CLI is `C:/Program Files/GitHub CLI/gh.exe`, version 2.101.0; `gh extension list` and `gh stack --version` show **github/gh-stack v0.3.0**. `link` and `merge` help run successfully in PowerShell. Thus the kit's “Ubuntu only” installation claim is stale. Nothing was installed, upgraded or configured here; no Windows rollback entry or installation approval is needed for using the existing tool. Live repository flags still permit only squash and have `delete_branch_on_merge=true`.

| Candidate/rule | Assessment and boundary |
|---|---|
| K1: waiting PRs and coherent layers | **Adopt with dependency checks.** Branch the next authorized, unblocked task from the waiting lower PR and set that branch as the PR base. Keep one behavior per PR. Independent work can still use main without an artificial dependency. A waiting review must not idle unrelated authorized work; it does not remove the assessment/owner-decision prerequisite or product gates. |
| K2: link each chain, including other sessions | **Adapt:** inspect live bases, heads and existing stack membership; link a linear chain by explicit PR numbers and actual trunk. |
| K3: bottom first, each with checks and review | **Adopt.** Verify the bottom PR number, current base/head, CI, independent review and owner merge authority immediately before any merge. One operation per eligible bottom PR. Never use the stack number, no argument or a higher PR with `--yes`: that can merge multiple members. |
| K4: `gh stack merge` for native stacks | **Adopt the documented command, with live merge validation still pending.** Installed help confirms atomic merging through the selected PR. It has no `--match-head-commit` flag; the current CLI cannot provide the same explicit head-lease guarantee as ordinary `gh pr merge`. Recheck heads and keep the branch idle; do not claim a race-free exact-head enforcement mechanism. Plain merge rejection for native stacks was not probed here. |
| K5: auto-delete and retarget | **Adapt:** keep the existing repository auto-delete setting; do not pass `--delete-branch` on a base used by another PR. Verify the successor's actual base after merge rather than assuming it changed to main (the stack can have another trunk). Live post-merge behavior remains untested. |
| K6: merge main only when next to merge | **Adopt for delivery synchronization.** Fetch/read while waiting, but integrate the actual trunk and resolve conflicts only when the PR becomes the next eligible member. Needed lower-branch fixes can be integrated earlier deliberately; every changed head needs new CI and review. |
| K7: no stack sync/rebase/submit | **Adopt the workflow prohibition.** Use ordinary commits/pushes and `link` by PR number. Avoid cascading history rewrites or automatic PR creation. The kit overstates that every such invocation necessarily changes/force-pushes every head: behavior depends on command/options and actual history. The operative risk is multi-branch rewriting, not a guaranteed effect on every run. |
| K8: fix the lower branch | **Adopt.** Fix a finding on the branch that owns it. Updating that branch alone does not move upper branch refs; they change only when explicitly integrated/rebased. Avoid copying the same correction into every upper branch. |
| Per-PR evidence and metadata | **Adopt.** Each delivery PR has its own task link, base-aware review request and latest verified review. A handover lists bottom-to-top PRs with head SHA and last completed review. A non-main base may not activate issue-closing semantics until final integration; verify native issue links/state then. |
| Placement/helper | **Adapt:** put concise rules in AGENTS, procedure in playbooks/ship, and command evidence in tooling docs in the later scoped PR. Add a linking helper with tests only if repeated real chains justify it. Do not transplant Voice-Agent's helper or mutate unrelated sessions' branches during this assessment. |

For K2, reject forks, cycles, missing/unrelated PRs or ownership uncertainty rather than choosing a chain silently. The tested command was `gh stack link --base dev-codex/stack-probe-20261105-base --open 53 54`. Explicit PR numbers avoid the branch-argument path that can push branches and create PRs automatically; `--open` honors the normal-PR preference. Existing real PRs were all based on main at inspection, so none needed relinking. `link` registers the remote stack without local tracking; `gh stack view --json` then reported the current branch was not part of a locally tracked stack. Verify remote membership through GitHub instead of treating that local error as failed linking. [Versioned gh-stack documentation][gh-stack-v030]

#### Throwaway two-PR test and its limits

The user-requested experiment used a dedicated remote trunk `dev-codex/stack-probe-20261105-base` at `b9e08c79415d85779bcac39c739f5d4a8ae9070e`. Neither test PR targeted main. Each added one harmless Markdown fixture:

| PR | Base | Head SHA | Observed result |
|---|---|---|---|
| [#53](https://github.com/Maeximilion/MaexSocial/pull/53) | disposable trunk | `cb20c95cd065088551335d9e9914011b65ef45ad` | Normal PR; own one-file diff; foundation and metadata passed |
| [#54](https://github.com/Maeximilion/MaexSocial/pull/54) | #53's branch | `85822ae2ec4984de18c6d5c1dc8d759da3e83737` | Normal PR; only the upper fixture in its diff; foundation and metadata passed |

`link` created [native stack #55](https://github.com/Maeximilion/MaexSocial/stack/55). A subsequent GraphQL query of both PRs' `stack { number baseRefName }`, `headRefOid` and `baseRefName` confirmed membership, the custom trunk and unchanged heads. Repository validation passed on the top fixture revision. Manual review requests were posted on both fixtures; no completed review is claimed. Both PRs were then closed **unmerged**, top first, with `mergedAt=null`; their refs remain available for a deliberately resumed merge-path test. Main's SHA was checked unchanged before and after. No branch-delete, ruleset change, install, rebase or force-push occurred.

Four isolated local Git scenarios were also run with assertions (in ignored `work/`, no network): start a trunk; add `lower.txt=v1` on lower; branch upper and add `upper.txt`; optionally change lower; integrate lower into trunk using squash or a merge commit; merge trunk into upper. Each result was asserted, including conflicted paths:

| Integration into trunk | Lower change after upper branched | Merge into upper |
|---|---|---|
| Squash | None | Exit 0, clean |
| Squash | Change `lower.txt` to v2 | Exit 1, add/add conflict in `lower.txt` |
| Squash | Add a different `lower-extra.txt` | Exit 0, clean |
| Merge commit | Change `lower.txt` to v2 | Exit 0, clean |

This supports the ancestry concern but corrects “a later lower change causes conflicts”: some do, some do not. Rewriting/pushing a lower branch likewise does not automatically move every upper head. GitHub's live atomic merge, automatic base retargeting/deletion, plain-merge rejection and strict-check behavior were **not** exercised. The disposable non-default trunk has no main ruleset, so its passing CI/link test could not prove protected-main merge eligibility even if it had merged. Resume a bottom-only test with the chosen supported method and the required review/authority before relying on the full delivery procedure; never weaken main protection to make it pass.

### Kit 07 — Autonomous PR loop and local reviewer

At V, `done.md` explicitly hands off once to `ship.md`; `ship.md` distinguishes manual Claude review from its Codex waiter. `scripts/codex_review.py` uses Codex-specific summary state, bot identity and unresolved threads, with exits 0–4 and bounded waits. It is a useful interface reference, not a Claude parser to copy. Its reported timing and stalled-run anecdotes are not measured Claude latency. The current MaexSocial commands contain neither this loop nor a Claude waiter.

| Candidate | Assessment and acceptance boundary |
|---|---|
| L1: `done` → `ship`, one owner of the loop | **Adopt.** Continue in the same session after a successful normal-PR publication; resume an existing shipping operation once. Explicit pauses and missing credentials still apply. Stack other authorized tasks while reviews wait; do not spawn another chat automatically. |
| L2: review record and result line | **Adapt.** Require a submitted COMMENT review from the expected account, exact `commit_id`, `**Claude review**` prefix, submission after the latest request, recorded base/scope/model/effort and a final exact result line. Read all pages. Reject malformed, missing, stale, dismissed or contradictory evidence; a reply/empty review is not completion. Read unresolved threads from all authors, including the advisory bot: required thread resolution has no reviewer-family exception. The prose label identifies declared provenance, not cryptographic proof of which model ran. |
| L3: reactions | **Adopt as display only.** Track/remove the run's `eyes` reaction ID, add `+1` only after clean publication; reconcile stale run-owned signals without deleting unrelated user reactions. Same-account reactions cannot prove reviewer identity. A reaction/API failure never turns missing review evidence into clean. |
| L4: local Claude option B | **Adopt the decided route.** One local run per repository/PR/head, coordinated across callers and observed hosted jobs; log head, start, request and exit outside tracked files. Retain the independently authorized S2 hosted triggers, including drafts and Dependabot coverage. They consume additional usage: await their completion before the required local follow-up, then triage all results. This assessment does not authorize pausing them; changing that coverage needs an explicit owner choice in the future hosted-route task. Do not duplicate an active local run or retry without evidence of failure. Fact-only prompt links the repository procedure. Limit tools to reading and review/comment/reaction endpoints; no edits, pushes, merges, arbitrary shell, unrequested agents or permission bypass. Verify actual model/effort and publication, not exit 0. |
| L5: timeout, CI and findings | **Adapt.** Use bounded waits (initial pilot limit 20 minutes, then measure), short polling and explicit API errors. Timeout/crash/unpublished output means not reviewed. A new head invalidates old readiness; avoid concurrent review runs while fixing failed CI. Answer findings before one push per round, with a regression check for substantive logic fixes. Never manufacture a finding or an extra push to demonstrate a second round. |
| L6: merge and cleanup | **Adopt within the owner's authorization.** Verify current required CI, exact-head independent review, resolved threads, scope/gates and the next eligible stack member. Review-loop limits prompt a concrete owner decision; they never waive P0/P1 or convert unresolved findings to clean. Verify MERGED remotely, fast-forward clean canonical main, and remove only this task's clean worktree/local branch after checking no successor/session needs it. Preserve unknown work; no forced cleanup. |
| L7: `claude_review.py <PR> [--wait]` | **Adapt the interface, implement later with stdlib/tests.** Exits 0 clean, 1 findings/open threads, 2 incomplete, 3 stalled, 4 API error; do not post from the waiter. Clean requires both valid review evidence and resolved/dispositioned threads. Test exact/stale heads, latest-request ordering, pagination, spoofed labels/wrong account, contradictory summaries, empty replies, API failures and timeout; re-read head before returning readiness. A later push still requires a final merge-time check. |
| L8: hook and hosted Action | **Reject the copied blocking workflow hook.** Ship enforces the agreed review/CI checks; workflow hooks remain advisory. Preserve real secret guards, required CI and product gates. The existing Action is live; its migration to the required reviewer role is deferred. Reconcile its triggers and result protocol before relying on it or retiring B; do not create a duplicate hosted-review task or claim this assessment activated it. |

Windows Claude Code 2.1.304 exposes `--print`, `--model`, `--effort`, `--tools`, `--restricted`, `--strict-mcp-config`, `--permission-mode` and `--permission-prompts`; `claude auth status` reported not logged in. Ubuntu on the same PC has Claude Code 2.1.318, those options and an active Claude login; its `gh api user` returned the expected GitHub login. No credential was copied or published. Neither platform's inspected user settings supplied `model`/`effortLevel`; use the owner's stated Opus/high route explicitly and record the resolved model from the run. Help/auth checks do not prove a completed review. Use the Ubuntu installation for the authorized first pilot; keep Windows/Ubuntu paths and Git worktree metadata differences explicit. [Claude CLI][claude-cli], [permissions][claude-permissions]

[PR #51](https://github.com/Maeximilion/MaexSocial/pull/51) merged at 2026-11-05 01:17:25 UTC as S2, while this assessment was in progress. The earlier inspection of its `f2d5829692f441d28007c6c14ced76fa78a205fc` head is superseded for current automation state. S2's `claude-review.yml` runs on same-repository PR pushes and trusted comments containing `@claude`. The first local request therefore also launched a hosted Sonnet run, which posted [an advisory summary](https://github.com/Maeximilion/MaexSocial/pull/52#issuecomment-6646960205) and an inline finding. Its summary explicitly says the requested Opus/high route was not used and no completed exact-head COMMENT summary was published. The resulting empty-body review record is not completion under L2. The flag finding was independently checked against installed help, answered and resolved; all bot threads still need disposition under the existing ruleset. L4 addresses duplicate usage and sequencing. Preserve the delivered workflow, but reconcile its triggers and contract before adopting it as the authoritative reviewer. A successful job does not prove a completed independent review.

### Kit 08 — Codex instructions, skills, agents and durable lessons

Official Codex guidance confirms one instruction file per directory, preferring `AGENTS.override.md`, then `AGENTS.md`, then configured fallback names. A fallback `CODEX.md` does not supplement an existing AGENTS file. Therefore use an explicit AGENTS read instruction, not a global fallback-setting change. This assessment has not created CODEX.md or claimed a fresh-session loading test. [Codex instruction discovery][codex-instructions]

| Candidate | Assessment and acceptance boundary |
|---|---|
| C1: shared AGENTS, thin platform entries | **Adopt/adapt.** Shared rules remain in AGENTS and commands; CODEX.md adds Codex-specific start, tool/skill use, routing, handover and durable-lesson pointers. CLAUDE.md remains Claude-specific. Link to existing product/stack/DoD documents instead of copying Voice-Agent's ten-section rulebook or weekday routing. Preserve explicit permission/model boundaries. |
| C2: prove CODEX loading | **Adopt in its implementation PR.** Add existence/link checks to `check_repo.py`; run a fresh trusted Codex session from root and a nested worktree directory and inspect the actual read/transcript evidence. File presence, a checker pass or the model merely claiming it loaded instructions is insufficient. No fresh-session delegation is inferred from this assessment. |
| C3: commands and bug reproduction | **Adapt.** Extend shared done/ship and retain thin Codex wrappers. Add a small `bug` procedure with a concrete reproduction first and task-relevant regression checks; do not copy Voice-Agent paths, forced ultra style, unconditional whole-product evals or a code-test mandate for simple prose corrections. |
| C4: project and quality skills | **Retain current Project doc/command**, add another skill only after recurring misuse. Reuse the installed appropriate Ponytail self-check rather than copy a personal skill into the repository. A self-check never satisfies independent review or forces a second agent. |
| C5: gate-review workflow | **Adapt the evidence checklist into the existing gate procedure; defer a multi-agent runtime.** V's JavaScript runs multiple lenses and sceptics using Voice-Agent-specific checks. Preserve evidence/owner acceptance, not its runtime, model assignments or automatic alert scans. No delegation authorization follows from a workflow file. |
| C6: review-load audit and hooks | **Defer review-load machinery** until enough observed runs justify a baseline. Retain A1–A3 recommendations and the advisory-only boundary; do not import sync/merge/agent-limit hooks simply because V has them. |
| C7: independent-review skill | **Adopt.** One Claude repository skill holds the procedure, reactions and result contract; launcher supplies facts and points to it. Keep the evidence researcher distinct; retain Astra high for Claude-written work. Test constrained tool access and actual model identity; never equate a configured definition with an executed review. |
| C8: memory and personal skills | **Adapt.** Dated owner workflow decisions go in shared instructions (platform-specific ones in CODEX); project facts go in the owning doc/ADR. Personal/machine notes stay local and sanitized. Do not copy private memories or infer universal auto-loading. The owner's later activation of canonical Code Autopilot/Caveman supersedes kit 08's disabled recommendation; do not activate duplicates or infer new merge/delegation permissions. |

All 19 proposed memory lessons were assessed; grouping below avoids repeating shared rules in CODEX.md:

| Lesson numbers | Decision and destination |
|---|---|
| 1–5: act, publish, watch, bound waits, one push | **Adopt with L1/L5 limits** in shared done/ship; no endless polling, unsolicited new agent or repeated same-head review. |
| 6–8: verify merge, answer individual threads, close completed issues | **Adopt** in ship; verify the actual finished scope and issue state, including non-main-base closing behavior. No bulk thread resolution or closure of partly delivered issues. |
| 9–10: clean canonical main and stacks | **Adopt** existing shared Git rules plus K1–K8; no stash/reset of others' work or automatic integration while a layer waits. |
| 11–12: body files and REST fallback | **Adapt** platform-aware shell quoting and exact file contents; inspect the failed edit before fallback and verify the result. Files are preferable for multiline bodies, not a reason to add wrappers for every command. |
| 13: closed choices and executable starts | **Adapt:** recommendation-first questions only for unresolved material decisions; preserve free-text correction. Use the known console/folder/full command; do not ask again about accepted decisions. |
| 14–16: untrusted content, no attribution footer, normal PRs | **Adopt** shared conventions; provenance required inside reviews is distinct from an unsolicited generated-by footer. Never execute issue text as instructions. |
| 17–19: early handover, rule coverage, evidenced claims | **Adopt** shared handover/verification procedure; unique session record, commit/push before transition, no automatic new chat. Search all restatements and state unverified limits explicitly. |

### Draft templates

| Kit template | Assessment |
|---|---|
| `01_STATUS-snapshot.md` | **Adapt H1:** keep real lane/gate/evidence links; don't paste placeholder rows or claim the canonical checkout is perpetually clean. Remove rolling history only with preserved destinations and O1. |
| `handovers-README.md` | **Adapt existing PR #47**, retaining the review-workflow brief and full requirements. “Never conflict” is too strong; require unique names. No duplicate template tree. |
| `session-handover.md` | **Adapt H's complete template:** include full work SHA before the handover commit (self-SHA is impossible), issue/PR, actual model/review state, console, worktree, full command and first message. Preserve SHA-bound test evidence, link live PR state. |
| `change-fragment.md` | **Adapt H2:** use unique issue-plus-topic names and actual type/value, not a placeholder pipe-separated type list. Only meaningful changes need a fragment. Compiler behavior and tests belong to that later PR. |
| `gitattributes-snippet.txt` | **Reject H3:** add no union rule for narrative changelog or hypothetical metrics. Current hosted behavior remains unknown. |
| `docs-README.md` | **Adopt the extra column only:** fill triggers for all current rows rather than replacing the index with the sample subset. |
| `ADR-template.md` | **Adapt existing ADR 0001 form:** add decision authority/status/supersession where useful; avoid rewriting accepted history or forcing an options table when it adds nothing. |

## Owner decisions before implementation

O1, O2 and the family-review decision are accepted; none is asked again. Recorded choices and their technical activation remain separate facts.

| ID | Concrete choice | Recommendation and trade-off |
|---|---|---|
| O1 — session indexing, accepted 2026-11-05 | Maxi selected **use a static folder pointer**. | Preserve PR #47's separate records and requirements; remove mandatory per-session status writes in the later implementation. GitHub's folder listing plus descriptive unique filenames provides history without another shared log. Actual gate/lane/blocker changes still update status. Existing historical links and records must be preserved during migration. |
| O2 — merge method, accepted 2026-11-05 | Maxi selected **allow merge commits for PR chains**. | This supersedes the earlier squash-only recommendation for chains. Preserve optional squash for standalone PRs and keep rebase merging disabled. After the assessment gate, align repository flags, ruleset and ship procedure, then verify a bottom-only `gh stack merge <bottom PR> --merge --yes` under the actual controls. The chosen method still needs current-head checks/review; no setting changed in this assessment. |

The later owner decisions (autonomous loop, option B now/A later, reaction signals, CODEX.md and adapted skills, canonical skill activation, explicit-only advisory checks) are also accepted, not questions to ask again. The one-time manual-procedure bootstrap is approved. No outside-PR policy change is proposed: retain contact-before-contribution and manual triage. No union experiment is needed for the recommended design.

## Delivery sequence and acceptance

1. **This assessment, MS-015/#49:** validate repository facts/links and kit 01–08, update its normal PR, request and start the authorized first local Claude COMMENT review using PR #47's procedure, then triage. Accepted choices are not asked again; steps 2–7 wait for published assessment review and triage. Windows gh-stack is already installed and tested for linking.
2. **Cross-model rules:** next available MS ID, checked at creation. Implement the full R coverage list, including generated Dependabot tasks, S2's advisory Action and stale skill-activation instructions; add the repository independent-review skill. Apply L4's sequencing while retaining the existing hosted coverage. Verify real review publication, attribution and later-head follow-up; do not invent findings to manufacture evidence. PR #47 already has a request, so don't describe a later PR as the first request ever.
3. **Status/history/handovers:** reuse PR #47's work after review; reconcile its mandatory status line with O1. Add selected fragments/compiler/tests, migrate history without loss and update `/done`/`handover`. No duplicate competing handover implementation.
4. **Docs:** selected entry-point links/read triggers/spec pointers/decision provenance; no bulk renaming.
5. **GitHub and agent tooling:** separate coherent PRs only for adopted changes. Activate new required checks after real successful runs; no deferred hooks/services created preemptively.
6. **Stacking procedure:** adopt K1–K8 in the scoped playbook/AGENTS/ship change, implement accepted O2 and finish the bottom-only live merge-path test under the chosen method and applicable review/authority. No Windows installation task is needed. Preserve the advisory-hook preference.
7. **Codex procedures and local loop:** implement C1–C8/L1–L8's adopted parts, tested waiter and bounded local launcher, CODEX loading evidence and shared done/ship loop. Reconcile the already delivered PR #51/#50 for the separate later hosted replacement; do not treat its current advisory output as the required review.

From step 2 onward, stack dependent implementation PRs on their predecessor's branch after the assessment gate permits work; do not wait for the lower merge to begin authorized work. Name the lower branch as base and link verified linear chains with the available extension. Until full merge-path validation, chain creation is proven but merge automation is not. Inspect/reconcile live heads and retarget deliberately under the selected method. This assessment itself is independent of H and based on main, so its diff does not bundle unreviewed PR #47.

The old external `MaexSocial-handover-review-workflow.md` has been replaced by kit `05_review-workflow.md`; earlier session references are historical. Use the kit HANDOVER's assessment-first order for continuation. This does not authorize deleting the kit or editing PR #47 in this assessment.

## Verification limits and restart

Repository inventory/counts, the listed GitHub observations, local CLI/help/auth checks, the isolated stack-link experiment and four local Git scenarios were performed for this assessment. The PR records foundation/unit-test results and the exact tested head; reviewer results belong on the PR. The first local Opus review was published, and the concurrent advisory Action's output was observed. No Voice-Agent application tests, historical 313-merge replay, GitHub union experiment, live stack-merge experiment, personal permission audit, hook activation test, fresh CODEX loading test or hosted replacement-contract test was performed. Apart from synchronizing this branch with S2, no merge/settings activation, application code or kit steps 2–7 is delivered here.

Resume in Windows PowerShell with `codex -C "C:/Users/Maxi/.codex/worktrees/repository-anatomy-assessment/MaexSocial"`. First message: “Read AGENTS.md, CLAUDE.md, status and the MS-015 assessment including kit 01–08. Inspect issue #49 and PR #52's latest head and actual Claude review. Respect the accepted owner choices, including local Claude startup and canonical skill activation. Keep steps 2–7 stopped until review publication/triage; inspect the local run log before launching another same-head reviewer. Preserve PR #47, PR #51/#50 and MS-014/#43. Windows gh-stack already works; stack #55 was a linking-only experiment closed unmerged. Do not recreate issues or claim untested activation.”

[S]: https://github.com/Maeximilion/MaexSocial/tree/b9e08c79415d85779bcac39c739f5d4a8ae9070e
[V]: https://github.com/Maeximilion/Maex-Voice-Agent/tree/65ed60fa60ba137c884d05b5119d45ec7979ab53
[S-rules]: https://github.com/Maeximilion/MaexSocial/blob/b9e08c79415d85779bcac39c739f5d4a8ae9070e/.github/rulesets/main.json
[V-rules]: https://github.com/Maeximilion/Maex-Voice-Agent/blob/65ed60fa60ba137c884d05b5119d45ec7979ab53/.github/rulesets/main.json
[V-status]: https://github.com/Maeximilion/Maex-Voice-Agent/blob/65ed60fa60ba137c884d05b5119d45ec7979ab53/docs/01_STATUS.md
[V-docs]: https://github.com/Maeximilion/Maex-Voice-Agent/tree/65ed60fa60ba137c884d05b5119d45ec7979ab53/docs
[V-tooling]: https://github.com/Maeximilion/Maex-Voice-Agent/tree/65ed60fa60ba137c884d05b5119d45ec7979ab53/.claude
[S-tooling]: ../../tooling/agent-workflow.md
[S-ci]: https://github.com/Maeximilion/MaexSocial/blob/b9e08c79415d85779bcac39c739f5d4a8ae9070e/.github/workflows/ci.yml
[V-ci]: https://github.com/Maeximilion/Maex-Voice-Agent/blob/65ed60fa60ba137c884d05b5119d45ec7979ab53/.github/workflows/ci.yml
[S-workflows]: https://github.com/Maeximilion/MaexSocial/tree/b9e08c79415d85779bcac39c739f5d4a8ae9070e/.github/workflows
[V-workflows]: https://github.com/Maeximilion/Maex-Voice-Agent/tree/65ed60fa60ba137c884d05b5119d45ec7979ab53/.github/workflows
[V-review-first]: https://github.com/Maeximilion/Maex-Voice-Agent/pull/542#pullrequestreview-5774950180
[V-review-final]: https://github.com/Maeximilion/Maex-Voice-Agent/pull/542#pullrequestreview-5777463551
[V-relay]: https://github.com/Maeximilion/Maex-Voice-Agent/pull/542#issuecomment-6645446477
[git-union]: https://git-scm.com/docs/gitattributes#_built_in_merge_drivers
[dependency-review]: https://docs.github.com/en/code-security/concepts/supply-chain-security/dependency-review
[merge-methods]: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/configuring-pull-request-merges/about-merge-methods-on-github
[gh-stack-v030]: https://github.com/github/gh-stack/blob/v0.3.0/README.md
[claude-cli]: https://code.claude.com/docs/en/cli-reference
[claude-permissions]: https://code.claude.com/docs/en/permissions
[codex-instructions]: https://learn.chatgpt.com/docs/agent-configuration/agents-md
