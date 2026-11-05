# MaexSocial project charter

## Purpose

MaexSocial will manage local visibility and social media through AI and supported APIs. The intended scope includes business-profile maintenance, content planning and publication, reputation workflows, measurement and eventually image-to-video advertising. SocialEdge supplies the comparison baseline. The final scope follows evidence from its public offer and accessible application workflows.

## Decisions recorded on 2026-11-04

- Maxi selected **MaexSocial** as the product and repository name.
- Maxi authorized a GitHub foundation modeled on Maex-Voice-Agent, including documentation, tasks, gates, milestones, project, workflows and handovers.
- Maxi explicitly selected a public repository, matching Maex-Voice-Agent, after the private-repository ruleset limitation was identified. Commit sanitized research reports only.
- Product implementation follows two independent REA investigations, synthesis in a new chat and an approved design.
- The application language, database, deployment platform and paid providers remain design decisions at G2.
- Code reviews use `gpt-6-astra` with reasoning `high`. Report the actual setting. A written recommendation does not switch a model.
- Code-autopilot and caveman remain disabled. Code-autopilot originated in Claude Code and its GPT/Codex compatibility is unverified.
- Maxi requires the canonical local folder to remain on clean `main`, with regular `fetch --prune` and `pull --ff-only` after merges. Changes belong in separate worktrees. Never pull a dirty checkout.

## Gates

Language update, 2026-11-05 — Maxi delegated technology selection. [ADR 0001](decisions/0001-application-language.md) chooses TypeScript with strict checking as the application baseline, with Node.js API/orchestration as the direction. Framework, authentication, database, deployment and provider decisions remain part of G2. This updates the initial language deferral above without approving the full product design.

On 2026-11-05 Maxi confirmed a public website with customer registration/login, a tenant-isolated customer dashboard, and separate platform-administrator access to view and manage customers. [MS-013](https://github.com/Maeximilion/MaexSocial/issues/30) defines the access design and tests as part of G2. The requirements are confirmed; authentication provider, detailed controls and architecture still need design acceptance.

| Gate | Outcome | Required evidence | Authority |
|---|---|---|---|
| G0 Foundation | Repository ready for coordinated work | Reachable repo/project, linked task issues, valid docs and workflows, successful CI, verified settings and handovers | Coordinator records checks |
| G1 Discovery | Supported feature baseline | Public inventory, Codex and Claude REA reports, API feasibility, video-demo search, synthesis with unresolved gaps | Evidence owner records findings, Maxi resolves material access gaps |
| G2 Design approval | One buildable first release | Approved scope, architecture decision, access/security design, selected providers and costs, autonomy policy, data model, acceptance tests and implementation plan | Maxi approves product design |
| G3 First vertical slice | One end-to-end content workflow | One brand and supported channel, draft/approval/publication/result path, accepted registration/admin/tenant tests, revoked-auth and duplicate-send tests, exact-head CI and review | Release owner verifies acceptance |
| G4 Media | Image-to-video workflow | Rights/provenance, approved input, render job lifecycle, quality review, cost cap and failed-job recovery | Release owner verifies acceptance |
| G5 Bounded autonomy | Account operation under explicit policy | Scoped account authority, schedule and budget enforcement, stop control, retries/reconciliation, audit history, supervised pilot measurements | Maxi approves live operating envelope |

Passing a gate requires dated evidence and a decision recorded in [status](01_STATUS.md). A completed issue or a green documentation build does not prove a product gate. Gate tags are created only after their criteria pass.

## Scope and sequence

G0 establishes collaboration. G1 compares capabilities and technical feasibility. G2 chooses the smallest full workflow that tests the product proposition. G3 builds that workflow. G4 adds media creation. G5 expands operating authority based on measured reliability. Independent G1 tasks may run in parallel. Their reports must identify the same target and observation date.

## Open decisions

On 2026-11-05 Maxi requested a customer-owned media library feeding AI-assisted creative production, scheduled/recurring social content and optional customer-authorized advertising. [The feature proposal](18_MEDIA_LIBRARY.md) records this direction separately from observed SocialEdge functionality. Providers, first channel, detailed behavior and advertising priority remain G2 decisions.

At G2 decide first customer type and channel, target account ownership, paid service budget, hosting region, retention periods, publication authority and required human escalation. These decisions must be tied to the first release rather than guessed across every possible integration.
