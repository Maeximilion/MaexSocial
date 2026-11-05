# Work packages

Task IDs are stable across documents, issues, branches and pull requests. Issue links below refer to the provisioned tasks. States are planned, in progress, blocked and done. A task is done only when its acceptance evidence exists. GitHub states were checked read-only on 2026-11-05. Issues #1 and #3 are closed, while #2 and #4–12 remain open. Gate #13 (G0) is closed, and gate issues #14–18 (G1–G5) remain open.

## Planning maturity

The product goals, stage sequence, gate outcomes, task dependencies and stage-level acceptance criteria are defined. The foundation is delivered. G1 discovery has a bounded [Codex static report](research/codex-rea.md) and an independent [Claude walkthrough](research/claude-rea.md) under review.

MS-008 will turn the research synthesis into an owner-approved product design. MS-009 will specify the first slice's files, contracts, data changes, acceptance tests and rollout. Those deliverables are future work. MS-010–012 currently describe stage objectives and must be decomposed into independently verifiable implementation tasks after the relevant design is approved. Their issue existence does not make them executable specifications.

The first release should name one customer journey, supported channel and operating envelope. Later media and autonomy stages require their own detailed design and measurable acceptance before implementation begins.

| ID | Gate | Task and deliverable | Depends on | State |
|---|---|---|---|---|
| [MS-001](https://github.com/Maeximilion/MaexSocial/issues/1) | G0 | [Foundation design](superpowers/specs/2026-11-04-foundation-design.md) delivered in [PR #19](https://github.com/Maeximilion/MaexSocial/pull/19) | — | Done |
| [MS-002](https://github.com/Maeximilion/MaexSocial/issues/2) | G1 | Public SocialEdge product inventory with sources, dates and evidence class | — | In progress |
| [MS-003](https://github.com/Maeximilion/MaexSocial/issues/3) | G1 | Codex REA report with target identity, reproducible steps, evidence IDs and coverage limits | MS-001 research brief | Done for bounded static scope, runtime gap documented |
| [MS-004](https://github.com/Maeximilion/MaexSocial/issues/4) | G1 | Independent Claude Code REA report using the same comparison questions | MS-001 research brief | In review; read-only authenticated walkthrough done, gaps listed |
| [MS-005](https://github.com/Maeximilion/MaexSocial/issues/5) | G1 | Official API/MCP feasibility matrix, access requirements and cost assumptions | [MS-002](https://github.com/Maeximilion/MaexSocial/issues/2) | Planned |
| [MS-006](https://github.com/Maeximilion/MaexSocial/issues/6) | G1 | Search report for the remembered Claude image-to-ad demo, candidate links and confidence | — | Planned |
| [MS-007](https://github.com/Maeximilion/MaexSocial/issues/7) | G1 | Combined feature matrix, disagreement ledger, gaps and proposed first slice | MS-002–006 | Blocked |
| [MS-008](https://github.com/Maeximilion/MaexSocial/issues/8) | G2 | Product design, architecture choice, operating authority and cost envelope approved by Maxi | [MS-007](https://github.com/Maeximilion/MaexSocial/issues/7) | Blocked |
| [MS-009](https://github.com/Maeximilion/MaexSocial/issues/9) | G2 | Concrete first-slice plan with files, contracts, tests, dependencies and rollout | MS-008, MS-013 and MS-014 for uploads | Blocked |
| [MS-010](https://github.com/Maeximilion/MaexSocial/issues/10) | G3 | First end-to-end content and publication slice verified on selected channel | [MS-009](https://github.com/Maeximilion/MaexSocial/issues/9) | Blocked |
| [MS-011](https://github.com/Maeximilion/MaexSocial/issues/11) | G4 | Image-to-video workflow with provenance, quality checks, cost cap and recovery | MS-010 and approved media design | Blocked |
| [MS-012](https://github.com/Maeximilion/MaexSocial/issues/12) | G5 | Bounded autonomous account operation with stop, audit and supervised pilot evidence | MS-010, MS-011 where media is enabled | Blocked |
| [MS-013](https://github.com/Maeximilion/MaexSocial/issues/30) | G2 | Approved public registration/login, customer isolation and separate platform-admin access design | MS-007, coordinated with MS-008 | Blocked |
| [MS-014](https://github.com/Maeximilion/MaexSocial/issues/43) | G2 | Approved upload, processing-isolation and safe-delivery design with executable acceptance mapping | MS-007, coordinated with MS-008 and MS-013 | Blocked |
| [MS-015](https://github.com/Maeximilion/MaexSocial/issues/49) | Maintenance | [Repository anatomy assessment](superpowers/specs/2026-11-05-repository-anatomy-review.md): verify the reference kit, assess all candidates and separate owner decisions before implementation | Owner-supplied kit; no product-gate change | Done in [PR #52](https://github.com/Maeximilion/MaexSocial/pull/52) |

[Issue #63](https://github.com/Maeximilion/MaexSocial/issues/63) implements the [approved manual anatomy procedure](superpowers/specs/2026-11-05-reusable-repository-anatomy-design.md) from that assessment.

## Definitions of done

[Maintenance issue #44](https://github.com/Maeximilion/MaexSocial/issues/44) adds local secret-prevention hooks and verifies native Codex hooks independently of product delivery and G1 acceptance. Security/quality and Dependabot P0/P1 checks are advisory only under the revised owner decision: report the need to address findings and continue requested tasks, without automatic remediation chats. Installation, test boundaries and rollback are documented in [local security operations](19_LOCAL_SECURITY.md).

[Planning issue #40](https://github.com/Maeximilion/MaexSocial/issues/40) records the owner-requested [media library, calendar and optional advertising proposal](18_MEDIA_LIBRARY.md). Its gate/task mapping extends MS-005 and MS-007–013. Completing that documentation task does not complete those work packages, implement the feature or approve G2. Paid distribution remains distinct from generating advertising creative.

MS-001 requires green foundation checks, live repository/project links, issues with milestones and labels, documented automation credential state, and tested handover links. Pending credentials must remain an explicit gap rather than a successful automation claim.

MS-002 records each product/service, audience, inputs, outputs, operator involvement and source. Public marketing claims remain claims. MS-003 and MS-004 distinguish UI observations, static code observations, runtime observations, inference and unknowns. MS-004 records a dated independent checkpoint before comparing the Codex report and manifest. It delivers its own report and evidence manifest, then the claim-ID comparison matrix with confirm/contradict/extend/unverifiable outcomes, dates, scope and unknowns. Both lanes remain preserved. Access-limited reports enumerate missing workflows. G1 stays open until those gaps are resolved or explicitly accepted as scope limits.

MS-005 records official permission and app-review requirements for each proposed integration. MS-006 can conclude that the exact video remains unidentified, provided candidate evidence and search limits are clear. MS-007 reconciles contradictions and links every capability to evidence and feasibility.

MS-008 and MS-009 define only the next implementable release in detail. Later tasks are stage objectives and must be decomposed after design. MS-010–012 require behavioral tests, provider failure tests, exact-head CI/review and dated acceptance evidence. No task closes solely because its placeholder documentation exists.

MS-013 resolves the role/action matrix, administrator provisioning, registration/verification, MFA, sessions/recovery and tenant enforcement. Map accepted [ACCESS-01–14 cases](17_ACCESS_SECURITY.md) into MS-009, then verify the relevant release cases before externally accessible customer operation. The initial requirements document does not complete MS-013.

MS-014 resolves allowed formats, numerical limits, quarantine, media-worker authority/isolation, delivery headers, URL retrieval and signed-link revocation. Map [UPLOAD-01–10](security/uploads.md) into MS-009 and the relevant G3/G4 tasks. Foundation [#42](https://github.com/Maeximilion/MaexSocial/issues/42) adds repository-artwork checks and agent tooling only; its completion does not complete MS-014 or prove upload runtime safety.
