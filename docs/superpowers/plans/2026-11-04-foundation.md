# MaexSocial Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal** — Deliver the requested repository foundation, verified GitHub planning and self-contained REA handovers.

**Architecture** — Repository documents define gates and task contracts. GitHub mirrors delivery state through issues, milestones and one Project. Foundation automation checks actual repository artifacts.

**Tech Stack** — Markdown, SVG, GitHub Issues/Projects/Actions and small repository-maintenance scripts. The application stack is undecided.

**Spec** — [Foundation design](../specs/2026-11-04-foundation-design.md).

## Global Constraints

- Product name is MaexSocial and repository is Maeximilion/MaexSocial.
- Repository content is public and research artifacts must be sanitized.
- Application stack and paid providers remain undecided until G2.
- Code-autopilot and caveman remain disabled.
- Code reviews use gpt-6-astra with reasoning high, verified in the actual session.
- Product implementation follows research synthesis and explicit G2 design approval.
- Project automation remains disabled until its dedicated credential is configured and verified.

## Review Focus

- Repeated setup must preserve an existing repository, Project and issues without duplicates.
- Missing Project credentials must leave automation visibly disabled.
- A closed unmerged PR must not become evidence of completed delivery.
- Untrusted PR content must not execute with repository or Project write credentials.
- A research access failure must remain a recorded gap rather than a fabricated capability.

## Task A — Reference and repository foundation, MS-001

Files include root README/agent rules, `.github/assets/`, numbered docs and the design above. Inputs are Maxi's requirements and read-only reference inspection. Output is a consistent foundation with no product capability claims beyond evidence.

- [ ] Inspect reference conventions and existing MaexSocial state.
- [ ] Record visibility, license handling, scope and current gate.
- [ ] Create documentation, root instructions and original assets.
- [ ] Check local links, task references and absence of secrets/private captures.
- [ ] Inspect the README assets visually and record any rendering limitations.

## Task B — GitHub planning, MS-001

Inputs are the task table and G0–G5 criteria. Outputs are repository metadata, one Project, gate milestones, labels and linked task issues.

- [ ] Discover existing repository and Project before creating missing resources.
- [ ] Provision labels, milestones and issues with acceptance criteria and stable task IDs.
- [ ] Configure Project fields and iteration, add issues and record actual URLs.
- [ ] Repeat read-only discovery and assert a single matching item per task.
- [ ] Verify remote default branch, public visibility and branch protection state.

## Task C — Foundation workflows, MS-001

Files are `.github/workflows/`, templates and the maintenance scripts created by the coordinator. Inputs are repository metadata and GitHub events. Outputs are foundation validation and factual metadata maintenance.

- [ ] Implement only checks and maintenance needed for the foundation.
- [ ] Add focused regression checks for retry/idempotency, closed-unmerged PR handling and absent credentials where custom logic exists.
- [ ] Validate workflow syntax, least permissions and handling of untrusted PR text.
- [ ] Run checks locally and through Actions on the pushed head.
- [ ] Enable required checks only after their exact names and successful runs are verified.
- [ ] Record Project synchronization as disabled while its credential is missing.

## Task D — Research and session handovers, MS-002–007

Files are `docs/handovers/{claude-rea,codex-rea,synthesis,build}.md` and lane reports under `docs/research/`. Inputs are the target URL and public baseline. Outputs are reproducible assignments and eventually the evidence needed for G1.

- [ ] Give Codex and Claude the same questions and separate report paths.
- [ ] Record target identity, access level, tool versions, evidence IDs and coverage limits.
- [ ] Sanitize artifacts and keep raw authenticated captures outside Git.
- [ ] Preserve access failures and disagreements in the synthesis input.
- [ ] Prepare the new synthesis chat with exact starting instructions.

## Completion record

The coordinator updates [status](../../01_STATUS.md) with actual checks, remote links and remaining blockers. Checkboxes above are execution tracking and must be checked only after verification. MS-001 may be delivered with a documented Project-credential follow-up, while G0 must explicitly record any accepted exception. MS-008 and product implementation remain gated by G1 and G2.
