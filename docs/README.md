# Documentation

Start with [status](01_STATUS.md), then the [project charter](00_PCF.md) and [work packages](07_WORKPACKAGES.md). Documents marked provisional contain questions and proposed boundaries for G2, not implemented application behavior.

| Document | Purpose |
|---|---|
| [00 Project charter](00_PCF.md) | Scope, decisions, gates and acceptance evidence |
| [01 Status](01_STATUS.md) | Current work and the next session |
| [02 Architecture](02_ARCHITECTURE.md) | Provisional components and decision criteria |
| [03 Data model](03_DATA_MODEL.md) | Domain concepts and invariants for design |
| [04 API tools](04_API_TOOLS.md) | Integration feasibility and side-effect contracts |
| [05 Content policy](05_CONTENT_POLICY.md) | Brand facts, generation and publication authority |
| [06 GUI](06_GUI.md) | User journeys and required visible states |
| [07 Work packages](07_WORKPACKAGES.md) | Task IDs, dependencies, deliverables and status |
| [08 Evaluations](08_EVALS.md) | Evidence required before each release gate |
| [09 Operations and legal](09_OPERATIONS_LEGAL.md) | Research handling, credentials and operating decisions |
| [10 Glossary](10_GLOSSARY.md) | Shared terminology |
| [12 Playbooks](12_CLAUDE_CODE_PLAYBOOKS.md) | Session, task, review, gate and handover workflows |
| [15 Brand and assets](15_README_STRATEGY.md) | Deep Tech palette, contrast rules, original assets and honest README presentation |
| [16 GitHub project](16_GITHUB_PROJECT.md) | Project fields, metadata and maintenance |
| [17 Access and security](17_ACCESS_SECURITY.md) | Public registration, customer isolation and separate platform administration |
| [ADR 0001 Application language](decisions/0001-application-language.md) | Delegated TypeScript strict choice and runtime-validation boundaries |
| [18 Customer media library](18_MEDIA_LIBRARY.md) | Requested uploads, AI creation, calendar, recurrence and optional advertising; bounded API evidence and proposed acceptance cases |
| [Application anatomy](architecture/README.md) | Proposed code layout and runtime trust boundaries, pending G2 |
| [Upload security](security/uploads.md) | MS-014 threat model, initial SVG rejection and UPLOAD-01–10 acceptance contracts |
| [Agent workflow](tooling/agent-workflow.md) | Real Claude/Codex entry points, hook trust, plugin/MCP loading and limitations |
| [Agent anatomy plan](superpowers/plans/2026-11-05-agent-anatomy-and-asset-security.md) | Foundation structure, hook and artwork-guard implementation |
| [Foundation design](superpowers/specs/2026-11-04-foundation-design.md) | Authorized repository foundation |
| [Foundation plan](superpowers/plans/2026-11-04-foundation.md) | Verifiable setup steps |
| [Handover index and template](handovers/README.md) | Lane briefs, separate session records and required restart information |
| [Review workflow brief](handovers/review-workflow.md) | Handover-structure delivery, manual review and MS-014 sequence |
| [Claude REA handover](handovers/claude-rea.md) | Independent application analysis |
| [Codex REA handover](handovers/codex-rea.md) | Reproducible application evidence |
| [Synthesis handover](handovers/synthesis.md) | Reconcile research before design |
| [Build handover](handovers/build.md) | Start implementation after G2 |

Research reports live in `docs/research/`. The source report and its evidence identifier are authoritative for a research claim. GitHub milestones and boards expose progress, while gate evidence and decisions live in these documents.
