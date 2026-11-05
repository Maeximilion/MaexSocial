# Agent playbooks

## Start a session

Read root agent instructions, [status](01_STATUS.md), [work packages](07_WORKPACKAGES.md) and the task's specific source. Check the current branch, working tree and open PRs before editing. Preserve another session's files. State the next deliverable and its verification. Follow the [current development skill roles](tooling/development-skills.md) for Code Autopilot, Caveman, Ponytail and Superpowers.

## Canonical checkout and worktrees

Maxi's canonical folder `C:/Users/Maxi/Documents/GitHub/MaexSocial` stays on clean `main`. Changes belong in a separate task worktree. Managed Codex worktrees may live under `.codex/worktrees/`. A manually created worktree may use a sibling `../MaexSocial-worktrees/` directory relative to the canonical checkout. Inspect `git worktree list` and reuse an existing task worktree only when it belongs to the current assignment. All repository-relative paths in a handover resolve from the selected task worktree.

Before synchronization run `git status --porcelain` in the canonical folder and require empty output. If anything is dirty, preserve it and report it. Verify `git branch --show-current` is `main`. With a clean `main`, run `git fetch --prune origin` followed by `git pull --ff-only origin main`. Fetch with pruning at session start and after PR creation or updates. Synchronize clean canonical main regularly and after a PR merges. Inspect a failed fast-forward and preserve existing work.

For a fresh Claude research branch, after clean-main synchronization run `git worktree add -b research/MS-004-claude-rea ../MaexSocial-worktrees/claude-rea origin/main`. For another task choose its own branch/path after checking existing worktrees. Before every commit verify `git branch --show-current` in the task worktree. Never pull into a dirty checkout.

## Work a task

Choose an unblocked MS-NNN task. Use a dedicated branch in a separate worktree for changes. Follow its approved plan. Keep the issue linked to evidence and PRs. Update task status and `01_STATUS.md` together. New product implementation starts only after G2.

## Research with REA

Read the relevant REA guide and lane handover. Select the supplied target. Use available tools or the documented CLI fallback. Report connection, provider and target-access failures separately. Save sanitized observations with evidence IDs and reproducible steps. Classify vendor claims, UI, static and runtime observations separately.

For MS-004, establish and freeze Claude's own findings before reading the Codex report and manifest. Then use the claim comparison matrix in [Claude's handover](handovers/claude-rea.md). Preserve the Codex lane. Record source dates, access scope and unknowns. Keep MaexSocial design proposals separate from evidence. Missing runtime access or action scope pauses that scenario for a precise request to Maxi, while authorized public research may continue. Deliver original requirements and sanitized observations, without wholesale copying of proprietary code, UI designs or assets.

## Finish and review

Run checks appropriate to the actual changes. The PR states the problem, result, real test outcomes, remaining limits and linked issue. Get code review with `gpt-6-astra`, reasoning `high`, and verify the actual setting. Resolve concrete findings and repeat checks affected by fixes. Follow root repository merge rules. A later push invalidates any claim that an earlier review covered the exact current head.

## Gate

Read [charter](00_PCF.md) criteria. Link dated evidence for each. Record outstanding criteria before requesting a decision. Update status, task list, README and changelog to the observed state. Create a gate tag only after the gate passes. G2 and G5 include explicit owner decisions.

## Handover

Use the repository [/handover command](../.claude/commands/handover.md) and [handover index and template](handovers/README.md). A lane brief assigns future work; a session handover records where the current session stopped. Preserve existing brief paths. Save each complete session block in a new `docs/handovers/sessions/YYYY-MM-DD-<topic>.md`, never appended to a shared file, and use the permanent folder link under **Delivered evidence and handovers** in [status](01_STATUS.md). Update status only when a gate, work lane or blocker changes.

Include repository, task ID and issue, branch, full work-head SHA and PR, implementation/review direction, and a runnable start with console, folder/worktree, full command and first message. Record actual checks, review state, gate evidence, decisions, next action and lessons. Explicitly distinguish pending or blocked work from observed results.

Hand over before context runs out: stop at a clean checkpoint, write the handover, verify local links, commit and push, then start an authorized new session. Capture the work head before the handover commit; Git history records the handover's own delivery commit. A local file or prepared prompt does not establish a successful push or a started receiving session.

## GitHub maintenance

Use the documented project workflow. Derive progress from issues, PRs and gate evidence. Preserve existing assignments and manually selected planning fields unless explicitly changing them. A closed unmerged PR is abandoned or superseded work, not a completed delivery.

