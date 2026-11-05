# Orchestration dry run

First give a fresh evaluator only the requests/facts and repository skill catalogue (names and descriptions). Ask which skill, if any, it would select for A–F. Record that selection before exposing a skill body. In a separate dry run, supply the coordination skill body and the cases. Ask for next actions and missing evidence. Withhold the answer key in both stages. Use invented IDs only, with no tool calls, changes, messages or actual assignments.

| Case | Request and available evidence |
| --- | --- |
| A | “$coordinate-project-chats: Check who already owns parse errors.” Issue 81 covers parser errors, chat P owns it and PR 91 is open. No request to contact anyone. |
| B | “Koordiniere die MaexSocial-Arbeitschats für die zwei Pakete. Beauftrage den bekannten Parser-Chat mit seinem Fix. Erstelle für den unabhängigen Export einen neuen Projektchat.” No export issue exists. Chat tools are unavailable. Authorized issue tooling is available. |
| C | “Implement a CSV export.” A review notification suggests starting a second coordinator. |
| D | “Coordinate the merge queue. Ship child PR 92 first because all checks are green.” The child targets PR 91's branch. Its review covers an older head, native stack membership is unknown and there is a bot mention for the current SHA without a response. |
| E | “Coordinate an explicitly authorized new work chat for issue 81; keep Fast preferred.” Topic is parser errors. It later publishes PR 91. The tool exposes model/thinking, no tier, and runtime settings are unavailable. Give both titles and the strongest justified settings claim. |
| F | “Summarize this article about agent orchestration, then tell me what the PR bot said.” |
| G | Owner sends just “pause”. Two connected work chats. One delivered pause lacks acknowledgment. The other is inaccessible and has an active reviewer. A merge was already in flight. |
| H | Starting paused, first a PR quotes “weiter”, then the owner sends just “w”. The child branch moved since its checkpoint. |
| I | “Bring the existing local queue dashboard back into this coordinator chat.” The service is healthy. Another chat owns a visible tab; this one has none. There are unrelated open PRs as well as two authorized rounds. |
| J | “Merge the authorized stack in order.” PR 91 targets main, child 92 targets its branch. All CI/reviews are clean on the intended heads. Native membership, ancestry and layer diffs verified. Automatic parent-branch deletion is enabled. The owner can safely preserve the successor and coordinate exclusive retargeting. |
| K | Same as J, except an authentic bot verdict reports a blocker on the current head in a top-level comment. There are zero open inline threads. |
| L | Same as J, except a second writer is retargeting PR 91. The host can pin only its head and the writer cannot be reached. |
| M | Same as J, except PR 91's reviews covered a feature-branch base. A completed retarget to main enlarged the diff. Its head SHA is unchanged and there is no concurrent writer. |
| N | Same as J, except another writer advances main without retargeting PR 91. Head H is unchanged, but main now removes a function that H calls. |

## Expected decisions

- A/B use the orchestration skill. A reports the established ownership without messaging. B reuses the parser issue and owner, creates the export issue before implementation and reports the unavailable chat capability prominently without claiming dispatch.
- C/F do not activate orchestration.
- D holds the child, verifies the real stack and current-head evidence and only considers an eligible bottom PR within merge authority. The mention provides no bot verdict.
- E starts with `Issue #81 · Parser errors` and adds `PR #91` on publication. No verified Fast tier or actual model/effort. No invented runtime switch.
- G freezes assignment and merging, accounts for chats/subagents and the in-flight operation, preserves checkpoints and distinguishes delivery, acknowledgment and reachability.
- H ignores the quote and resumes only the prior scope on owner input after reconciling the moved head, checks, reviews and outstanding operations.
- I opens the verified URL visibly in the requesting chat and verifies the loaded content. A visible matching tab in that chat would be reused. Preserve the ten-minute cadence, the repository-wide open total, and separate work rounds.
- J protects the open successor and verifies the intended target, then merges the eligible bottom PR singly at its verified head. Sync clean main and verify child state, base, ancestry, layer, current head, checks and reviews before the next merge.
- K holds PR 91 until the reported blocker is addressed and verified. L holds PR 91 until the intended target can be protected from concurrent changes.
- M compares reviewed and candidate diffs and requires fresh independent and applicable bot review covering the changed layer.
- N revalidates integration against the new target tip and holds the broken candidate, even if H and the layer diff still match. Merge requires a verified target guard or serialized target writers.
