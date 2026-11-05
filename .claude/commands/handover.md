Use the [handover index and template](../../docs/handovers/README.md). Briefs assign future work; a session handover records where this session stopped.

1. Before context runs out, stop at a clean checkpoint. Inspect the task branch and working tree, preserve unrelated changes, and commit your completed task changes. Record `git rev-parse HEAD` as the full work head before the handover commit, along with actual verification and review results.
2. Create a new `docs/handovers/sessions/YYYY-MM-DD-<topic>.md` using the complete template: `# Handover YYYY-MM-DD — <task IDs>`, then Status, Artifacts, Decisions, Gate, Open (next concrete action first), and Lessons. One file per handover; never append to a shared file or overwrite an earlier record. Use a distinct topic suffix if the path exists.
3. Include repository, task ID and issue, branch, full head SHA and PR, implementer/reviewer direction (`Codex → Claude review` or `Claude → GPT-6 Astra review`), and a runnable start: console, exact folder/worktree, full start command and first message. Mark missing or unverified facts explicitly. Do not claim a pending review or receiving session has run.
4. Add exactly one dated line linking this session file under **Delivered evidence and handovers** in `docs/01_STATUS.md`. Store the full block in the session file, not in status or a lane brief.
5. Run `python scripts/check_repo.py`. Commit the new session file and status entry on the task branch, push, and verify the remote head and clean working tree. Keep the PR, issue and Project consistent with the observed state; fetch with pruning after PR updates.
6. Only after the handover is committed and pushed may an authorized new session start. If saving or pushing fails, retain the work and report the precise blocker before switching sessions.

Code-autopilot and caveman stay disabled; code-autopilot's GPT/Codex compatibility is unverified. Do not start another agent session without the user's authorization.
