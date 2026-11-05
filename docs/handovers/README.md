# Handover index

## Two kinds

A **brief**, `docs/handovers/<lane>.md`, assigns future work to a session or a line of work. Update it when the assignment changes; keep its path stable so existing links continue to work. A brief is not a record of a session stopping.

A **session handover**, `docs/handovers/sessions/YYYY-MM-DD-<topic>.md`, records where one session stopped. Save the complete `/handover` block in one new file per handover. Never append another handover to a shared file or overwrite a previous session record. If the date and topic already exist, use a distinct topic suffix such as `-02`.

Before context runs out, stop at a clean checkpoint, write the session handover, then commit and push. [Status](../01_STATUS.md) links directly to the [sessions folder](sessions/); change status only for a gate, work lane or blocker. Only then start an authorized new session. A saved file alone does not mean it has been pushed or that the receiving session has started.

## Briefs

- [claude-rea](claude-rea.md) — Independent Claude research, followed by comparison with Codex evidence.
- [codex-rea](codex-rea.md) — Continue bounded Codex research with reproducible evidence and explicit access limits.
- [synthesis](synthesis.md) — Reconcile the research lanes and prepare G2 decisions.
- [build](build.md) — Plan and implement the approved product scope after G2.
- [review-workflow](review-workflow.md) — Coordinate the handover-structure PR, manual cross-model review and the subsequent review-policy task.

## Session template

Use the six sections below in this order. Every session handover must identify the repository, task ID and issue, branch, full 40-character head SHA and PR, implementer and reviewer, plus a runnable start containing the console, exact folder/worktree, full start command and first message. For maintenance without an MS ID, use the maintenance issue as the task ID. If a PR does not yet exist, say so explicitly and make opening it a concrete next action.

Record the review direction as `Codex → Claude review` or `Claude → GPT-6 Astra review`, including the actual model/settings when verified and any unverified setting. A requested review is not a published review. GPT-6 Astra reviews use reasoning `high`.

Capture `git rev-parse HEAD` before writing the handover and label it as the **work head before the handover commit**. The file cannot contain the SHA of its own eventual commit; Git history identifies that delivery commit. Verify the branch, remote and clean state again after pushing.

````markdown
# Handover YYYY-MM-DD — <task IDs>

## Status

Actual completed, running, pending and blocked work; checks run and their outcomes.
Implementation/review — <Codex → Claude review or Claude → GPT-6 Astra review>.
Actual models/settings and review state — <verified facts or explicitly unverified>.

## Artifacts

- Repository — <owner/repository and URL>
- Task ID and issue — <MS-NNN or maintenance #N; issue URL>
- Branch — <exact branch>
- Work head before the handover commit — <full 40-character SHA>
- PR — <URL and state, or not yet opened>
- Files and evidence — <links; tested SHA; published review URL or pending>

## Decisions

Decisions, assumptions and reasons the next session must preserve.

## Gate

Current gate, linked acceptance evidence and outstanding owner decisions.

## Open

Next concrete action first, followed by remaining work and blockers.

- Console — <PowerShell, Ubuntu/WSL shell, or other exact console>
- Folder/worktree — <absolute path>
- Full start command — <complete executable command, including folder selection>
- First message — <self-contained prompt with task, handover path and next action>

## Lessons

Constraints, failed approaches and useful findings. Record current owner-selected skill settings when relevant.
````

Replace every placeholder with observed facts. Keep credentials, raw authenticated captures and personal customer data out of public handovers. See the [handover command](../../.claude/commands/handover.md) for the delivery procedure and [status](../01_STATUS.md#delivered-evidence-and-handovers) for the permanent sessions-folder link.
