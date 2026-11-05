---
disable-model-invocation: true
---

Read AGENTS.md, CLAUDE.md, docs/00_PCF.md and docs/01_STATUS.md. Check git status and branch. Fetch origin with --prune. In the clean canonical main checkout, pull --ff-only origin main. Stop on divergence or unrelated edits. Identify the next unblocked task from docs/07_WORKPACKAGES.md and its GitHub issue. State the scope and verification before editing. Create a separate worktree from current main for changes, using the client's managed tool when available.

Only an explicit user invocation of /start or its source-command-start skill runs this workflow and its advisory check in docs/19_LOCAL_SECURITY.md. Do not invoke it automatically when a session opens. Briefly report Dependabot P0/P1 and security/quality findings, or an unavailable check, then continue the requested work. Do not pause or block tasks, require prior remediation, or automatically create remediation chats.
