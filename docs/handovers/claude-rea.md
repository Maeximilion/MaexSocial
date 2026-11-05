# Handover 2026-11-05 — MS-004, independent Claude Code REA

Status — G0 is complete. G1 is ongoing. The bounded Codex static report is delivered. Claude's independent investigation is pending.

Artifacts — [Issue #4](https://github.com/Maeximilion/MaexSocial/issues/4), repository `Maeximilion/MaexSocial`, canonical checkout `C:/Users/Maxi/Documents/GitHub/MaexSocial`, target `https://app.socialedge.ai/de/dashboard`. Use branch `research/MS-004-claude-rea` in a separate worktree.

Decisions — Establish SocialEdge's observed capabilities as evidence for MaexSocial. Keep evidence, interpretations and MaexSocial design proposals distinct. Code Autopilot and Caveman are explicitly enabled with the documented Codex adaptations; follow [development skill roles](../tooling/development-skills.md).

Gate — G1 requires independent evidence, comparison and accepted coverage limits. Product architecture and implementation planning receive Maxi's approval at G2.

Open — Read repository rules and this brief, plan declared scenarios, then establish independent observations before consulting Codex's findings.

Lessons — An earlier web-tool failure did not prove dashboard unavailability. Later unauthenticated HTTP capture succeeded. Access and target state must be verified in the current session.

## Start and working directory

Read `AGENTS.md`, `CLAUDE.md`, [charter](../00_PCF.md), [status](../01_STATUS.md), [work packages](../07_WORKPACKAGES.md), [research handling](../09_OPERATIONS_LEGAL.md) and issue #4. Keep the canonical checkout on clean `main`. Follow [playbooks](../12_CLAUDE_CODE_PLAYBOOKS.md) to synchronize and create or reuse the correct task worktree. Paths in the rest of this brief are relative to that task worktree.

Check open PRs and existing worktrees before creating a branch. Fetch with pruning at session start and after PR updates. After a merge, pull the clean canonical `main` with `--ff-only`. Never pull a dirty checkout or reset another session's work.

## Phase A — Independent research

Read the installed REA skill and relevant browser/runtime guide. Verify actual advertised tools and provider availability. Record the connection mode and versions. Historical registration is insufficient evidence of a live connection.

Use Superpowers to record the investigation plan before running REA: target, authorized actions, scenarios, evidence outputs and verification. This research plan does not approve product architecture or paid/account actions.

Before reading `docs/research/codex-rea.md` or its manifest, write your own scenario plan from the target and questions below. Inspect current primary sources and available authorized application behavior. Record observations in an independent section of your report and freeze that checkpoint with a commit or dated report revision before Phase B. If Codex findings were already loaded into your context, disclose that exposure and still collect new evidence for every corroborated claim.

Inspect `https://www.socialedge.ai/`, current product/pricing pages and the supplied dashboard. Cover the following questions to the extent that access permits.

| Area | Questions |
|---|---|
| Product offer | Which services, modules, packages and human-operated activities are described? |
| Business setup | What brand, business, location and connected-account inputs are required? |
| Content | How are briefs, generated drafts, revisions and approvals represented? |
| Publication | What scheduling, destination, success, failure and retry states can be observed? |
| Reviews | How are reviews retrieved and responses prepared, approved and published? |
| Visibility | What rankings, analytics, directory synchronization and report outputs exist? |
| Follow-up and CRM | Which workflows are visible, and which are service promises only? |
| Media | What upload/library/editing/rendering capabilities are observed? Is image-to-video generation supported? |

For each scenario record entry point, access/account tier, inputs, steps, visible outputs, operator involvement, integration evidence and gaps. Classify evidence as vendor claim, UI observation, static artifact observation or runtime observation. Label inferences and unknowns explicitly.

Use only the declared target and authorized actions. If required logged-in access or permission for a runtime scenario is missing, stop that scenario and ask Maxi for the specific account/session and permitted actions needed. Continue public/static work already authorized. Publishing, customer communications, billing changes and paid generation require scope covering those effects. Preserve authentication barriers as coverage limits.

## Phase B — Compare with Codex

After recording the independent checkpoint, read [Codex's report](../research/codex-rea.md) and its [evidence manifest](../research/evidence-codex.json). Preserve both files and their existing evidence identifiers. Codex analyzed selected static client chunks. Authenticated runtime and backend behavior remain unverified.

Create one atomic claim per row. Assign stable IDs `SE-001`, `SE-002` and so on. Codex has no equivalent claim IDs yet, so cite its section and evidence ID without editing that lane. Include independent additions as new claim rows.

| Claim ID and exact claim | Codex evidence | Independent Claude evidence | Result | Source dates and scope | Unknowns and next check |
|---|---|---|---|---|---|
| SE-NNN with one testable claim | Report section, evidence ID and manifest artifact/hash, or absent | Own source URL/artifact, evidence ID and scenario/revision | confirm, contradict, extend or unverifiable | Date for each source, target/version, account tier, static/runtime scope | Specific gap and smallest authorized check |

Use `confirm` only when your own evidence supports the same claim within comparable scope. Use `contradict` when comparable observations disagree, recording possible version/access differences. Use `extend` for additional supported detail or a new capability. Use `unverifiable` when access or evidence cannot settle the claim. Agreement with Codex's wording is not independent verification.

Keep the matrix factual. Place MaexSocial requirements, improvements and architecture proposals in a separate section with rationale. A SocialEdge observation does not decide MaexSocial's provider or implementation.

## Deliverables and completion

Create `docs/research/claude-rea.md` with the independent checkpoint, method, scope, findings, comparison matrix, limitations and next checks. Create `docs/research/evidence-claude.json` with capture dates, target/source URLs, tool versions, own evidence IDs, artifact hashes, scenario references and coverage boundaries. The manifest must resolve each evidence reference used in the report.

Keep raw captures in ignored `work/rea-claude/` within the task worktree. Commit sanitized findings and original explanatory diagrams only. Build original MaexSocial behavior from documented requirements. Do not copy SocialEdge source bundles, complete UI designs or proprietary assets into the product or repository.

Run `python scripts/check_repo.py`, `python -m unittest discover -s tests` and `node --test tests/*.test.cjs`, recording actual outcomes. Update issue #4, status and work packages from observed results. Open a focused PR under repository review/merge rules. Use `Closes #4` only when bounded research acceptance criteria are satisfied, otherwise `Refs #4` with outstanding work. G1 stays open for synthesis and unaccepted material access gaps. Any code review uses an actually configured `gpt-6-astra` reviewer at reasoning `high`.

## Reusable start prompt

Work on MaexSocial issue #4, MS-004. Read repository instructions and docs/handovers/claude-rea.md from the latest main, then work in a separate task worktree. Plan and conduct your own SocialEdge research with REA before reading Codex's findings. Save a dated independent checkpoint, then compare it with docs/research/codex-rea.md and docs/research/evidence-codex.json using the prescribed claim matrix. Preserve the Codex lane. Produce a sanitized Claude report and evidence manifest, separating observed facts from MaexSocial design proposals. Ask for any missing runtime access/action scope before that scenario. Follow the PR and verification rules, use the enabled Code Autopilot/Caveman skills under the current repository rules, and deliver research with explicit coverage limits.
