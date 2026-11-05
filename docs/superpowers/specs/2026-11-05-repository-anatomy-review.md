# MS-015 — Repository anatomy assessment

Status: proposed assessment, 2026-11-05. [Task #49](https://github.com/Maeximilion/MaexSocial/issues/49). Codex authors; Claude independently reviews. This document proposes follow-up work; it does not change review policy, merge settings, hooks, history storage or any product gate. Implementation waits for the published Claude review and the owner decisions below.

## Recommendation and scope

Keep MaexSocial's small numbered entry documents, topic folders, shared hook and thin command wrappers. Reduce routine writes to shared status/history files; retain separate session records. Adopt the owner-selected cross-model review procedure through one focused rules PR. Add only tooling that has a concrete consumer: no copied Voice-Agent application folders, status-version script, merge hook or hosted reviewer service.

The owner supplied `C:/Users/Maxi/Documents/MaexSocial-architecture-kit/`: README, HANDOVER, five topic papers and seven draft templates. All were read. The kit is evidence and proposed options, except its explicit owner decisions. This assessment covers every numbered candidate, the review rules and all templates. Findings below concern repository/workflow design, not a code-review certification.

Already decided by Maxi: Codex-written work receives Claude review; Claude-written work receives GPT-6 Astra high review. Repository patterns must be assessed rather than copied. Status should not require constant upkeep. MS-014 remains upload security (#43); this assessment uses the next free ID, MS-015. Code-autopilot and caveman remain disabled; code-autopilot's GPT/Codex compatibility is unverified.

Updated owner instruction received during this assessment (2026-11-05): workflow reminders and quality hooks should be advisory, without stopping/pausing tasks or forcing extra agents or remediation chats. Model routing retains its explicit decision pause. Credential-protection checks, required CI and product approvals remain separate controls. This changes the hook recommendations below, not any running hook configuration. The explicit instruction to stop this assignment after requesting Claude review still applies.

## Evidence and corrections

Repository facts were read from Git objects at these full SHAs, not inferred from whichever branch a local folder displayed:

- **S:** MaexSocial main `b9e08c79415d85779bcac39c739f5d4a8ae9070e` ([tree][S]).
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
| H1: status changes only with state | **Adopt**, subject to resolving the earlier per-handover-link decision (O1). | Keep stage/gates, lane state, next action, blockers, evidence limits and decision/history pointers within roughly 80 lines. That is a readability target, not a line-count CI gate. PR checks/holds/results stay on the PR. Gate evidence remains mandatory. |
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
| G3: merge method | **Adapt:** recommend retaining squash during G1; explicit owner choice O2. | Effective settings already enforce squash. Stacks are possible but require deliberate retarget/rebase after lower PRs squash, new checks/review on a changed head and deliberate branch cleanup. Merge commits preserve ancestry and ease these operations, at the cost of more main history. Neither method eliminates status conflicts or strict-check updates. [GitHub merge methods][merge-methods] |
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
| R1: other model family; mixed work; quota exhaustion | **Adopt.** Codex → Claude; Claude → GPT-6 Astra high; mixed changes need coverage of the other family's contributions. An unavailable reviewer leaves the PR waiting. Never infer provenance from Git commit author alone. |
| R2: new top-level request after opening and each push | **Adopt.** Verify posting and include full base/head, last completed review, scope and evidence. Mentions belong in request comments, not PR titles/descriptions. |
| R3: manual until an action is live-tested | **Adopt.** Maxi starts Claude; a mention is not a launch. No OAuth secret, bot installation, subscription inference or action deployment is authorized here. |
| R4: full first diff, scoped follow-up | **Adopt.** Follow-up covers every commit since the last completed reviewer head, affected context and all open findings; fall back to full diff without a valid baseline. |
| R5: every new head needs review | **Adopt.** Includes merges from main and fixes by the reviewer; changed ownership may require the other model. |
| R6: inline findings and one summary | **Adapt:** publish genuine findings inline with a verified head and full base/head scope in the summary. If none exist, publish the completed summary with no invented comment. Outside-diff findings need a justified changed-line anchor or existing thread. |
| R7: reviewer identity | **Adopt manual attribution now; defer bot identity until verified.** Each manual review body/finding/reviewer reply starts `**Claude review**` or the corresponding Codex label; inspect `user.login` and `user.type`. Never claim a bot author from prose. |
| R8: procedural gate and merge authority | **Adopt**, keeping S's actual controls and O2 separate. `/ship` verifies exact-head independent evidence and dispositions in addition to checks/threads and owner merge authorization. Zero required approvals cannot technically enforce model-family independence. |
| Severity, format and triage | **Adopt:** P0 exposure/data loss/direct hard-rule impact; P1 concrete guarded-path/security/main failure; P2 other reproducible defects. One root cause, specific short title, trigger/impact/outcome/verification in about 40–100 words. Distinguish assumptions. Confirm before fixing, regression-test logic fixes, reject with evidence, resolve only after verification. P0/P1 block; after three consecutive P2-only rounds explicitly decide and record disposition. No style findings or forced inline comments. |

Implementation coverage must include every conflicting occurrence, not just the kit's initial file list: `AGENTS.md`, `CLAUDE.md` platform entry points, `CONTRIBUTING.md`, charter decision history, `.claude/commands/done.md` and `ship.md`, the evidence researcher's review-routing sentence, `.codex/agents/reviewer.toml`, PR template, playbooks, build brief, `docs/tooling/agent-workflow.md` and `docs/16_GITHUB_PROJECT.md`. Search again at implementation time, including root instructions supplied to the session. Shared Codex wrappers should continue to point to commands. This assessment makes no global model-preference or permission-file change.

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

## Owner decisions required before implementation

These are recommendations for Maxi, not accepted changes. The family-review decision is already made and is not asked again.

| ID | Concrete choice | Recommendation and trade-off |
|---|---|---|
| O1 — session indexing versus shared-file writes | Keep the earlier rule of one status link per handover, or replace it with a static sessions-folder pointer and state-change-only status edits? | **Replace it.** Preserve PR #47's separate records and requirements; remove mandatory per-session writes only with explicit acceptance because that changes the earlier instruction. GitHub's folder listing plus descriptive unique filenames provides history without another shared log. Accepted gate/lane/blocker changes still update status. |
| O2 — merge method | Retain squash-only, or change repository flags, ruleset and ship procedure to merge commits? | **Retain squash-only for G1.** It is already enforced and keeps one main commit per completed task. Prefer merge commits if preserving stack ancestry/automatic local branch cleanup outweighs this; it is a legitimate alternative, not a prerequisite for fragments or cross-model review. Both require current-head checks/review after updates. |

No outside-PR policy change is proposed: retain contact-before-contribution and manual triage. If automatic closure is desired later, ask the owner for allowed actors and message before implementation. No union experiment is needed for the recommended design; if union is selected instead, validate conflict detection, Update branch and the actual merge method using a dedicated authorized test, without changing main policy to make a test pass.

## Delivery sequence and acceptance

1. **This assessment, MS-015/#49:** validate repository facts/links, publish as its own PR, request manual Claude COMMENT review and stop. All candidate decisions remain recommendations until the review and O1/O2 answers are recorded.
2. **Cross-model rules:** next available MS ID, checked at creation. Implement the R coverage list and exact-head manual procedure in a separate PR. Verify real review publication, attribution and later-head follow-up; do not invent findings to manufacture evidence. PR #47 is already a requested first live test, so don't describe a later PR as the first request ever.
3. **Status/history/handovers:** reuse PR #47's work after review; reconcile its mandatory status line with O1. Add selected fragments/compiler/tests, migrate history without loss and update `/done`/`handover`. No duplicate competing handover implementation.
4. **Docs:** selected entry-point links/read triggers/spec pointers/decision provenance; no bulk renaming.
5. **GitHub and agent tooling:** separate coherent PRs only for adopted changes. Activate new required checks after real successful runs; no deferred hooks/services created preemptively.

Stack dependent implementation PRs on their predecessor's branch after the assessment gate permits work; inspect/reconcile live heads and retarget deliberately under the selected merge method. This assessment itself is independent of H and based on main, so its diff does not bundle unreviewed PR #47.

The old external `MaexSocial-handover-review-workflow.md` has been replaced by kit `05_review-workflow.md`; earlier session references are historical. Use the kit HANDOVER's assessment-first order for continuation. This does not authorize deleting the kit or editing PR #47 in this assessment.

## Verification limits and restart

Repository inventory/counts and the listed GitHub observations were performed for this assessment. The PR records actual foundation/unit-test results and the exact tested head. No Voice-Agent application tests, historical 313-merge replay, GitHub union experiment, personal permission audit, hook activation test or hosted Claude integration test was performed. No merge, setting change, application code or kit steps 2–5 is delivered here.

Resume in Windows PowerShell with `codex -C "C:/Users/Maxi/.codex/worktrees/repository-anatomy-assessment/MaexSocial"`. First message: “Read AGENTS.md, CLAUDE.md, status and the MS-015 assessment. Inspect issue #49 and its PR's latest head and manual Claude review. Keep steps 2–5 stopped until the review is published and O1/O2 are answered; preserve PR #47 and MS-014/#43. Do not recreate the issue or merge anything.”

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
