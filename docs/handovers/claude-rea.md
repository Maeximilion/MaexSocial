# Handover 2026-11-04 — MS-004, Claude Code REA

Status — Independent Claude Code analysis is pending. Public baseline research and the Codex lane are separate inputs.

Artifacts — Repository `Maeximilion/MaexSocial`, local folder `C:/Users/Maxi/Documents/ChatGPT/MaexSocial`, target `https://app.socialedge.ai/de/dashboard`. Create branch `research/MS-004-claude-rea` from current main after checking open work.

Decisions — Analyze SocialEdge to establish the feature baseline for MaexSocial. Preserve evidence provenance and uncertainty. Code-autopilot and caveman remain disabled. Code-autopilot was built for Claude Code and its GPT/Codex compatibility remains unverified.

Gate — G1 requires both REA lanes and synthesis. Product design is approved at G2.

Open — Read root instructions and status, then the REA skill and relevant browser/runtime guide. Verify actual tools in this session. A historical registration check does not prove a live connection.

Lessons — The initial Codex web tool failed, but later unauthenticated HTTP capture succeeded. REA CLI analyzed three selected client chunks, with partial coverage and evidence IDs recorded in `docs/research/codex-rea.md`. Authorized runtime workflows remain open. Public SocialEdge claims describe services and may include human operations.

## Assignment

Keep `C:/Users/Maxi/Documents/ChatGPT/MaexSocial` on clean `main`. Follow the exact synchronization/worktree workflow in [playbooks](../12_CLAUDE_CODE_PLAYBOOKS.md). Work in `C:/Users/Maxi/Documents/ChatGPT/MaexSocial-worktrees/claude-rea`. After merge, return to the clean canonical checkout, fetch with pruning and pull with `--ff-only`. Never pull with dirty files.

Read [charter](../00_PCF.md), [work packages](../07_WORKPACKAGES.md) and [research handling](../09_OPERATIONS_LEGAL.md). Inspect public homepage, product/pricing pages and authorized application workflows. Enumerate business/profile setup, content generation/editing, scheduling/publication, reviews, rankings/analytics, directory synchronization, CRM/follow-up and media functionality. For each record entry point, required inputs, outputs, states, integrations, operator involvement and observed failure handling.

Use the connected REA tool inventory and exact schemas. Where browser/runtime access is available, declare scenarios and record observations. Where static frontend artifacts are legitimately available, analyze them without executing unknown code. Avoid duplicate analysis when retained evidence exists. Respect authentication barriers and the scope of permitted account actions.

## Deliverable

Write `docs/research/claude-rea.md` with target/date/access, tool versions, scenario list, capability table, evidence IDs, sources, reproducible steps, inferences and unresolved gaps. Identify public claims, UI observations, static observations and runtime observations separately. Raw authenticated captures remain outside Git. Commit only sanitized conclusions and necessary original illustrative artifacts.

Independently establish observations before comparing the Codex report. Then add disagreements without rewriting the other lane. Update MS-004 and status with actual completion or access blockers. Open a PR referencing the MS-004 issue once its number is known.

## Start prompt

Work on MaexSocial task MS-004 using this handover and the installed REA skill. Inspect the authorized SocialEdge target and write a reproducible sanitized report. Begin with a short scenario plan and actual connection check. Keep unsupported claims and access gaps explicit. Use the current repository rules, keep code-autopilot/caveman disabled, and stop at the research deliverable.
