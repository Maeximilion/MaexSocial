# Project status

- Status date — 2026-11-05
- Stage — G1 discovery
- Gates — G0 complete, G1 ongoing, G2–G5 open
- Product implementation — pending G2 design approval and the MS-009 executable plan
- Repository — https://github.com/Maeximilion/MaexSocial
- Project — https://github.com/users/Maeximilion/projects/5
- Canonical checkout — `C:/Users/Maxi/Documents/GitHub/MaexSocial`, clean `main`

## Current work

| Work | State | Evidence |
|---|---|---|
| Foundation, MS-001 and G0 | Complete | Closed issues #1, #13 and #22, [foundation PR #19](https://github.com/Maeximilion/MaexSocial/pull/19), [API correction PR #24](https://github.com/Maeximilion/MaexSocial/pull/24) |
| Public product baseline, MS-002 | In progress, issue #2 open | Initial public SocialEdge sources identified |
| Codex REA, MS-003 | Done for bounded static scope, issue #3 closed | [Report](research/codex-rea.md) and [manifest](research/evidence-codex.json), authenticated runtime unverified |
| Claude Code REA, MS-004 | Anonymous-scope report submitted; review and authenticated scope outstanding, issue #4 open | [PR #34](https://github.com/Maeximilion/MaexSocial/pull/34), [Claude handover](handovers/claude-rea.md); findings not yet accepted |
| API feasibility and video demo, MS-005–006 | Planned, issues #5–6 open | Candidate demos exist in the Codex report, full feasibility/search deliverables remain open |
| Synthesis, MS-007 | Waiting for required research, issue #7 open | [Synthesis handover](handovers/synthesis.md) |
| Design and detailed plan, MS-008–009 | Pending G1 synthesis and owner design decision | Goals and gates defined, executable product plan still to be written |
| First slice, media and autonomy, MS-010–012 | Stage objectives defined, blocked on design/planning | [Work packages and planning maturity](07_WORKPACKAGES.md) |
| Branding and handover refinement | Delivered in this update | [Issue #27](https://github.com/Maeximilion/MaexSocial/issues/27), [brand guide](15_README_STRATEGY.md) and [Claude brief](handovers/claude-rea.md) |
| PR/security checks | Maintenance delivery, no product-gate change | [Issue #29](https://github.com/Maeximilion/MaexSocial/issues/29), [evaluation strategy](08_EVALS.md) |
| Registration, customer and platform-admin access, MS-013 | Confirmed requirements; design and runtime tests pending G2 | [Issue #30](https://github.com/Maeximilion/MaexSocial/issues/30), [access requirements](17_ACCESS_SECURITY.md) |
| PR metadata and Project views | Maintenance delivery | [Issue #32](https://github.com/Maeximilion/MaexSocial/issues/32), [Project operations](16_GITHUB_PROJECT.md) |

GitHub issue states above were checked read-only on 2026-11-05. G0 issue #13 is closed. Gate issues #14–18 remain open.

## What's next

1. Review Claude's submitted anonymous-scope investigation in PR #34 under issue #4. Verify its independent checkpoints and comparison evidence; resolve or explicitly bound the outstanding authenticated scope before discovery acceptance.
2. Finish public inventory, official API/MCP feasibility and the video-demo investigation. Record any missing authenticated runtime access and ask for the exact scenario scope.
3. Reconcile both research lanes in a new synthesis chat using claim IDs, independent evidence, source dates, scope and explicit comparison outcomes.
4. Prepare and approve the G2 product design, then decompose the first slice into executable tasks and acceptance tests.

## Evidence limits

The first web-tool dashboard request failed, but a subsequent unauthenticated HTTP capture succeeded. REA 6.8.0 analyzed three selected client chunks as static text. The Codex report records evidence IDs and partial coverage. Authenticated runtime, private backend behavior and autonomous publication remain unverified. Historical diagnostics found direct Codex MCP registration missing and Claude registration present. They do not establish current live tool connectivity or a completed Claude investigation.

## Decisions and operating state

MaexSocial's name and public repository visibility are confirmed by Maxi. Public research reports are sanitized. Reference-repository conventions are adapted to this project. Code-autopilot and caveman remain disabled. Under Maxi's delegated choice, TypeScript strict is the application-language baseline; [ADR 0001](decisions/0001-application-language.md) records the rationale. Framework, runtime version, provider and deployment choices remain at G2. Software implementation follows independent Claude REA, synthesis and approved design.

Maxi confirmed a public website with customer registration/login and separate platform-administrator access on 2026-11-05. Administrators must see and manage customers; customer workspaces remain isolated. Proposed security controls and fourteen named acceptance cases are recorded for G2, not implemented or runtime-tested.

The owner configured the dedicated GitHub Project credential. Targeted API queries preserve its project/public_repo scope choice. Hosted reconciliation is active and verified. The canonical checkout stays on clean main, changes use separate task worktrees, and synchronization follows [playbooks](12_CLAUDE_CODE_PLAYBOOKS.md).

## Delivered evidence and handovers

- 2026-11-04 — Reference conventions inspected, foundation authored, public repository and Project #5 verified. Twelve task issues, six parent gate issues, six milestones and three genuine iterations provisioned. PR #19 delivered the foundation and bounded Codex report. Local validation and nine regression tests passed. Astra high review found a partial-PR status defect that received a regression test and fix.
- 2026-11-04 — PR #24 replaced generic CLI Project access with scoped GraphQL queries. [Hosted reconciliation](https://github.com/Maeximilion/MaexSocial/actions/runs/41929472537) passed. G0 technical acceptance was recorded in the charter after CI, review and maintenance verification. The foundation tag marks the initial snapshot, with the API correction subsequently on main.
- 2026-11-05 — Issue #27 refines branding and research handover. Claude's brief now requires independent evidence first, a comparison matrix second, and a separate product proposal. Detailed product planning remains future G2 work.

Update this file alongside work-package changes. Tie completion claims to actual reports, commands, issue/PR links and recorded decisions.
