# Reusable orchestrator startup design

Issue: [#160](https://github.com/Maeximilion/MaexSocial/issues/160).

## Intent and authority

The owner requests a manually started replacement coordinator with the complete established MaexSocial operating contract. The current coordinator delivers only this skill/prompt through its reviewed PR. The owner delegates routine technical decisions and has opted out of repeated design questions. This design records coordinator choices; it grants no new product, deployment, external-access or spending authority. The owner's transition reply leaves paused PR157 to the successor; this delivery is the one-time independent bootstrap exception to the new concurrent-stack rule.

## Approaches and choice

1. Copy the entire conversation into a prompt: rejected because historical controls conflict and private machine/chat details would leak.
2. A second independent orchestration system: rejected because duplicate admission/merge rules drift.
3. Extend the existing coordination skill and durable record, with a thin manual entry and a complete linked startup prompt: selected. Existing verified Claude API review, admission, recovery and serial merge controls remain authoritative.

## Delivery

- `.agents/skills/maexsocial-orchestrator/SKILL.md` and explicit-only native metadata expose `$maexsocial-orchestrator`. No invented terminal command or Claude command registration.
- `.codex/orchestration/START.md` is the full copyable prompt. README holds standing controls; CURRENT holds a truthful replacement handover. The old local coordinator checkpoint remains preserved, not reset or blindly merged.
- Existing coordination skill owns worker dispatch, active Graphify evidence, required stacks, gate/task dependencies and single-writer takeover. Worker instructions require precise objective/contracts/checks, not coordinator-provided guessed file paths.
- Future coordinator performs a bounded Ponytail audit, then creates/deduplicates one P1 umbrella and child gap issues. Full product planning analysis belongs to that successor, not this bootstrap.

## Invariants

Owner scheduling order: verified security work first, open PRs second, then new issues/tasks by eligible gate, real dependencies and priority high to low. This ranks authorized work; it does not activate advisory scans or bypass pauses, product authority or stack prerequisites.

Only one verified coordinator writes admission/merge state. Takeover alone never resumes paused product work. The supplied full prompt explicitly authorizes planning audit; implementation resume remains a separate explicit clause. Current owner pauses beat old published resumes. Five unarchived work chats maximum; large waves use two/three; original one-PR/one-chat and merge-plus-archive replacement rules stay intact.

Concurrent delivery PRs form one verified parent/base stack. Semantic task dependencies and stack ordering remain distinct. Merge one bottom PR at a time into the intended integration target, then rebase/retarget and revalidate each successor's actual layer/head/base. Never merge a child into an unmerged feature branch merely to call it delivered, or perform simultaneous/whole-stack merges. Unavailable native stack capability is reported, not simulated; hold additional publication until a real supported stack can be established.

Graphify is active discovery, not an authority source or a permission to upload private data. Its observed MaexSocial index is queryable at the current main commit, but current plan coverage indexes only README documents. Read required plans, instructions and changed/local source directly. Report graph repository/commit/coverage/query and fallback honestly.

Preserve Claude model/effort/speed/API route/budgets/secrets/settings byte-for-byte; changing them needs an explicit owner request. Product AI decisions remain separate from development AI. MCP and model APIs are different layers. Ponytail loading is not proof of activation; neither Headroom nor RTK is installed/changed by this work. Future evaluation measures fidelity as well as token savings and retains full diagnostic/review evidence.

## Validation

Baseline instruction walkthrough found missing startup/takeover/audit contracts and an explicit independent-PR policy conflicting with the new request. Add a manual-entry wiring regression and scenario cases for paused/dual takeover, absent/stale Graphify, stack transitions and base movement, gate blockers, gap tracking and Claude configuration protection. Run repository/Foundation/Node checks, then actual complete Claude API review and current integration CI. No separate Codex PR review. Do not claim real native dispatch/stack/merge rehearsal or product runtime proof from documentation scenarios.
