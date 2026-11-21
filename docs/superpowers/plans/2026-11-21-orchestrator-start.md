# Orchestrator startup implementation plan

**Goal:** Deliver issue160's reusable manual coordinator entry, complete prompt and safe handover.

**Architecture:** Thin explicit-only Codex skill calls the existing coordination contract; repository records remain the shared source of truth.

**Tech stack:** Markdown, existing Codex skill YAML and Python unittest wiring checks. No new dependency or runtime service.

**Spec:** [Startup design](../specs/2026-11-21-orchestrator-start-design.md).

## Global constraints

Product work and157 remain paused. Only the owner-authorized bootstrap may be implemented/merged here. English repository artifacts, standard speed, protected Claude configuration unchanged. No new coordinator dispatch. Root owns orchestration records and serial merge; implementation helper owns only its assigned skill/test/tooling files.

## Review focus

1. A stale published resume must not override a newer local pause.
2. A second coordinator must not steal a live writer's ownership.
3. Stack topology alone does not prove compatible integration or product dependencies.
4. Partial Graphify documentation coverage must not omit gate/security requirements.
5. Queue importance follows verified security work, open PRs, then gate/task/priority-ordered new work without bypassing controls.
6. Autonomous planning decisions must not silently authorize paid runtime, deployment or Claude changes.

## One delivery

1. Record baseline scenario failures; add and run the manual-entry wiring test before new skill files exist.
2. Create explicit-only `maexsocial-orchestrator` wrapper; extend `coordinate-project-chats` and scenario fixtures. Link the startup contract from `docs/tooling/agent-workflow.md` and remove obsolete routing-pause wording only in touched operating guidance. Preserve all Claude settings/workflows.
3. Root writes `.codex/orchestration/START.md`, updates README and updates CURRENT with a current handover while preserving historical checkpoints. Add a six-section session handover before first PR.
4. Run the wiring test, repository checker, full foundation suite and Node metadata tests. Evaluate scenarios against the changed contract; record actual evidence and limitations.
5. Commit/push one normal PR closing160, attach it here, wait for authentic complete Claude API review and candidate CI, fix confirmed findings in the same PR, then perform serial guarded merge and synchronize clean canonical main.
6. Publish the full copyable prompt and verified invocation. Do not start the new coordinator. Preserve the old local pause and explicitly hand ownership transfer to the owner's manually started successor.
