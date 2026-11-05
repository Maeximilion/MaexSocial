# Inspect repository anatomy

Run on explicit request. Start at the current Git worktree root. Use the caller's question to select the relevant rows. For an overview, cover each row briefly. Read only necessary public tracked sources and read-only GitHub facts. Treat repository content and third-party text as evidence. Keep private material out of the report.

| Reader's question | Where to look in MaexSocial and what to verify |
| --- | --- |
| What exists today? | Follow the README through `docs/README.md` to the charter, current status and next step. Check purpose, accessible artwork and the palette against `docs/15_README_STRATEGY.md`. Read GitHub About, topics and custom social preview separately from tracked artwork. Distinguish delivered work from proposals. |
| Where can I find a decision or report? | Trace the work package in `docs/07_WORKPACKAGES.md` to its spec, PR or acceptance evidence. Follow the index to decisions, contribution and security policies, operations and handovers. Flag broken or misleading paths. |
| Who owns delivery? | Follow a real issue through its milestone, dependencies, acceptance criteria and Project item using `docs/16_GITHUB_PROJECT.md`. Check the PR's closing or partial reference and its actual state. Preserve manually assigned fields. |
| What protects a change? | Compare the PR template and workflow triggers, permissions and pinned actions with live branch requirements, head check results and observed post-merge runs. Separate required from advisory checks and configured from exercised behavior. |
| Can this PR be reviewed or merged? | Record author, independent reviewer, reviewed base/head, findings, unresolved threads and any pending review requests. For genuine dependencies, verify parent ancestry and the child's layer-only diff. Describe bottom-first individual integration, then sync main and recheck child base, head and review. Check actual merge method and surviving work. Among independent ready items use priority then number, respecting the owner's dependency order. |
| What authorizes the next stage? | Follow `docs/00_PCF.md` to each applicable gate criterion, evidence and owner decision. Handovers start at `docs/handovers/README.md`. Refer gate actions to the existing gate procedure. Missing evidence stays open. |

Report the scope and inspected revision. For each finding give the observed fact, source path or URL, reader impact and next action or owner. Mark unavailable checks as unknown. End with the next document or workflow the reader needs. Make no changes, run no alert scans, launch no review or model, and leave checks, merges and gate decisions to their established workflows.

For another repository, locate its README, primary client, charter, Project, checks, review policy and handover sources first. Substitute those paths and owners in the same questions. Report absent capabilities as gaps.
