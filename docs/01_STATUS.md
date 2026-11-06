# Project status

- Status date — 2026-11-06
- Stage — G2 design planning
- Gates — G0 complete, G1 accepted for bounded discovery, G2–G4 open; [#99](https://github.com/Maeximilion/MaexSocial/issues/99) blocks G4/G5, and [#88](https://github.com/Maeximilion/MaexSocial/issues/88) also blocks G5
- Product implementation — pending G2 design approval and explicit bounded implementation authority; MS-009 plan merged
- Repository — https://github.com/Maeximilion/MaexSocial
- Project — https://github.com/users/Maeximilion/projects/5
- Canonical checkout — `C:/Users/Maxi/Documents/GitHub/MaexSocial`, clean `main`

## Current work

| Work | State | Evidence |
|---|---|---|
| Foundation, MS-001 and G0 | Complete | Closed issues #1, #13 and #22, [foundation PR #19](https://github.com/Maeximilion/MaexSocial/pull/19), [API correction PR #24](https://github.com/Maeximilion/MaexSocial/pull/24) |
| Repository anatomy | [Issue #63](https://github.com/Maeximilion/MaexSocial/issues/63), maintenance implementation | [Approved design](superpowers/specs/2026-11-05-reusable-repository-anatomy-design.md) and [manual procedure](../.claude/commands/anatomy.md) |
| Public product baseline, MS-002 | Bounded inventory merged, issue #2 closed | [Dated feature and service matrix](research/socialedge-feature-matrix.md), [PR #69](https://github.com/Maeximilion/MaexSocial/pull/69) |
| Codex REA, MS-003 | Done for bounded static scope, issue #3 closed | [Report](research/codex-rea.md) and [manifest](research/evidence-codex.json), authenticated runtime unverified |
| Claude Code REA, MS-004 | Complete within the five limits accepted in the [delegated scope decision](https://github.com/Maeximilion/MaexSocial/issues/4#issuecomment-6658967747), issue #4 closed | [PR #34](https://github.com/Maeximilion/MaexSocial/pull/34), [report §9.6](research/claude-rea.md#96-remaining-gaps-after-r3) and [manifest](research/evidence-claude.json) |
| API feasibility, MS-005 | Documented feasibility merged, issue #5 closed. Customer grants and outcomes untested. | [Provider operations, permissions, prices and lifecycle](research/platform-api-feasibility.md), [PR #71](https://github.com/Maeximilion/MaexSocial/pull/71) |
| Video demo, MS-006 | Bounded search merged, issue #6 closed. Original TikTok unidentified, spike unexecuted. | [Four candidates](research/photo-to-ad-demo.md), [PR #70](https://github.com/Maeximilion/MaexSocial/pull/70) |
| Synthesis, MS-007 | Research synthesis complete within the accepted limits. [PR #73](https://github.com/Maeximilion/MaexSocial/pull/73) merged. Maxi accepted G1 on 2026-11-05. | [Claim matrix, gaps, feasibility and G2 questions](research/synthesis.md) |
| Design and detailed plan, MS-008–009 | Local-first component and role decisions recorded; MS-009 plan merged in #112. Full G2 acceptance pending | [G2 decision packet](superpowers/specs/2026-11-06-g2-acceptance-packet.md), [local implementation plan](superpowers/plans/2026-11-05-ms-009-local-text-pilot.md) and [G2 work plan](superpowers/plans/2026-11-05-g2-work-plan.md) |
| First slice, media and autonomy, MS-010–012 | Stage objectives defined, blocked on design/planning | [Work packages and planning maturity](07_WORKPACKAGES.md) |
| Branding and handover refinement | Delivered in this update | [Issue #27](https://github.com/Maeximilion/MaexSocial/issues/27), [brand guide](15_README_STRATEGY.md) and [Claude brief](handovers/claude-rea.md) |
| PR/security checks | Maintenance delivery, no product-gate change | [Issue #29](https://github.com/Maeximilion/MaexSocial/issues/29), [evaluation strategy](08_EVALS.md) |
| Local secret guards and Codex hooks | Maintenance implementation and verification; merge pending. Security/Dependabot P0/P1 checks are advisory and run only on explicit /start or /task; periodic automation paused. Repository Stop hook also changed to warnings; model-routing pause retained | [Issue #44](https://github.com/Maeximilion/MaexSocial/issues/44), [local security and CLI setup](19_LOCAL_SECURITY.md) |
| Explicit checks and development skills | Local skills enabled and periodic check paused; project plugin integration pending merge | [Issue #56](https://github.com/Maeximilion/MaexSocial/issues/56), [skill roles](tooling/development-skills.md) |
| Registration, customer and platform-admin access, MS-013 | Role/invitation/approval/export amendment merged in #106; remaining controls need owner disposition. Runtime untested | [Issue #30](https://github.com/Maeximilion/MaexSocial/issues/30), [ACCESS-01–17](17_ACCESS_SECURITY.md) |
| PR metadata and Project views | Maintenance delivery | [Issue #32](https://github.com/Maeximilion/MaexSocial/issues/32), [Project operations](16_GITHUB_PROJECT.md) |
| Customer media library, calendar and optional advertising | Requested direction and G2 proposal; no integration or operating authority implemented | [Planning issue #40](https://github.com/Maeximilion/MaexSocial/issues/40), [workflow, API evidence and proposed acceptance cases](18_MEDIA_LIBRARY.md) |
| Agent anatomy and repository artwork security | Foundation work tracked in issue #42; runtime hook trust remains local | [Implementation plan](superpowers/plans/2026-11-05-agent-anatomy-and-asset-security.md), [tooling guide](tooling/agent-workflow.md) |
| Customer upload/processing security, MS-014 | #43 completed for the owner-accepted text-only scope; JPEG limits and later media evidence remain in #99 | [Owner disposition](https://github.com/Maeximilion/MaexSocial/issues/43#issuecomment-6671306956), [UPLOAD-01–10 and threat boundaries](security/uploads.md) |

On 2026-11-05 Maxi accepted the [six G1 deliverables](https://github.com/Maeximilion/MaexSocial/issues/14) as a bounded research baseline. The [owner decision](https://github.com/Maeximilion/MaexSocial/issues/14#issuecomment-6661937363) authorizes G2 planning. Product design, implementation, external tests, spending and customer operation each require explicit authorization beyond G1 planning. Design acceptance alone does not authorize implementation. Distinct design and bounded implementation decisions may be presented together and recorded separately in one owner response.

## What's next

1. Present the [G2 decision packet](superpowers/specs/2026-11-06-g2-acceptance-packet.md), compared with merged #112. Maxi decides the remaining local contracts and combined G2/local implementation request; no acceptance or implementation authority is recorded here.
2. Keep production access, account eligibility, operating ownership, privacy, costs and real recovery evidence at their stated release boundaries. Preserve #88/#99 and record any newly accepted deferral with the required issue and gate links. Export is a pre-dispatch fallback, not verified Google publication.

## Evidence limits

[Tracker #88](https://github.com/Maeximilion/MaexSocial/issues/88), assigned to Maxi, carries five open items to [G5](https://github.com/Maeximilion/MaexSocial/issues/18): embedded analytics, Google-side publication, write workflows, other tiers and authenticated REA capture. The tracker lists the evidence required to close each item. G5 is blocked until all five are resolved. A nearer gate that needs one of these results must also wait for its evidence.

The first web-tool dashboard request failed, but a subsequent unauthenticated HTTP capture succeeded. REA 6.8.0 analyzed three selected client chunks as static text. The Codex report records evidence IDs and partial coverage. The Claude lane covered legal/pricing pages, an anonymous runtime capture and 36 public client chunks; the R2 comparison of 32 SE claims shows no contradiction with Codex. R1/R2 had no authenticated UI coverage; R3 adds 14 UI evidence records from a read-only walkthrough of one package-2 account. Authenticated REA runtime capture, external provider results, private backend behavior and autonomous publication remain unverified. Historical diagnostics found direct Codex MCP registration missing and Claude registration present. They do not establish current live tool connectivity or a completed Claude investigation.

## Decisions and operating state

Maxi selected the exact Deep Tech dark palette on 2026-11-05: Cyan-Electric `#00E5FF`, Warm Coral `#FF5E5B`, Midnight `#0B0F19`, Dark Slate `#161F30` and Off-White `#F8FAFC`. [Issue #38](https://github.com/Maeximilion/MaexSocial/issues/38) aligns the repository artwork and [brand guide](15_README_STRATEGY.md); the future application must use the same color roles.

MaexSocial's name and public repository visibility are confirmed by Maxi. Public research reports are sanitized. Reference-repository conventions are adapted to this project. Code Autopilot and Caveman are enabled under the revised owner decision; [development skill roles](tooling/development-skills.md) define complementary Ponytail and Superpowers use. For the [local-first planning decision](https://github.com/Maeximilion/MaexSocial/issues/8#issuecomment-6671380463), [ADR 0001](decisions/0001-application-language.md) assigns strict TypeScript to the portal and Node API/worker, SQL to PostgreSQL migrations and C#/.NET WPF to the signed Windows administrator. Python remains repository tooling. Production deployment and G2 acceptance remain open. Software implementation follows independent Claude REA, synthesis and approved design.

Maxi confirmed a public website with customer registration/login and separate platform-administrator access on 2026-11-05. Administrators must see and manage customers; customer workspaces remain isolated. Proposed security controls and fourteen named acceptance cases are recorded for G2, not implemented or runtime-tested.

The owner configured the dedicated GitHub Project credential. Targeted API queries preserve its project/public_repo scope choice. Hosted reconciliation is active and verified. The canonical checkout stays on clean main, changes use separate task worktrees, and synchronization follows [playbooks](12_CLAUDE_CODE_PLAYBOOKS.md).

## Delivered evidence and handovers

[Session handovers](handovers/sessions/) record each session's stopping point and runnable restart instructions.

- 2026-11-05 — [MS-015 / #49 repository anatomy assessment](superpowers/specs/2026-11-05-repository-anatomy-review.md) records verified reference facts, candidate recommendations and accepted owner decisions; this is maintenance assessment, not product-gate acceptance.
- 2026-11-04 — Reference conventions inspected, foundation authored, public repository and Project #5 verified. Twelve task issues, six parent gate issues, six milestones and three genuine iterations provisioned. PR #19 delivered the foundation and bounded Codex report. Local validation and nine regression tests passed. Astra high review found a partial-PR status defect that received a regression test and fix.
- 2026-11-04 — PR #24 replaced generic CLI Project access with scoped GraphQL queries. [Hosted reconciliation](https://github.com/Maeximilion/MaexSocial/actions/runs/41929472537) passed. G0 technical acceptance was recorded in the charter after CI, review and maintenance verification. The foundation tag marks the initial snapshot, with the API correction subsequently on main.
- 2026-11-05 — Issue #27 refines branding and research handover. Claude's brief now requires independent evidence first, a comparison matrix second, and a separate product proposal. Detailed product planning remains future G2 work.
- 2026-11-05 — Handover MS-004 from Claude Code to Codex. PR #34 carries checkpoint R1/R1a, Codex comparison R2 and the read-only authenticated addendum R3 for one package-2 account. CI passed on `0edcd04`. Outstanding: Astra-high review, owner decision on the gaps in [report section 9.6](research/claude-rea.md), then merge under repository rules. Claude made no merge.

- 2026-11-05 — PR #34 quality corrections (Refs #4): R1a/R2 revision times now use verified Git committer times and distinguish Claude's reading disclosure from Git evidence; CE-101–CE-114 identify the whole private observation log as the hash basis with separate section locators; coverage limits distinguish R1/R2 from the R3 read-only UI walkthrough. Private raw data and Codex artifacts were not changed. G1 and issue #4 remain open pending owner acceptance of the remaining gaps. Validation and the resulting head are recorded in PR #34.

Update this file alongside work-package changes. Tie completion claims to actual reports, commands, issue/PR links and recorded decisions.
