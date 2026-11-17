# Agent and tooling anatomy

Checked against official documentation and local CLI capabilities on 2026-11-05: Claude Code 2.1.304 and Codex 0.166.0-alpha.6. Configured files, direct script tests and actual session loading are separate claims. The supplied anatomy image is inspiration, not a configuration specification.

See the [role comparison and public research handover example](agent-evidence.md) when assigning evidence work.

## What loads where

| Location | Purpose and loading boundary |
|---|---|
| `AGENTS.md` | Shared repository instructions; Codex reads applicable instruction files. Claude imports this file through `@AGENTS.md` in `CLAUDE.md` |
| `.claude/commands/` | Manual workflows; canonical source for both platforms |
| `.claude/skills/` | Claude's repository-check skill; Claude does not automatically discover `.agents/skills/` |
| `.agents/skills/` | Codex repository-check skill and thin wrappers for the shared commands |
| `.claude/agents/` | Read-only evidence researcher with a limited tool list and inherited Claude model; not the PR reviewer |
| `.codex/agents/` | Legacy reviewer definition; retained configuration does not authorize its use for MaexSocial PR reviews |
| `.claude/rules/` | Path-scoped research/application guidance; shared obligations also live in AGENTS-linked documents for Codex |
| `.claude/hooks/` | Shared Stop-check script; a directory alone does not activate it |
| `.claude/settings.json` | Claude registration using direct executable/arguments; no permission bypass or global settings changes |
| `.codex/hooks.json` | Separate Codex registration, with POSIX/Windows commands and Git-root resolution |

