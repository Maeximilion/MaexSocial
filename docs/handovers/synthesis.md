# Handover 2026-11-04 — MS-007, research synthesis

Status — Pending the Codex and Claude reports and the other G1 deliverables.

Artifacts — Repository `Maeximilion/MaexSocial`, `docs/research/`, [work packages](../07_WORKPACKAGES.md), [charter](../00_PCF.md), [status](../01_STATUS.md). Use branch `docs/MS-007-synthesis` after checking current work.

Decisions — Product name MaexSocial. SocialEdge is the comparison baseline. Target ambitions include autonomous account care, publication, image/video editing and image-to-ad generation. Technology and paid-provider choices remain open.

Gate — G1 closes only with reconciled evidence or explicitly accepted coverage limits. G2 requires Maxi's design approval.

Open — Inventory actual report files and their evidence before choosing the first product slice.

Lessons — Public marketing, static analysis and observed runtime behavior support different conclusions. Missing Claude execution cannot be substituted with a second Codex summary. Code-autopilot and caveman remain disabled, with code-autopilot's GPT/Codex compatibility unverified.

## Synthesis procedure

Keep the canonical folder on clean `main`, with edits in a separate synthesis worktree. Follow [playbooks](../12_CLAUDE_CODE_PLAYBOOKS.md). After merge and regularly, require a clean canonical checkout, then `git fetch --prune origin` and `git pull --ff-only origin main`. Never pull with dirty files.

1. Build a matrix with capability, public claim, Codex observation, Claude observation, source/evidence IDs, API feasibility, human work and uncertainty.
2. Resolve conflicts using target version, date, account tier and scenario coverage. Keep unresolved conflicts visible.
3. Match features to official API/MCP capabilities and account-review requirements. Record cost assumptions and unsupported automation.
4. Summarize candidate Claude video demos and identification confidence. An unidentified original video does not establish a provider choice.
5. Propose one complete first slice, follow-on stages, and the decisions Maxi must make at G2.
6. Write `docs/research/synthesis.md`, update status/work packages and link the issue/PR.

## Start prompt for the new chat

Synthesize the MaexSocial research under task MS-007. Read repository instructions, current status and every completed report in docs/research. Reconcile the independent Claude Code and Codex REA findings with public sources and official API feasibility. Identify missing reports before claiming completion. Produce the capability matrix, disagreement ledger and a recommended first slice, then prepare G2 product design choices with Superpowers. Keep product implementation behind G2 approval.
