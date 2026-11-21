# MaexSocial coordinator

Start with `$maexsocial-orchestrator`: read the [MaexSocial adapter](../../.agents/skills/coordinate-project-chats/SKILL.md) and verify the personal skill's pinned hash before loading its general loop. The personal skill remains outside the repository with implicit invocation disabled. Missing or changed editions follow the adapter's reviewed-update rule; never claim execution of unavailable capabilities. The [short start prompt](START.md#complete-prompt-to-copy) and [manual entry](../../.agents/skills/maexsocial-orchestrator/SKILL.md) load this arrangement.

## Current authority and records

The live private ledger, actual chats and newest verified owner instruction identify the sole acting coordinator and current pause, usage, deadline and scope controls. [CURRENT](CURRENT.md) and preserved checkpoints are dated recovery evidence; they cannot override newer controls. Verify relinquishment and reconcile in-flight work before takeover. A status request or skill invocation alone does not resume paused work.

Read the current issue and repository instructions. [Status](../../docs/01_STATUS.md), [work packages](../../docs/07_WORKPACKAGES.md), [charter and gates](../../docs/00_PCF.md), and live issues/PRs provide product evidence. Only the acting coordinator updates the coordination record. Keep chat IDs, account readings and machine-specific details private. Workers retain their issue/PR and a short [task handover](../../docs/handovers/README.md) with revision, actual checks, limitations and next owner/action.

## Project operations and downloads

Routine authorized work includes task worktrees, Git, tests, fixes, the agreed PR workflow and post-merge closeout without repeated owner questions. It grants no new paid service, real-customer operation, deployment, product gate acceptance or Claude configuration change.

Request High reasoning and Standard speed, with full access (`danger-full-access`/`never`). Verify each actual coordinator/worker turn. A prompt, global configuration, local start or `auto_review` is not proof of runtime rights; a successful local/High test chat proves only that chat. Use only supported, owner-authorized app settings. Never invent setters, edit hidden app state, self-confirm native approvals or bypass rejections. Continue work permitted by the actual profile and report specific gaps.

The owner explicitly requested unrestricted normal native chats on 2026-11-21. This changes the desired access recommendation, with the [documented security tradeoff](../../.agents/skills/coordinate-project-chats/SKILL.md#decisions-and-actual-permissions); no access configuration is changed by this maintenance PR.

Before a large external download, obtain owner confirmation. The provisional boundary is 100 MiB for the combined related transfer, including split parts. For unknown size, verify/enforce an upper bound within that cap or obtain confirmation. Quarantine downloaded bytes until an isolated antivirus scan with current signatures returns a clean, complete result. Verify their SHA-256 before release for opening, extraction, installation, execution or tool use. Detection, incomplete/stale scan or checksum mismatch keeps quarantine. Use verified local copies meanwhile.

## Run the queue

The adapter defines scheduling and merge details: evidenced security work, open PRs, then eligible gate/task priority. Admission needs an eligible authorized task, a free slot and 600 seconds since the previous actual worker start. Maximum five occupied workers, counting pending creations; use a lower two/three limit for large work when appropriate. Reconcile uncertain starts; never accumulate missed intervals or require historical predecessor-PR admission tokens. Latest owner pause, drain/serial, usage and deadline controls take precedence.

Read current shared usage before each admission and approximately every ten minutes while active. The standing intake cutoff remains 7% remaining unless the owner changes it: at or below the cutoff, or with an unknown reading, hold new intake. Already-admitted work may continue only absent a full pause. A newer explicit threshold or stop overrides this default; quota reset alone never resumes work. Keep account readings private.

Use Superpowers for planning and Ponytail before opening a PR. Preserve the subsequent [Claude API review policy](../../docs/tooling/agent-workflow.md#pr-review-policy), required current-candidate CI, verified stack for concurrent delivery PRs and serial guarded merges. Green CI is not product acceptance. Keep canonical main clean; implement in separate task worktrees. Advisory scans still require explicit `/start` or `/task`.

Prefer `send_message_to_thread` in both directions when the original human authorization covers the sender/destination and the tool is available. Workers send concise questions, meaningful milestones and completion reports; Main answers without continuous polling or routine owner round trips. Make at most one send attempt per message. Do not handle or bypass a native approval prompt or blocker. If sending is unavailable, unauthorized, blocked or uncertain, leave the question/result in its originating chat; Main uses bounded `wait_threads` and targeted `read_thread` as fallback. Distinguish send result, observed receipt and acknowledgment; never claim a tool-free channel or inherited full access. Only the dependent action waits while independent authorized work continues.

After verified merge, remote revision and handover, automatically close the owned task worktree and archive its chat. Preserve genuinely needed unpublished material selectively; protect canonical, foreign, nested and active worktrees. Verify worktree and chat disposition separately before releasing the slot. Do not create routine recovery folders, bundles, clones, transcript/index copies or reproducible-volume backups. A full pause prevents new closeout operations; settle only those already in flight and save the necessary checkpoint locally.
