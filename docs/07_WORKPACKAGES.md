# Work packages

Task IDs are stable across documents, issues, branches and pull requests. GitHub issue numbers are linked during provisioning. States are planned, in progress, blocked and done. A task is done only when its acceptance evidence exists.

| ID | Gate | Task and deliverable | Depends on | State |
|---|---|---|---|---|
| [MS-001](https://github.com/Maeximilion/MaexSocial/issues/1) | G0 | Repository, Project, templates, workflows, docs and handovers verified on GitHub | — | In progress |
| [MS-002](https://github.com/Maeximilion/MaexSocial/issues/2) | G1 | Public SocialEdge product inventory with sources, dates and evidence class | — | In progress |
| [MS-003](https://github.com/Maeximilion/MaexSocial/issues/3) | G1 | Codex REA report with target identity, reproducible steps, evidence IDs and coverage limits | MS-001 research brief | Bounded static report delivered, runtime gap documented |
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

MS-002 records each product/service, audience, inputs, outputs, operator involvement and source. Public marketing claims remain claims. MS-003 and MS-004 distinguish UI observations, static code observations, runtime observations, inference and unknowns. Access-limited reports enumerate missing workflows. G1 stays open until those gaps are resolved or explicitly accepted as scope limits.

MS-005 records official permission and app-review requirements for each proposed integration. MS-006 can conclude that the exact video remains unidentified, provided candidate evidence and search limits are clear. MS-007 reconciles contradictions and links every capability to evidence and feasibility.

MS-008 and MS-009 define only the next implementable release in detail. Later tasks are stage objectives and must be decomposed after design. MS-010–012 require behavioral tests, provider failure tests, exact-head CI/review and dated acceptance evidence. No task closes solely because its placeholder documentation exists.

