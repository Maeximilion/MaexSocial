# Project status

- Status date — 2026-11-04
- Stage — G1 discovery, foundation implemented
- Current gate — G1; G0 technical checks complete
- Product implementation — pending G2 design approval
- Repository — https://github.com/Maeximilion/MaexSocial
- Project — https://github.com/users/Maeximilion/projects/5

## Current work

| Work | State | Evidence |
|---|---|---|
| GitHub foundation, MS-001 | Done; PR #19 foundation and PR #24 scoped API correction | [Foundation PR](https://github.com/Maeximilion/MaexSocial/pull/19), required checks and local verification |
| Public product baseline, MS-002 | In progress | Public SocialEdge sources identified in the initial research |
| Codex REA, MS-003 | Bounded static report delivered | [Codex report](research/codex-rea.md), authenticated runtime remains unverified |
| Claude Code REA, MS-004 | Pending independent session | [Claude handover](handovers/claude-rea.md) |
| Synthesis, MS-007 | Waiting for research reports | [Synthesis handover](handovers/synthesis.md) |
| Product design and build, MS-008–012 | Planned | [Work packages](07_WORKPACKAGES.md) |

## What's next

1. Continue G1 research tasks. Hosted Project synchronization is verified using the owner-provided PROJECT_TOKEN.
2. Run the independent Claude Code REA assignment and compare it with the delivered Codex static report.
3. Complete official API feasibility and identify credible candidates for the remembered Claude video demo.
4. Use a new synthesis chat to compare evidence, resolve disagreements and prepare the G2 design decision.

## Known evidence limits

The initial web tool could not open `https://app.socialedge.ai/de/dashboard`, but a subsequent unauthenticated HTTP capture succeeded. REA 6.8.0 analyzed three selected client chunks as static text. The [Codex report](research/codex-rea.md) records evidence IDs and partial coverage. Authenticated runtime, private backend behavior and autonomous publication remain unverified. Prior local diagnostics found direct Codex MCP registration missing. Claude registration was present, but a live Claude investigation had not been run.

## Decisions

MaexSocial name and public repository visibility confirmed by Maxi. Reference-repo conventions are adapted to the current project. Both optional code-autopilot/caveman skills stay disabled. Product technology and provider choices wait for G2. The owner configured the dedicated GitHub Project credential. Targeted API queries preserve the project/public_repo scope choice. Hosted reconciliation is active and verified. Local synchronization remains available.

## Done and handovers

- 2026-11-04 — Maex-Voice-Agent documentation and GitHub conventions inspected read-only. Repository foundation, gates and handover briefs authored. Public repository and Project #5 verified, 12 tasks and 6 parent gate issues created, 6 milestones and 3 real iterations provisioned. PR #19 carries the foundation and bounded Codex report. Local link/JSON validation and nine regression tests pass. The initial GitHub foundation and metadata checks pass. Fresh Astra high review found one partial-PR status bug, now covered by a regression test.

Update this file alongside changes to [work packages](07_WORKPACKAGES.md). Keep claims tied to commands, report paths, issue/PR links or recorded decisions.



- 2026-11-04 — PR #24 fixed generic CLI scope requirements using direct Project GraphQL. [Hosted reconciliation](https://github.com/Maeximilion/MaexSocial/actions/runs/41929472537) passed. Canonical main is synchronized after each merge. Independent Claude REA remains pending.


G0 technical acceptance was recorded by the coordinator under docs/00_PCF.md after repository checks, the Astra high reviews, live CI, issue/PR maintenance and two successful hosted Project runs. Product design approval remains at G2 with Maxi. The foundation tag marks the initial setup snapshot, while main includes the later API correction.
