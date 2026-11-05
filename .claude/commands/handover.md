Use the [handover index and template](../../docs/handovers/README.md). Briefs assign future work; a session handover records where this session stopped.

1. Before context runs out, stop at a clean checkpoint. Inspect the task branch and working tree, preserve unrelated changes, and commit your completed task changes. Record `git rev-parse HEAD` as the full work head before the handover commit, along with actual verification and review results.
2. Create a new `docs/handovers/sessions/YYYY-MM-DD-<topic>.md` using the complete template: `# Handover YYYY-MM-DD — <task IDs>`, then Status, Artifacts, Decisions, Gate, Open (next concrete action first), and Lessons. One file per handover; never append to a shared file or overwrite an earlier record. Use a distinct topic suffix if the path exists.
3. Record the UTC stopping time in Status. Include repository, task ID and issue, branch, full head SHA and PR, implementer/reviewer direction (`Codex → Claude review` or `Claude → GPT-6 Astra review`), and a runnable start: console, exact folder/worktree, full start command and first message. Mark missing or unverified facts explicitly. Do not claim a pending review or receiving session has run.
4. Use the permanent sessions-folder link under **Delivered evidence and handovers** in `docs/01_STATUS.md`. Update status only when a gate, work lane or blocker changes.
5. Run `python scripts/check_repo.py`. Commit the session record and any actual status change on the task branch, push, and verify the remote head and clean working tree. Keep the PR, issue and Project consistent with the observed state; fetch with pruning after PR updates.
6. Only after the handover is committed and pushed may an authorized new session start. If saving or pushing fails, retain the work and report the precise blocker before switching sessions.

Include the current owner-selected skill settings when the receiving session needs them. Do not start another agent session without the user's authorization.
