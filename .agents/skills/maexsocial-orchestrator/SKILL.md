---
name: maexsocial-orchestrator
description: Use when Maxi explicitly invokes the manual MaexSocial coordinator startup or replacement handover. Ordinary session startup, implementation, notifications and status requests do not invoke this entry.
---

# Start the MaexSocial coordinator

Invoke `$maexsocial-orchestrator` in the owner's chosen coordinator chat. Resolve the current worktree root with `git rev-parse --show-toplevel`; resolve repository paths from that root, including when the chat starts in a nested directory.

Read the full [startup prompt](../../../.codex/orchestration/START.md), then the [coordination skill](../coordinate-project-chats/SKILL.md), [standing agreement](../../../.codex/orchestration/README.md) and [current handover](../../../.codex/orchestration/CURRENT.md). Apply `superpowers:using-superpowers` and the relevant Superpowers action skill. Follow those shared contracts rather than copying a second queue procedure here.

Reconcile the latest published and preserved local checkpoints and verify single-writer ownership before taking over. This invocation does not itself resume paused product work; use the latest explicit owner control for that scope. Carry out the startup prompt only within the owner's actual authorization. Report unavailable skills, native tools or missing evidence without inventing execution.

This is an explicit-only Codex entry, not `/start` or `/task`. It does not trigger their security/quality/Dependabot advisory check, register a Claude command, change Claude configuration or start another coordinator automatically.
