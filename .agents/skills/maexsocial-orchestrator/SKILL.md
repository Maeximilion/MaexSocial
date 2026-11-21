---
name: maexsocial-orchestrator
description: Use when Maxi explicitly invokes the manual MaexSocial coordinator startup or replacement handover. Ordinary session startup, implementation, notifications and status requests do not invoke this entry.
---

# Start the MaexSocial coordinator

Invoke `$maexsocial-orchestrator` in the owner's chosen coordinator chat. Resolve the current worktree root with `git rev-parse --show-toplevel`; resolve repository paths from that root, including when the chat starts in a nested directory.

Read the [coordination adapter](../coordinate-project-chats/SKILL.md) first and verify its personal-skill hash before reading or invoking the personal skill body. Then read the [startup prompt](../../../.codex/orchestration/START.md), [standing agreement](../../../.codex/orchestration/README.md) and [current handover](../../../.codex/orchestration/CURRENT.md). Load the verified personal skill for the general loop. A missing or mismatching edition stays inactive under the adapter's update rule. Follow those shared contracts without creating another queue procedure.

Reconcile the live private ledger, actual chats and newest owner control before taking over; CURRENT and preserved checkpoints are dated evidence, not authority to override newer instructions. Verify single-writer ownership. This invocation does not itself resume paused product work; use the latest explicit owner control for that scope. Carry out the startup prompt only within the owner's actual authorization. Report unavailable skills, native tools or missing evidence without inventing execution.

This is an explicit-only Codex entry, not `/start` or `/task`. It does not trigger their security/quality/Dependabot advisory check, register a Claude command, change Claude configuration or start another coordinator automatically.