Claude memory/skills/rules behavior: [memory and imports](https://code.claude.com/docs/en/memory), [skills](https://code.claude.com/docs/en/skills), [subagents](https://code.claude.com/docs/en/sub-agents). Codex behavior: [instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [skills](https://learn.chatgpt.com/docs/build-skills), [subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents).

## Repository anatomy

Codex is the primary programmer here. Request [source-command-anatomy](../../.agents/skills/source-command-anatomy/SKILL.md) for a read-only overview or name a reader path, issue or PR. The wrapper resolves the worktree root and uses the [shared procedure](../../.claude/commands/anatomy.md). Claude Code reads that same file as `/anatomy`. In a Claude-first repository, start with its local instructions and map its own sources.

## Normal task flow

1. Read the issue, check branch/dirty state, fetch, then use a task worktree. Run `/start` or `/task` and their Codex equivalents only when explicitly invoked; they alone trigger the advisory GitHub check.
2. Select the [development skill roles](development-skills.md): Ponytail for small/medium work and reviews/audits, Superpowers for larger plans and execution, with Code Autopilot and Caveman enabled. Keep G1 evidence independent until the defined comparison checkpoint; delegation still needs its own authority.
3. Implement only the authorized task. Use `repository-check` or `/eval` for full foundation commands and task-specific checks.
4. Let the existing automatic Claude API workflow review the PR and verify the [required evidence](#pr-review-policy). Resolve confirmed findings in the same PR; report review gaps to the authorized coordinator.
5. Commit/push, maintain the linked PR/Project, fetch after PR changes and pull clean canonical main after merge. Record tests and limitations in the handover.

## PR review policy

Owner decision, 2026-11-17 ([#125](https://github.com/Maeximilion/MaexSocial/issues/125)): MaexSocial PRs use the existing Claude Messages API workflow. This supersedes earlier mandatory Astra reviews, manual cross-model review instructions and Codex-bot fallback permissions for these PRs. Do not mention the Codex bot, start a separate Codex review round or silently substitute another reviewer. Historical reports and retained reviewer configuration are evidence of earlier operation, not current review authority. The workflow's advisory name and legacy supplementary comment do not define the current PR review gate.

- Keep `claude-opus-5-5`, effort `high`, speed `standard` and `service_tier=standard_only`, all current input/output/workspace limits, tool-free operation and trust/secret protections unchanged. Use the existing automatic workflow on real PR changes; do not create paid diagnostic probes or duplicate triggers.
- A review counts only after the API step actually executes and an authentic complete result is published. Link the Actions run and result; record head SHA, base ref/tip, merge base and reviewed diff. Verify the publisher and result against that run, not just a copied label or green job. Skipped, protected self-skipped, cancelled, failed, truncated or incomplete runs remain unreviewed.
- Compare coverage with the current head/base and integration candidate before merge. A changed head requires fresh coverage; a retarget, base change or restack requires rechecking the actual diff even when the head is unchanged. Read inline findings, review summaries and top-level comments. Required CI, trust/secret checks, unresolved blocking findings and applicable product gates remain effective.
- Diagnose a failed or incomplete review from its actual safe evidence before a corrected retry. Do not repeat an identical paid request. Fix confirmed findings with targeted checks in the same PR; reject incorrect findings with evidence. Resolve threads only after a verified fix or evidence-backed rejection. Each further loop needs new evidence; after at most three attempts with the same failure signature, report cause, evidence and a recommended different approach to the coordinator while continuing independent authorized work.
- A protected reviewer self-skip is a review gap for the coordinator, never a substitute review or permission to bypass protection. Hold merge eligibility until the gap is explicitly resolved under applicable authority. Post-merge verification on the next real eligible PR can establish reviewer behavior, but does not retroactively review the protected PR. Do not rerun a closed PR for a receipt.

## Stop hook

The hook performs only the cheap links/JSON/TOML/SVG check. It does not format files, commit, publish, contact providers or replace full tests. Failed checks, startup errors and timeouts emit only a user-visible `systemMessage` warning with a manual follow-up command; they do not block task completion or force another agent turn. Invalid/oversized input, unrelated events and repeated Stop invocations are skipped without running validation. A warning or skipped callback is not evidence of a passing check. The checker itself and required CI still reject invalid repository content.

Owner preference, 2026-11-05: workflow reminders and quality-check hooks are advisory by default. The model-routing hook keeps its explicit decision pause. Secret-prevention Git hooks and product acceptance gates are separate controls. The inspected active Ponytail session/prompt hooks already supply context without task-blocking decisions; disabled legacy hooks remain disabled. This inventory covers the inspected local Codex configuration and MaexSocial registrations, not all hooks in other repositories or future plugin versions.

Claude runs Python directly with its project-directory argument. Codex resolves the Git root from the session directory before running the same script, including nested working directories. Python and Git must be available. Check the script/configuration and tests together after changes. [Claude hooks](https://code.claude.com/docs/en/hooks), [Codex hooks](https://learn.chatgpt.com/docs/hooks)

Committing configuration is not proof of activation. Start a new trusted project session and inspect `/hooks`; Codex requires trust for each new/changed hook definition. Verify the displayed command, event and an observed callback before relying on it. This update does not change local trust or claim a callback in the current desktop chat. Cloud-orchestrated sessions may not execute local hooks. CI remains the portable required check; hooks are workflow assistance, not a security sandbox.

## Plugins, MCP and local state

Do not create `.claude/plugins/` to suggest automatic installation: Claude does not scan it. Add a plugin only for a demonstrated need, with its source/version, capabilities and actual loading method reviewed. The owner now explicitly enables Code Autopilot and Caveman and requests project integration of Superpowers and Ponytail. Their roles, native registrations and activation boundaries are documented in [development skills](development-skills.md); the earlier disabled-skill state is superseded. [Plugin loading](https://code.claude.com/docs/en/plugins/loading#plugins-shared-through-a-repository)

REA and media providers are not interchangeable with plugins. A future Claude project MCP definition belongs at root `.mcp.json`; Codex uses its own `mcp_servers` configuration. Use environment credential references, restricted tools and an explicit target/action scope. Inspect actual startup behavior: interactive Claude project approval is not a universal guarantee for print/SDK modes. No speculative MCP server, provider credential or paid integration is configured by this foundation change. [Claude MCP](https://code.claude.com/docs/en/mcp), [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

`CLAUDE.local.md`, `.claude/settings.local.json`, nested Claude worktrees, `.env` and `work/` are ignored. Keep shared settings/skills/rules tracked. Ignore rules are convenience, not a secret detector. Output styles, custom status lines and plugin packaging are absent because this task has no need for them; add them when they improve a real workflow.
