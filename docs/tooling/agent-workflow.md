# Agent and tooling anatomy

Checked against official documentation and local CLI capabilities on 2026-11-05: Claude Code 2.1.304 and Codex 0.166.0-alpha.6. Configured files, direct script tests and actual session loading are separate claims. The supplied anatomy image is inspiration, not a configuration specification.

## What loads where

| Location | Purpose and loading boundary |
|---|---|
| `AGENTS.md` | Shared repository instructions; Codex reads applicable instruction files. Claude imports this file through `@AGENTS.md` in `CLAUDE.md` |
| `.claude/commands/` | Eight existing manual workflows; canonical source for both platforms |
| `.claude/skills/` | Claude's repository-check skill; Claude does not automatically discover `.agents/skills/` |
| `.agents/skills/` | Codex repository-check skill and eight thin wrappers for the shared commands |
| `.claude/agents/` | Read-only evidence researcher with a limited tool list and inherited Claude model; never an Astra code reviewer |
| `.codex/agents/` | Reviewer definition selecting GPT-6 Astra high; actual session/model availability must be verified when invoked |
| `.claude/rules/` | Path-scoped research/application guidance; shared obligations also live in AGENTS-linked documents for Codex |
| `.claude/hooks/` | Shared Stop-check script; a directory alone does not activate it |
| `.claude/settings.json` | Claude registration using direct executable/arguments; no permission bypass or global settings changes |
| `.codex/hooks.json` | Separate Codex registration, with POSIX/Windows commands and Git-root resolution |

Claude memory/skills/rules behavior: [memory and imports](https://code.claude.com/docs/en/memory), [skills](https://code.claude.com/docs/en/skills), [subagents](https://code.claude.com/docs/en/sub-agents). Codex behavior: [instructions](https://learn.chatgpt.com/docs/agent-configuration/agents-md), [skills](https://learn.chatgpt.com/docs/build-skills), [subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents).

## Normal task flow

1. Use `/start` in Claude or `source-command-start` in Codex. Read the issue, check branch/dirty state, fetch, then use a task worktree.
2. Use the available Superpowers planning skills. Keep G1 evidence independent until the defined comparison checkpoint; use the bounded researcher for parallel primary-source research.
3. Implement only the authorized task. Use `repository-check` or `/eval` for full foundation commands and task-specific checks.
4. Request a fresh review with actual `gpt-6-astra` and `high` settings, base/head and issue scope. The reviewer is instructed not to edit; its file does not grant a separate sandbox or change inherited permissions. Claude prepares the review handover for Codex instead of substituting a Claude model.
5. Commit/push, maintain the linked PR/Project, fetch after PR changes and pull clean canonical main after merge. Record tests and limitations in the handover.

## Stop hook

The hook performs only the cheap links/JSON/TOML/SVG check. It does not format files, commit, publish, contact providers or replace full tests. A failed check asks the agent to resolve/report it; repeated Stop invocation is skipped to avoid an infinite continuation loop. Invalid/oversized input and unrelated events are skipped without running validation; execution failures/timeouts request a manual check. A skipped callback is not evidence of a passing check.

Claude runs Python directly with its project-directory argument. Codex resolves the Git root from the session directory before running the same script, including nested working directories. Python and Git must be available. Check the script/configuration and tests together after changes. [Claude hooks](https://code.claude.com/docs/en/hooks), [Codex hooks](https://learn.chatgpt.com/docs/hooks)

Committing configuration is not proof of activation. Start a new trusted project session and inspect `/hooks`; Codex requires trust for each new/changed hook definition. Verify the displayed command, event and an observed callback before relying on it. This update does not change local trust or claim a callback in the current desktop chat. Cloud-orchestrated sessions may not execute local hooks. CI remains the portable required check; hooks are workflow assistance, not a security sandbox.

## Plugins, MCP and local state

Do not create `.claude/plugins/` to suggest automatic installation: Claude does not scan it. Add a plugin only for a demonstrated need, with its source/version, capabilities and actual loading method reviewed. The current Codex session exposes Superpowers; the local `claude plugin list --json` check listed only the user-scoped Ponytail installation. That does not establish Superpowers availability in a future Claude session. Code-autopilot and caveman remain disabled. [Plugin loading](https://code.claude.com/docs/en/plugins/loading#plugins-shared-through-a-repository)

REA and media providers are not interchangeable with plugins. A future Claude project MCP definition belongs at root `.mcp.json`; Codex uses its own `mcp_servers` configuration. Use environment credential references, restricted tools and an explicit target/action scope. Inspect actual startup behavior: interactive Claude project approval is not a universal guarantee for print/SDK modes. No speculative MCP server, provider credential or paid integration is configured by this foundation change. [Claude MCP](https://code.claude.com/docs/en/mcp), [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)

`CLAUDE.local.md`, `.claude/settings.local.json`, nested Claude worktrees, `.env` and `work/` are ignored. Keep shared settings/skills/rules tracked. Ignore rules are convenience, not a secret detector. Output styles, custom status lines and plugin packaging are absent because this task has no need for them; add them when they improve a real workflow.
