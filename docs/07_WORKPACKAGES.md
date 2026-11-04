# Work packages

Task IDs are stable across documents, issues, branches and pull requests. Issue links below refer to the provisioned tasks. States are planned, in progress, blocked and done. A task is done only when its acceptance evidence exists. GitHub states were checked read-only on 2026-11-05. Issues #1 and #3 are closed, while #2 and #4–12 remain open. Gate #13 (G0) is closed, and gate issues #14–18 (G1–G5) remain open.

## Planning maturity

The product goals, stage sequence, gate outcomes, task dependencies and stage-level acceptance criteria are defined. The foundation is delivered. G1 discovery is underway with one bounded static REA report completed.

MS-008 will turn the research synthesis into an owner-approved product design. MS-009 will specify the first slice's files, contracts, data changes, acceptance tests and rollout. Those deliverables are future work. MS-010–012 currently describe stage objectives and must be decomposed into independently verifiable implementation tasks after the relevant design is approved. Their issue existence does not make them executable specifications.

The first release should name one customer journey, supported channel and operating envelope. Later media and autonomy stages require their own detailed design and measurable acceptance before implementation begins.

| ID | Gate | Task and deliverable | Depends on | State |
|---|---|---|---|---|
| [MS-001](https://github.com/Maeximilion/MaexSocial/issues/1) | G0 | Repository, Project, templates, workflows, docs and handovers verified on GitHub | — | Done |
| [MS-002](https://github.com/Maeximilion/MaexSocial/issues/2) | G1 | Public SocialEdge product inventory with sources, dates and evidence class | — | In progress |
| [MS-003](https://github.com/Maeximilion/MaexSocial/issues/3) | G1 | Codex REA report with target identity, reproducible steps, evidence IDs and coverage limits | MS-001 research brief | Done for bounded static scope, runtime gap documented |
| [MS-004](https://github.com/Maeximilion/MaexSocial/issues/4) | G1 | Independent Claude Code REA report using the same comparison questions | MS-001 research brief | Planned |
| [MS-005](https://github.com/Maeximilion/MaexSocial/issues/5) | G1 | Official API/MCP feasibility matrix, access requirements and cost assumptions | [MS-002](https://github.com/Maeximilion/MaexSocial/issues/2) | Planned |
| [MS-006](https://github.com/Maeximilion/MaexSocial/issues/6) | G1 | Search report for the remembered Claude image-to-ad demo, candidate links and confidence | — | Planned |
| [MS-007](https://github.com/Maeximilion/MaexSocial/issues/7) | G1 | Combined feature matrix, disagreement ledger, gaps and proposed first slice | MS-002–006 | Blocked |
| [MS-008](https://github.com/Maeximilion/MaexSocial/issues/8) | G2 | Product design, architecture choice, operating authority and cost envelope approved by Maxi | [MS-007](https://github.com/Maeximilion/MaexSocial/issues/7) | Blocked |
| [MS-009](https://github.com/Maeximilion/MaexSocial/issues/9) | G2 | Concrete first-slice plan with files, contracts, tests, dependencies and rollout | [MS-008](https://github.com/Maeximilion/MaexSocial/issues/8) | Blocked |
| [MS-010](https://github.com/Maeximilion/MaexSocial/issues/10) | G3 | First end-to-end content and publication slice verified on selected channel | [MS-009](https://github.com/Maeximilion/MaexSocial/issues/9) | Blocked |
| [MS-011](https://github.com/Maeximilion/MaexSocial/issues/11) | G4 | Image-to-video workflow with provenance, quality checks, cost cap and recovery | MS-010 and approved media design | Blocked |
| [MS-012](https://github.com/Maeximilion/MaexSocial/issues/12) | G5 | Bounded autonomous account operation with stop, audit and supervised pilot evidence | MS-010, MS-011 where media is enabled | Blocked |

## Definitions of done

MS-001 requires green foundation checks, live repository/project links, issues with milestones and labels, documented automation credential state, and tested handover links. Pending credentials must remain an explicit gap rather than a successful automation claim.

MS-002 records each product/service, audience, inputs, outputs, operator involvement and source. Public marketing claims remain claims. MS-003 and MS-004 distinguish UI observations, static code observations, runtime observations, inference and unknowns. MS-004 records a dated independent checkpoint before comparing the Codex report and manifest. It delivers its own report and evidence manifest, then the claim-ID comparison matrix with confirm/contradict/extend/unverifiable outcomes, dates, scope and unknowns. Both lanes remain preserved. Access-limited reports enumerate missing workflows. G1 stays open until those gaps are resolved or explicitly accepted as scope limits.

MS-005 records official permission and app-review requirements for each proposed integration. MS-006 can conclude that the exact video remains unidentified, provided candidate evidence and search limits are clear. MS-007 reconciles contradictions and links every capability to evidence and feasibility.

MS-008 and MS-009 define only the next implementable release in detail. Later tasks are stage objectives and must be decomposed after design. MS-010–012 require behavioral tests, provider failure tests, exact-head CI/review and dated acceptance evidence. No task closes solely because its placeholder documentation exists.
