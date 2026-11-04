# Handover 2026-11-04 — MS-008 to MS-010, product design and first build

Status — Future session. Product implementation awaits completed synthesis and approved G2 design.

Artifacts — Repository `Maeximilion/MaexSocial`, [synthesis handover](synthesis.md), [charter](../00_PCF.md), [architecture questions](../02_ARCHITECTURE.md), [work packages](../07_WORKPACKAGES.md). Create a task branch after checking current main and open work.

Decisions — Reuse the established repository process. Choose technology from the first approved slice. All code reviews use `gpt-6-astra` with reasoning `high`, verified in the actual review session.

Gate — MS-008 approves design, MS-009 supplies a concrete implementation plan, MS-010 implements and proves G3.

Open — Confirm G1 evidence and the actual G2 decision before application scaffolding.

Lessons — Foundation checks establish repository health. Live API capability, content quality and autonomous publication each need their own proof. Code-autopilot and caveman remain disabled. Code-autopilot's GPT/Codex compatibility remains unverified.

## Required plan

Keep `C:/Users/Maxi/Documents/ChatGPT/MaexSocial` on clean `main`. Application changes and tests under `tests/` belong in a separate task worktree following [playbooks](../12_CLAUDE_CODE_PLAYBOOKS.md). After merge and regularly, require an empty canonical working tree, then `git fetch --prune origin` and `git pull --ff-only origin main`. Never pull with dirty files.

Use Superpowers brainstorming to settle first customer/channel, user journey, account authority, scope, provider access, cost and deployment choices. Record alternatives and rationale in a product design. Obtain G2 approval. Then use writing-plans to specify files, interfaces, schemas, tests, migration/rollback behavior and independently verifiable tasks.

The first slice must exercise real business flow with synthetic data and authorized test accounts. Include revoked tokens, cross-tenant requests, edited approvals, duplicate submissions, ambiguous provider timeouts and stop behavior. Add media generation after the publication slice is proved. Autonomous operation follows explicit policy and a supervised pilot.

## Start prompt for the build chat

Begin MaexSocial design/build from the current repository state. Read root instructions, docs/01_STATUS.md, docs/research/synthesis.md and the approved product design if present. Work through MS-008 and MS-009 with Superpowers before MS-010. Verify actual G2 approval and available provider access. Implement the approved first slice through normal entry points, run its acceptance checks and obtain gpt-6-astra high review on the current head. Keep code-autopilot and caveman disabled.
