# Project status

- Status date — 2026-11-22
- Stage — Bounded G2 accepted. G3 local synthetic delivery is at Task 2; Task 1 storage and the bounded components below are on main.
- Gates — G0 complete, G1 accepted for bounded discovery, G2 accepted on 2026-11-06; #113 merged and annotated gate-g2 verified at `192d0c5`. G3–G5 open. #10/#82/#131 block G3/G5; [#99](https://github.com/Maeximilion/MaexSocial/issues/99) blocks G4/G5 and [#88](https://github.com/Maeximilion/MaexSocial/issues/88) also blocks G5
- Product implementation — Task 1 [PR #118](https://github.com/Maeximilion/MaexSocial/pull/118) and the synthetic session/tenant/CSRF/portal foundation [PR #135](https://github.com/Maeximilion/MaexSocial/pull/135) merged. The read-only Keycloak status adapter [#136 / PR #138](https://github.com/Maeximilion/MaexSocial/pull/138) is a local component. [#131](https://github.com/Maeximilion/MaexSocial/issues/131) retains real signup/login/activation/recovery/MFA and completion provenance. #123 Employee management and #124 content approval retain their real auth prerequisites. Task 2 needs A1+A2+B+C and integrated evidence. See the [delivery plan](superpowers/plans/2026-11-06-task-2-deliveries.md), [evidence map](superpowers/plans/2026-11-05-ms-009-pilot-evidence-map.md) and [fixture commands](../ops/local/README.md).
- Repository — https://github.com/Maeximilion/MaexSocial
- Project — https://github.com/users/Maeximilion/projects/5
- Canonical checkout — `C:/Users/Maxi/Documents/GitHub/MaexSocial`, clean `main`

## Current work

Bounded Task 5 [#266](https://github.com/Maeximilion/MaexSocial/issues/266) adds
[explicit ordinary-fixture dispatch reopen](../ops/local/README.md#explicit-reopen-266).
The local drill covers a committed private claim, stop, readback, retained restart and a new
claim after checked reopen. Broader Task 5 acceptance remains under #166.

Bounded Task 5 [#258](https://github.com/Maeximilion/MaexSocial/issues/258) exercises a
[cold pair taken before dispatch and terminal export](../ops/local/README.md#restore-before-dispatch-and-terminal-export-258).
The [drill evidence](handovers/sessions/2026-11-22-restore-before-effects.md) records the original source outcomes,
independent fake count and offline target refusal. Integrated Task 5 remains under #166.

November 22 bounded Task 5 delivery [#215](https://github.com/Maeximilion/MaexSocial/issues/215) adds
a [durable local dispatch stop and outstanding attempt count](../ops/local/README.md#local-dispatch-stop-215).
The integrated sender and stop/restore drill remain under #165 and #166.

Bounded Task 5 delivery [#255](https://github.com/Maeximilion/MaexSocial/issues/255) measures the
[matched 010-to-009 rollback](handovers/sessions/2026-11-22-pilot-build-rollback.md) on freshly
captured synthetic data. The 009 build rejected the 010 pair before target creation. Its own 009 pair
restored offline in 19.352 seconds with both snapshot markers present. Integrated recovery and
operating targets remain under #166 and #82.

Bounded Task 5 delivery [#248](https://github.com/Maeximilion/MaexSocial/issues/248) binds a new
synthetic cold pair to its [capture-time history position](../ops/local/README.md#history-from-a-cold-backup-pair-248).
The importer checks the archived anchor and replay checks the source identity. Older pairs remain
available for offline quarantine.

Bounded Task 5 delivery [#241](https://github.com/Maeximilion/MaexSocial/issues/241) applies an
[independent synthetic deletion and revocation history](../ops/local/README.md#offline-deletion-and-revocation-history-replay-241)
once on the offline target. [#166](https://github.com/Maeximilion/MaexSocial/issues/166) retains
integrated recovery and release acceptance.

Bounded Task 5 delivery [#250](https://github.com/Maeximilion/MaexSocial/issues/250) adds a
[30-day UTC deadline](../ops/local/README.md#rolling-expiry-of-disposable-backup-pairs-250) to new
synthetic pairs and archive expiry for an explicitly disposable local pair. Integrated recovery,
cross-copy retention and production acceptance remain open under #166 and #82.

Bounded Task 5 component [#217](https://github.com/Maeximilion/MaexSocial/issues/217) keeps all historical
occurrences offline in a [disposable restore target](../ops/local/README.md#historical-quarantine-on-a-disposable-restore-target-217).
Bounded Task 5 component [#235](https://github.com/Maeximilion/MaexSocial/issues/235) restores a verified
synthetic pair into a [fresh offline target](../ops/local/README.md#offline-restore-of-a-verified-pair-235)
and applies the existing quarantine before offline inspection.
[Task 5](https://github.com/Maeximilion/MaexSocial/issues/166) retains the integrated drill and release acceptance.

November 22 bounded Task 3 delivery [#212](https://github.com/Maeximilion/MaexSocial/issues/212) adds an
[atomic hold and audit for one occurrence](handovers/sessions/2026-11-22-operator-hold.md) in the isolated fixture.
Integrated identity, device verification and private management acceptance remain in [#164](https://github.com/Maeximilion/MaexSocial/issues/164).

Bounded Task 3 delivery [#236](https://github.com/Maeximilion/MaexSocial/issues/236) adds
[private tenant role changes](../ops/local/README.md#private-tenant-role-changes-236) for the first Manager promotion
and last Manager demotion. The synthetic fixture checks current grant and target, old session and unclaimed approval
invalidation, and atomic audit. [#164](https://github.com/Maeximilion/MaexSocial/issues/164) retains integrated acceptance.

Bounded Task 3 delivery [#259](https://github.com/Maeximilion/MaexSocial/issues/259) adds
[private customer organization creation](../ops/local/README.md#private-customer-organization-creation-259).
The operation commits an empty active organization and its audit together. [#164](https://github.com/Maeximilion/MaexSocial/issues/164)
retains the private listener, operator proof, access provisioning and integrated acceptance.

Bounded Task 3 delivery [#261](https://github.com/Maeximilion/MaexSocial/issues/261) issues a
[private pending Manager or Employee invitation](../ops/local/README.md#private-devadmin-invitation-issuance-261)
for a selected active organization. The isolated evidence covers both roles, shared duplicate
protection, audited issuance and the recipient-bound preview. Real authority, acceptance and the
private management entry remain under #131, #164 and #221.

Bounded Task 3 delivery [#263](https://github.com/Maeximilion/MaexSocial/issues/263) adds
[private membership revocation](../ops/local/README.md#private-devadmin-membership-revocation-263)
for either customer role, with tenant-scoped authority invalidation and atomic audit. The fixture
covers the last Manager and an Employee in a managerless organization. #164 retains private listener,
device proof and integrated acceptance.

Task 2B's [invitation preview](https://github.com/Maeximilion/MaexSocial/issues/207) and
[private issuance and resend](https://github.com/Maeximilion/MaexSocial/issues/209) cover the local
synthetic mailbox and pending invitation lifecycle. [Fixture evidence](../ops/local/README.md#private-employee-invitation-issuance-209)
uses a current Manager and inspects the stored bindings and captured messages. [#221](https://github.com/Maeximilion/MaexSocial/issues/221)
retains authenticated integration and acceptance under [#123](https://github.com/Maeximilion/MaexSocial/issues/123).

November 22 bounded Task 2B delivery [#210](https://github.com/Maeximilion/MaexSocial/issues/210) provides
[private Employee membership revocation](../ops/local/README.md#private-employee-membership-revocation-210).
The isolated transaction invalidates only the selected tenant's membership and matching pending Employee
invitations, records audit, and denies the next protected read for that grant. [#221](https://github.com/Maeximilion/MaexSocial/issues/221)
retains real identity/MFA and the public Manager mutation. G3 acceptance remains open.

November 21 test maintenance [#155](https://github.com/Maeximilion/MaexSocial/issues/155) corrects the two OIDC elapsed assertions while retaining their strict 6500 ms limit. The [delivery handover](handovers/sessions/2026-11-21-oidc-monotonic-time.md) preserves both historical observations and the closure rationale. The original host cause remains undetermined. G3 and G5 acceptance remain open.

November 22 bounded content delivery [#208](https://github.com/Maeximilion/MaexSocial/issues/208) records the exact Manager proposal through an unmounted transaction exercised with local fixtures. [Contract and evidence](superpowers/plans/2026-11-06-task-2-deliveries.md#private-immutable-manager-approval-208) retain the authenticated action and reapproval in #223 after #131. Integrated Task 2 and G3/G5 remain open.

November 22 bounded content delivery [#211](https://github.com/Maeximilion/MaexSocial/issues/211) implements [private occurrence rescheduling](superpowers/plans/2026-11-06-task-2-deliveries.md#private-occurrence-reschedule-211). Changes to an unclaimed occurrence invalidate approval eligibility while preserving its identity, immutable history and any hold or quarantine. Authenticated integration and reapproval remain under #223 and #131.

Bounded Task 4 component [#213](https://github.com/Maeximilion/MaexSocial/issues/213) records [private local GBP observations](../ops/local/README.md#private-gbp-reconciliation-213) for existing attempts. A single matching fake LIVE result confirms publication in the local fixture. [#165](https://github.com/Maeximilion/MaexSocial/issues/165) retains dispatch, terminal export and integrated acceptance. G3 remains open.

Bounded [#220](https://github.com/Maeximilion/MaexSocial/issues/220) supplies a [verifiable local candidate record](../ops/local/README.md#local-pilot-candidate-manifest-220) for the fixture inputs, migration revision and matching Foundation/pilot attempts. [#82](https://github.com/Maeximilion/MaexSocial/issues/82) retains the staged assessment and release evidence.

November 22 bounded Task 4 delivery [#214](https://github.com/Maeximilion/MaexSocial/issues/214) shows
[stored publication outcomes](../ops/local/README.md#customer-publication-outcomes-214) to both customer roles
in their active workspace. Local HTTPS and browser checks cover missing and conflicting evidence,
UTC timestamps, keyboard navigation and read-only access. [#165](https://github.com/Maeximilion/MaexSocial/issues/165)
retains integrated Task 4 acceptance.

Bounded Task 4 delivery [#252](https://github.com/Maeximilion/MaexSocial/issues/252) commits a
[private terminal export](../ops/local/README.md#private-terminal-text-export-252) of the exact approved
revision when Google access is missing. The isolated fixture covers authorized repeats, rollback and a competing
attempt. The authenticated route, dispatch worker and integrated acceptance remain in [#165](https://github.com/Maeximilion/MaexSocial/issues/165).

Bounded Task 4 delivery [#253](https://github.com/Maeximilion/MaexSocial/issues/253) claims a due
[private synthetic dispatch](../ops/local/README.md#private-synthetic-dispatch-claim-253) and sends its
stored approved text once to the persistent fake. The test covers terminal export races and read-only
recovery. Integrated service operation and acceptance remain under #165 and #10.

November 21 bounded content delivery [#169 / PR #171](https://github.com/Maeximilion/MaexSocial/pull/171) merged at `4391dd4`. The read-only Manager preview shows the proposed current draft revision with the actual destination and both stored time interpretations. The [local handover](handovers/sessions/2026-11-21-approval-preview.md) preserves the inherited [OIDC timing observation](https://github.com/Maeximilion/MaexSocial/issues/155#issuecomment-7064165910). The [Claude API receipt](https://github.com/Maeximilion/MaexSocial/pull/171#issuecomment-7064198446) and [candidate pilot CI](https://github.com/Maeximilion/MaexSocial/actions/runs/44914659252) record the later integration evidence. #124 retains actual approval and #131 retains identity and MFA. G3–G5 remain open.

November 18 bounded Task 2A2 component [#154 / PR #157](https://github.com/Maeximilion/MaexSocial/pull/157) merged at `d2332fe` with internal
durable independent account/source throttles. The [private contract](../ops/local/README.md#internal-accountsource-throttles-154)
defines moving windows, both charges on denial, database time after locks, pseudonymous bounded storage and retained
key continuity. Public auth, provider actions, sessions and timed idle cleanup are absent; #149's generation gap,
#131, integrated Task 2 and G3/G5 remain open. The [delivery checkpoint](handovers/sessions/2026-11-18-auth-throttle.md)
records local checks. The [Claude API receipt](https://github.com/Maeximilion/MaexSocial/pull/157#issuecomment-7063657299)
reports zero findings, and [candidate pilot CI](https://github.com/Maeximilion/MaexSocial/actions/runs/44911015387) passed 27/27 before and after a retained-volume restart.

November 18 bounded content delivery [#153 / PR #156](https://github.com/Maeximilion/MaexSocial/pull/156) merged. Current Employees and Managers can read the latest synthetic facts revision for each own-tenant location. Private fixture ownership alone writes normalized plain text, provenance and explicitly simulated historical Manager confirmation; the app has SELECT-only access. [Contract](superpowers/plans/2026-11-06-task-2-deliveries.md#synthetic-business-facts-153) and [delivery evidence](handovers/sessions/2026-11-18-business-facts.md) preserve current authority checks, empty states and all existing content records. Real fact confirmation, generation and publication remain open.

November 17 bounded content delivery [#151](https://github.com/Maeximilion/MaexSocial/issues/151): Employee and Manager can follow an existing draft destination to a read-only occurrence detail and back. The protected lookup uses the active tenant and occurrence's own location; stored state, UTC instant and timezone-aware local time are displayed without showing an approved snapshot or changing domain records. [Delivery evidence and restart instructions](handovers/sessions/2026-11-17-occurrence-details.md) distinguish this read from scheduling, approval, export and provider execution. #124/#131, Task 2 and G3/G5 remain open.

November 17 source-only identity evidence: [#149](https://github.com/Maeximilion/MaexSocial/issues/149) records the [pinned Keycloak 26.8.2 generation assessment](security/identity-generation-evidence.md). No complete supported enrollment/recovery-generation contract was established: #143's factor event and #136's status reads cannot yet produce current App-session/Manager MFA authority. Internal credential-row versioning and transactional events have narrower scopes. Root retains the missing-assurance checklist pending new primary evidence; #131, the affected #123/#124 Manager actions, integrated Task 2 and G3/G5 remain blocked. No provider experiment or product change was performed; [handover](handovers/sessions/2026-11-17-identity-generation.md).

November 17 bounded identity delivery [#147 / PR #148](https://github.com/Maeximilion/MaexSocial/pull/148) merged. Optional private browser logout follows committed AppDB revocation and cookie deletion. The ordinary app stays local-only. [Contract and isolated checks](../ops/local/README.md#private-confirmed-browser-logout-147) distinguish actual browser SSO confirmation from separately seeded application authority; abandoned confirmation and controlled provider-connection failure cannot restore local access. #131, integrated Task 2 and G3/G5 stay open.

November 17 bounded content delivery: [#144](https://github.com/Maeximilion/MaexSocial/issues/144) adds Employee/Manager creation of own-tenant text drafts with an initial location and immutable revision 1. It reuses the protected synthetic session boundary and existing editor; no Google grant is needed to save a draft. [Contract and migration limits](superpowers/plans/2026-11-06-task-2-deliveries.md#new-text-drafts-144) preserve occurrence-level destination authority. #124 retains facts, scheduling and Manager approval; #131 retains real identity/MFA. G3/G5 remain open.

November 17 bounded identity delivery: [#139 / PR #142](https://github.com/Maeximilion/MaexSocial/pull/142) adds private ordinary OIDC verification with durable browser-bound single-use attempts. The unmounted verifier returns only verified issuer/subject; real isolated Keycloak browser evidence does not issue an application session or establish admission, MFA freshness or lifecycle/recovery completion. [Contract and limits](../ops/local/README.md#private-oidc-verification-139) retain operation-driven cleanup until a timed integration is supplied before public use. #131, integrated Task 2 and G3/G5 remain open; Root owns merge and integration.

November 17 bounded delivery: [#140](https://github.com/Maeximilion/MaexSocial/issues/140) adds existing own-tenant text editing for Employee and Manager, immutable revisions, explicit stale-edit conflicts and atomic removal of affected unclaimed approval eligibility. It consumes A1's protected request boundary with synthetic test sessions. [The domain contract](superpowers/plans/2026-11-06-task-2-deliveries.md#existing-text-editing-140) preserves claimed/history records. #124 stays open for its remaining approval flow; real auth/MFA #131, integrated Task 2 and all product gates remain open. This delivery has no dependency on #139's private OIDC component.

November 17 private factor component [#143 / PR #146](https://github.com/Maeximilion/MaexSocial/pull/146) merged. The unmounted OIDC verifier adds an isolated enrolled-OTP event receipt, bound to server-selected subject/purpose/policy and original attempt expiry. Actual local browser evidence requires another OTP execution after prior high-ACR SSO; unenrolled and first-factor-only flows fail. [Contract and checks](../ops/local/README.md#private-enrolled-factor-evidence-143) and [delivery checkpoint](handovers/sessions/2026-11-17-fresh-factor.md) distinguish event evidence from current enrollment/recovery/action authority. #131's lifecycle bridge, #123/#124 and G3/G5 remain open.

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
| Design and detailed plan, MS-008–009 | Local design and #112 plan accepted by the [owner decision](https://github.com/Maeximilion/MaexSocial/issues/15#issuecomment-6681723454); #113 merged and #8/#9 closed | [G2 decision packet](superpowers/specs/2026-11-06-g2-acceptance-packet.md), [local implementation plan](superpowers/plans/2026-11-05-ms-009-local-text-pilot.md) and [G2 work plan](superpowers/plans/2026-11-05-g2-work-plan.md) |
| First slice, media and autonomy, MS-010–012 | Task 1/#118 and Task 2A1/#135 merged. #136 adds bounded read-only status; #131 owns real auth/lifecycle/MFA. #123/#124 await Root dispatch and real auth prerequisites. Task 3 waits for all four and integrated evidence. External release, media and autonomy remain gated | [Work packages](07_WORKPACKAGES.md), [Task 2 delivery plan](superpowers/plans/2026-11-06-task-2-deliveries.md), [status adapter contract](../ops/local/README.md#read-only-identity-status-136) |
| Branding and handover refinement | Delivered in this update | [Issue #27](https://github.com/Maeximilion/MaexSocial/issues/27), [brand guide](15_README_STRATEGY.md) and [Claude brief](handovers/claude-rea.md) |
| Review and orchestration policy | #125 / PR #126 merged; its actual ordinary API review completed with zero findings on `d58b97ed906ed161bc7c648b8f470b227e130d5d`. Every later delivery still needs current-head/base evidence | [API run](https://github.com/Maeximilion/MaexSocial/actions/runs/44096520596), [receipt](https://github.com/Maeximilion/MaexSocial/pull/126#issuecomment-6949942340), [review policy](tooling/agent-workflow.md#pr-review-policy) |
| Protected Claude review route | #127 is merged; PR #130 supplied the first actual protected API execution and publication, with a complete zero-finding receipt. Inline publication was not exercised because there were no findings. Every later protected PR still requires its own complete coverage | [API run](https://github.com/Maeximilion/MaexSocial/actions/runs/44105408195), [PR #130 receipt](https://github.com/Maeximilion/MaexSocial/pull/130#issuecomment-6951209268), [operation and limits](tooling/claude-protected-review.md) |
| PR/security checks | Maintenance delivery, no product-gate change | [Issue #29](https://github.com/Maeximilion/MaexSocial/issues/29), [evaluation strategy](08_EVALS.md) |
| Complete Claude input | #132 / PR #134 merged at `bfad8dd`; the 180,000/200,000/210,000-byte envelope passed current-candidate CI and a complete protected API review with zero findings. Each product PR still needs its own complete current-head/base evidence | [PR #134 receipt](https://github.com/Maeximilion/MaexSocial/pull/134#issuecomment-6952517441), [API run](https://github.com/Maeximilion/MaexSocial/actions/runs/44114616868), [limits and evidence](tooling/claude-input-preflight.md) |
| Claude review output | #121 / PR #122 merged; the retained envelope subsequently completed a real ordinary review on PR #126. The #127 protected route subsequently completed its first genuine live use on PR #130 | [Disposition](https://github.com/Maeximilion/MaexSocial/issues/121#issuecomment-6683416099), [PR #126 receipt](https://github.com/Maeximilion/MaexSocial/pull/126#issuecomment-6949942340), [PR #130 receipt](https://github.com/Maeximilion/MaexSocial/pull/130#issuecomment-6951209268), [protected route](tooling/claude-protected-review.md) |
| Local secret guards and Codex hooks | [PR #48](https://github.com/Maeximilion/MaexSocial/pull/48) merged. Repository Stop check failures are advisory. Git secret guards and required CI remain effective | [Issue #44](https://github.com/Maeximilion/MaexSocial/issues/44), [local security and CLI setup](19_LOCAL_SECURITY.md) |
| Explicit checks and development skills | [PR #59](https://github.com/Maeximilion/MaexSocial/pull/59) merged. Code Autopilot and Caveman are enabled locally. Run security/quality/Dependabot advisories only on explicit `/start` or `/task`. Periodic polling is paused | [Issue #56](https://github.com/Maeximilion/MaexSocial/issues/56), [skill roles](tooling/development-skills.md) |
| Registration, customer and platform-admin access, MS-013 | Roles/invitations and local security, deletion and recovery defaults accepted; real assurance evidence carried to #82. Runtime untested | [Issue #30](https://github.com/Maeximilion/MaexSocial/issues/30), [ACCESS-01–17](17_ACCESS_SECURITY.md) |
| PR metadata and Project views | Maintenance delivery | [Issue #32](https://github.com/Maeximilion/MaexSocial/issues/32), [Project operations](16_GITHUB_PROJECT.md) |
| Customer media library, calendar and optional advertising | Requested direction and G2 proposal. The offline media library example uses fictional records. Integration and operating authority remain gated | [Planning issue #40](https://github.com/Maeximilion/MaexSocial/issues/40), [workflow, API evidence and proposed acceptance cases](18_MEDIA_LIBRARY.md) |
| Agent anatomy and repository artwork security | Foundation work tracked in issue #42; runtime hook trust remains local | [Implementation plan](superpowers/plans/2026-11-05-agent-anatomy-and-asset-security.md), [tooling guide](tooling/agent-workflow.md) |
| Customer upload/processing security, MS-014 | #43 completed for the owner-accepted text-only scope; JPEG limits and later media evidence remain in #99 | [Owner disposition](https://github.com/Maeximilion/MaexSocial/issues/43#issuecomment-6671306956), [UPLOAD-01–10 and threat boundaries](security/uploads.md) |

On 2026-11-05 Maxi accepted the [six G1 deliverables](https://github.com/Maeximilion/MaexSocial/issues/14) as a bounded research baseline. The [owner decision](https://github.com/Maeximilion/MaexSocial/issues/14#issuecomment-6661937363) authorizes G2 planning. Product design, implementation, external tests, spending and customer operation each require explicit authorization beyond G1 planning. Design acceptance alone does not authorize implementation. Distinct design and bounded implementation decisions may be presented together and recorded separately in one owner response.

## What's next

1. Complete the remaining Task 2 deliveries and integrated evidence under [#10](https://github.com/Maeximilion/MaexSocial/issues/10). [#131](https://github.com/Maeximilion/MaexSocial/issues/131) is blocked on supported enrollment/recovery-generation evidence. [#123](https://github.com/Maeximilion/MaexSocial/issues/123) and [#124](https://github.com/Maeximilion/MaexSocial/issues/124) retain integrated identity and fresh-MFA prerequisites. Follow the coordinator's dispatch for eligible local work and the [audited task sequence](07_WORKPACKAGES.md#audit-follow-up--2026-11-21) for Tasks 3–6.
2. Keep staging assurance in [#82](https://github.com/Maeximilion/MaexSocial/issues/82) and the owned staging entry in [#163](https://github.com/Maeximilion/MaexSocial/issues/163). The actual Google publication result, account eligibility and operating authority remain #10 evidence. Export is a pre-dispatch fallback. External access, customer data, deployment and spending require separate authorization.
3. Preserve the later gates and carried [#88](https://github.com/Maeximilion/MaexSocial/issues/88) and [#99](https://github.com/Maeximilion/MaexSocial/issues/99) evidence. [#167](https://github.com/Maeximilion/MaexSocial/issues/167) scopes a future G4 AI candidate before #11's approved spike. The local pilot uses manually authored text with no product model selected.

[Local readiness recovery #219](../ops/local/README.md#local-readiness-recovery-219) supplies a healthy mailbox control, an observed loss of readiness and a verified normal restart. [#82](https://github.com/Maeximilion/MaexSocial/issues/82) retains separately approved staging and monitoring acceptance.

## Planning audit · 2026-11-21

The [Ponytail planning audit and verification pass](https://github.com/Maeximilion/MaexSocial/issues/162) checked source and Graphify at `51c4df7` and read back the native G0 → G1 → G2 → G3 → G4 → G5 chain. #162 remains open for the resulting task and gate evidence. [#137's disposition](https://github.com/Maeximilion/MaexSocial/issues/137#issuecomment-7064444214) closed the empty-page browser observation after it did not recur in subsequent required runs. The cause remains unknown and the native G5 relationship preserves the history. [#168's synthetic tooling measurements](https://github.com/Maeximilion/MaexSocial/issues/168#issuecomment-7064158170) are recorded. The maintenance issue remains Project Blocked on native callback attribution and effective runtime routing, with no product-gate dependency.

## Evidence limits

[Tracker #88](https://github.com/Maeximilion/MaexSocial/issues/88), assigned to Maxi, carries five open items to [G5](https://github.com/Maeximilion/MaexSocial/issues/18): embedded analytics, Google-side publication, write workflows, other tiers and authenticated REA capture. The tracker lists the evidence required to close each item. G5 is blocked until all five are resolved. A nearer gate that needs one of these results must also wait for its evidence.

The first web-tool dashboard request failed, but a subsequent unauthenticated HTTP capture succeeded. REA 6.8.0 analyzed three selected client chunks as static text. The Codex report records evidence IDs and partial coverage. The Claude lane covered legal/pricing pages, an anonymous runtime capture and 36 public client chunks; the R2 comparison of 32 SE claims shows no contradiction with Codex. R1/R2 had no authenticated UI coverage; R3 adds 14 UI evidence records from a read-only walkthrough of one package-2 account. Authenticated REA runtime capture, external provider results, private backend behavior and autonomous publication remain unverified. Historical diagnostics found direct Codex MCP registration missing and Claude registration present. They do not establish current live tool connectivity or a completed Claude investigation.

## Earlier decisions and operating state (through 2026-11-05)

This historical planning state is superseded for the local scope by the accepted G2 decision and current work above.

Maxi selected the exact Deep Tech dark palette on 2026-11-05: Cyan-Electric `#00E5FF`, Warm Coral `#FF5E5B`, Midnight `#0B0F19`, Dark Slate `#161F30` and Off-White `#F8FAFC`. [Issue #38](https://github.com/Maeximilion/MaexSocial/issues/38) aligns the repository artwork and [brand guide](15_README_STRATEGY.md); the future application must use the same color roles.

MaexSocial's name and public repository visibility are confirmed by Maxi. Public research reports are sanitized. Reference-repository conventions are adapted to this project. Code Autopilot and Caveman are enabled under the revised owner decision; [development skill roles](tooling/development-skills.md) define complementary Ponytail and Superpowers use. For the [local-first planning decision](https://github.com/Maeximilion/MaexSocial/issues/8#issuecomment-6671380463), [ADR 0001](decisions/0001-application-language.md) assigns strict TypeScript to the portal and Node API/worker, SQL to PostgreSQL migrations and C#/.NET WPF to the signed Windows administrator. Python remains repository tooling. Production deployment and G2 acceptance remain open. Software implementation follows independent Claude REA, synthesis and approved design.

Maxi confirmed a public website with customer registration/login and separate platform-administrator access on 2026-11-05. Administrators must see and manage customers; customer workspaces remain isolated. Proposed security controls and fourteen named acceptance cases are recorded for G2, not implemented or runtime-tested.

The owner configured the dedicated GitHub Project credential. Targeted API queries preserve its project/public_repo scope choice. Hosted reconciliation is active and verified. The canonical checkout stays on clean main, changes use separate task worktrees, and synchronization follows [playbooks](12_CLAUDE_CODE_PLAYBOOKS.md).

## Delivered evidence and handovers

[Task 6 budget fixture #218](https://github.com/Maeximilion/MaexSocial/issues/218) exercises concurrent reservation,
atomic settlement and unresolved cost in the [isolated ADS-01 checks](../ops/local/README.md#synthetic-job-budget-218).
The integrated Task 6 receipt and operating authority remain open under [#10](https://github.com/Maeximilion/MaexSocial/issues/10).

[Session handovers](handovers/sessions/) record each session's stopping point and runnable restart instructions.

- 2026-11-05 — [MS-015 / #49 repository anatomy assessment](superpowers/specs/2026-11-05-repository-anatomy-review.md) records verified reference facts, candidate recommendations and accepted owner decisions; this is maintenance assessment, not product-gate acceptance.
- 2026-11-04 — Reference conventions inspected, foundation authored, public repository and Project #5 verified. Twelve task issues, six parent gate issues, six milestones and three genuine iterations provisioned. PR #19 delivered the foundation and bounded Codex report. Local validation and nine regression tests passed. Astra high review found a partial-PR status defect that received a regression test and fix.
- 2026-11-04 — PR #24 replaced generic CLI Project access with scoped GraphQL queries. [Hosted reconciliation](https://github.com/Maeximilion/MaexSocial/actions/runs/41929472537) passed. G0 technical acceptance was recorded in the charter after CI, review and maintenance verification. The foundation tag marks the initial snapshot, with the API correction subsequently on main.
- 2026-11-05 — Issue #27 refines branding and research handover. Claude's brief now requires independent evidence first, a comparison matrix second, and a separate product proposal. Detailed product planning remains future G2 work.
- 2026-11-05 — Handover MS-004 from Claude Code to Codex. PR #34 carries checkpoint R1/R1a, Codex comparison R2 and the read-only authenticated addendum R3 for one package-2 account. CI passed on `0edcd04`. Outstanding: Astra-high review, owner decision on the gaps in [report section 9.6](research/claude-rea.md), then merge under repository rules. Claude made no merge.

- 2026-11-05 — PR #34 quality corrections (Refs #4): R1a/R2 revision times now use verified Git committer times and distinguish Claude's reading disclosure from Git evidence; CE-101–CE-114 identify the whole private observation log as the hash basis with separate section locators; coverage limits distinguish R1/R2 from the R3 read-only UI walkthrough. Private raw data and Codex artifacts were not changed. G1 and issue #4 remain open pending owner acceptance of the remaining gaps. Validation and the resulting head are recorded in PR #34.

Update this file alongside work-package changes. Tie completion claims to actual reports, commands, issue/PR links and recorded decisions.
