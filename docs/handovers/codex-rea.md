# Handover 2026-11-04 — MS-003, Codex REA

Status — Bounded Codex static report delivered in `docs/research/codex-rea.md`. Consult its evidence and coverage limits before repeating any analysis. Authenticated runtime remains unverified.

Artifacts — Repository `Maeximilion/MaexSocial`, local folder `C:/Users/Maxi/Documents/GitHub/MaexSocial`, target `https://app.socialedge.ai/de/dashboard`. Continue the assigned research branch or create `research/MS-003-codex-rea` after checking existing work.

Decisions — Gather reproducible application evidence for MaexSocial's feature baseline. Code-autopilot and caveman remain disabled. Code-autopilot's GPT/Codex compatibility remains unverified.

Gate — G1 requires independent lanes, official API feasibility and synthesis. Product implementation waits for G2.

Open — Read current research output, identify the smallest unanswered question and use the appropriate REA route.

Lessons — Prior local test found REA CLI 6.8.0 working and direct Codex MCP registration missing. That result is historical. Recheck relevant tool availability before changing configuration. The initial dashboard web fetch failed.

## Assignment and deliverable

Keep the canonical folder on clean `main`. Work in a separate task worktree following [playbooks](../12_CLAUDE_CODE_PLAYBOOKS.md). Regularly and after merge, require empty `git status --porcelain`, then `git fetch --prune origin` and `git pull --ff-only origin main` in the canonical checkout. Never pull with dirty files.

Use the same capability questions as [Claude's brief](claude-rea.md). Record product/profile setup, content workflows, publication, reviews, analytics, directories, CRM/follow-up and media. Public offer claims and observed application behavior need separate evidence classes. Use a CLI fallback when supported. Preserve REA evidence IDs and tool output limitations.

Write the lane's sanitized findings in `docs/research/codex-rea.md`, or link an already-created equivalent report from that path. Include exact target, date, access scope, commands/scenarios, versions, observations, inferences and remaining gaps. Raw scripts/captures containing proprietary code or account data stay outside the public repository.

A login barrier is a scoped limitation. Continue supported public/static work and identify what an authorized logged-in session would resolve. Update MS-003 and status honestly. Do not mark the independent Claude lane complete.

## Start prompt

Continue MaexSocial MS-003 from the latest recorded evidence. Read the installed REA skill and this handover. Analyze only the supplied SocialEdge target and available authorized artifacts, retain evidence IDs, and produce a sanitized report suitable for comparison with Claude Code's independent report. Preserve access gaps and keep code-autopilot/caveman disabled.
