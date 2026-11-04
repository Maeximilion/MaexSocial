# Agent playbooks

## Start a session

Read root agent instructions, [status](01_STATUS.md), [work packages](07_WORKPACKAGES.md) and the task's specific source. Check the current branch, working tree and open PRs before editing. Preserve another session's files. State the next deliverable and its verification. Code-autopilot and caveman remain disabled. Their presence on a machine does not authorize activation.

## Canonical checkout and worktrees

Maxi's canonical folder `C:/Users/Maxi/Documents/ChatGPT/MaexSocial` stays on clean `main`. Changes belong in a separate worktree. The foundation worktree is `C:/Users/Maxi/.codex/worktrees/maexsocial-foundation/MaexSocial`. The bootstrap was committed and transferred into this managed Codex worktree.

Before synchronization run `git status --porcelain` in the canonical folder and require empty output. If anything is dirty, preserve it and report it. With a clean `main`, run `git fetch --prune origin` followed by `git pull --ff-only origin main`. Perform this regularly and after a PR merges. A failed fast-forward is a state to inspect, never a reason to reset someone else's work.

For a fresh Claude research branch, after clean-main synchronization run `git worktree add -b research/MS-004-claude-rea ../MaexSocial-worktrees/claude-rea origin/main`. For another task choose its own branch/path after checking existing worktrees. Before every commit verify `git branch --show-current` in the task worktree. Never pull into a dirty checkout.

## Work a task

Choose an unblocked MS-NNN task. Use a dedicated branch in a separate worktree for changes. Follow its approved plan. Keep the issue linked to evidence and PRs. Update task status and `01_STATUS.md` together. New product implementation starts only after G2.

## Research with REA

Read the relevant REA guide and the lane handover. Select the exact supplied target. Use available tools or the documented CLI fallback. Report connection, provider and target-access failures separately. Save sanitized observations with evidence IDs and reproducible steps. Do not treat a public marketing page as observed application behavior.

## Finish and review

Run checks appropriate to the actual changes. The PR states the problem, result, real test outcomes, remaining limits and linked issue. Get code review with `gpt-6-astra`, reasoning `high`, and verify the actual setting. Resolve concrete findings and repeat checks affected by fixes. Follow root repository merge rules. A later push invalidates any claim that an earlier review covered the exact current head.

## Gate

Read [charter](00_PCF.md) criteria. Link dated evidence for each. Record outstanding criteria before requesting a decision. Update status, task list, README and changelog to the observed state. Create a gate tag only after the gate passes. G2 and G5 include explicit owner decisions.

## Handover

Use the repository `/handover` command. Include status, files/branch/commits, decisions, gate state, next step and lessons. A handover to a separate session is self-contained and links the full brief. Update status once. Record blocked access without claiming the receiving session has run. The prepared briefs are in [handovers](handovers/synthesis.md).

## GitHub maintenance

Use the documented project workflow. Derive progress from issues, PRs and gate evidence. Preserve existing assignments and manually selected planning fields unless explicitly changing them. A closed unmerged PR is abandoned or superseded work, not a completed delivery.

