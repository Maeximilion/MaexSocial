# G2 planning brief for the first customer publication

**Decision status:** G1 accepted as a bounded research baseline. Maxi authorized G2 planning. This brief compares candidate product designs for [MS-008](https://github.com/Maeximilion/MaexSocial/issues/8). Maxi confirmed the pilot planning assumption below. Architecture selection, customer operation and [G2 acceptance](https://github.com/Maeximilion/MaexSocial/issues/15) each need their own evidence. [Owner decision](https://github.com/Maeximilion/MaexSocial/issues/14#issuecomment-6661937363) · [PCF](../../00_PCF.md) · [G1 synthesis](../../research/synthesis.md#product-option-for-g2-discussion)

## Which customer outcome would count?

The customer registers, verifies the email address and signs into the new workspace as an Employee. On the enrolled PC, DEV/Admin selects the customer and verified Employee, proves fresh MFA and grants Manager access with an audited reason. The Manager confirms business facts, checks the exact text, account, time and destination, then approves one revision for that occurrence. DEV/Admin may stop that single occurrence before dispatch with fresh MFA, an explicit target and an audited reason. The portal shows the provider result or an unknown outcome. [Customer role decisions](../../17_ACCESS_SECURITY.md#permissions-for-the-text-pilot) · [Owner decision on the hold](https://github.com/Maeximilion/MaexSocial/issues/30#issuecomment-6670980326)

**Owner-confirmed pilot planning assumption.** Plan for one local business, one approved organic text post on Google Business Profile (GBP), and an independently verifiable result on Google. Authorization to plan this route covers no real account, call or publication. A permitted project, customer-controlled eligible location, grant and readback still have to be evidenced before use. With required access unavailable before dispatch, atomically take the occurrence out of automatic delivery and end at manual export and display “Exported — no Google publication confirmed.” That route cannot satisfy the G3 publication criterion. Meta was considered and would require a new scope decision, including format and media prerequisites. [Pilot decision](https://github.com/Maeximilion/MaexSocial/issues/8#issuecomment-6662099692). Never assume pilot access from the G1 walkthrough. [Channel evidence](../../research/platform-api-feasibility.md) · [Media direction](../../18_MEDIA_LIBRARY.md)

Recurring posting, paid generation, paid distribution, multi-channel publication and autonomous approval are later decisions. Customer sign-up, a separate administrator login and server-side isolation apply to the first externally accessible slice whichever channel is chosen.

## Approaches to the same failure

Suppose a provider receives the post and the response is lost. Which component owns the record and prevents a second write?

| Approach | Recovery and operating trade-off |
|---|---|
| Modular TypeScript application with a durable publication worker and direct provider API (recommended) | One transactional store records the authorized occurrence, dispatch and reconciliation. An operator can inspect one record after a crash. The team owns worker recovery and the provider adapter. |
| Workflow-led delivery | A workflow engine can make individual steps visible. It would need tenant-scoped secrets, durable coordination with the approval store and safe resume after an ambiguous write. Another privileged system needs monitoring and a budget. |
| Hybrid | The application owns approval, dispatch and reconciliation. A separate orchestrator could later run bounded background processing. For one text post it adds deployment and failure boundaries before there is a second workload to justify them. |

[ADR 0001](../../decisions/0001-application-language.md) selects TypeScript strict with Node.js as the API/job direction. For comparison, use a single deployable service plus a worker using the same code and a relational store for transactions and unique occurrence keys. Consider PostgreSQL, a maintained identity solution supporting separate client registrations, and a signed installable PC client. Record framework, runtime, identity, database, packaging and hosting selections, version support, costs, failure handling and rejected alternatives in a proposed ADR before requesting MS-008 acceptance. A framework name alone would leave the recovery question unanswered. [Architecture baseline](../../02_ARCHITECTURE.md)

## Customer and operator boundaries

```text
Customer browser -> public domain / customer API -> verified workspace membership
Maxi's signed PC client -> separate admin login with MFA -> management API
Both APIs -> server authorization for action + target -> tenant records and audit
Approved occurrence -> durable worker -> current policy / grant / budget -> provider
Provider result -> validated account-bound readback -> customer-visible status
```

The browser may call public registration, verification and customer-scoped routes; it receives no management credentials. Propose a separately restricted management endpoint, reachable from an enrolled device over a private connection, with a distinct token audience. Direct calls must pass the same server checks. Neither client connects to the database or holds provider credentials. A lost PC triggers session and device revocation, followed by recovery through an independently verified method. Propose two enrolled phishing-resistant authenticators, OS-protected session storage, short-lived access, signed distribution and version checks on update including rollback protection. Reject a tampered package or untrusted update before execution. Record enrollment, signer custody and break-glass recovery ownership in #30. Compare the signed client against an installable private web app for update effort, offline token exposure and device revocation before selecting packaging.

| Actor | Proposed permitted action | Required check |
|---|---|---|
| Anonymous | Register, verify and recover | Uniform public responses, bounded attempts, single-use expiring verification bound to identity |
| Employee | Read/edit own tenant drafts and export exact Manager-approved text if Google access is missing before dispatch | Check active tenant membership, current approval and exclusive terminal export claim |
| Manager | Same customer rights, plus approve exact revision for a location and occurrence, invite/remove own Employees | Verify current tenant role and target. Edits invalidate approval. Employee management cannot grant Manager authority |
| DEV/Admin on enrolled PC | Create/manage customers, provision or approve customer access by tenant, email and role, suspend or hold one occurrence | Fresh MFA, explicit target and audited reason/outcome. Deny customer post approval and export |
| Worker | Claim one approved occurrence | Check current membership/policy, active tenant, grant, stop and funds at dispatch. Treat client or job identifiers as untrusted |

**Data and privacy.** Keep workspace membership, brand facts, account/grant reference, revision, approval, occurrence, attempts, provider receipt, budget reservations and audit entries as distinct records. Bind customer-owned records to the workspace, including lookups, exports and provider callbacks. Keep secrets in a restricted secret store. Encrypt transport, persistent storage and backups, restrict key access and test tenant-scoped deletion including derivatives. Define backup expiry, restore-time reapplication of deletions, administrator access logs, incident owner, processor/region and numerical retention periods before accepting #30. Separate original customer approvals and local audit events from Google-returned content. Read provider state on demand. Cache only limited content for permitted performance purposes, securely, without aggregation or modification, for at most 30 calendar days. Keep cached fields out of long-lived audit logs and backups; original expiry also applies after restore. Recheck current terms before enabling the integration. [Google Business Profile content storage policy](https://developers.google.com/my-business/content/policies#content_storage). Use synthetic A/B tenants in evidence. Public reports contain redacted identifiers and outcomes. [Access requirements](../../17_ACCESS_SECURITY.md) · [Operating boundaries](../../09_OPERATIONS_LEGAL.md)

## Publication, stopping and cost

1. Snapshot revision, tenant, approved account, timezone, instant and occurrence ID. In one transaction persist the intent and a unique occurrence key. Duplicate clicks and competing workers must converge on the same intent. Check an edit, pause or revocation again at the dispatch boundary.
2. Record a dispatch attempt before the external write. Use a provider idempotency key where supported. On crash or timeout after a possible send, mark outcome unknown, reconcile the original operation and escalate if correlation is inconclusive. Once dispatch has been claimed, an uncertain result goes to reconciliation even if access disappears. Withhold manual export for that occurrence. Conversely, an exported occurrence is permanently ineligible for automated dispatch, including after reconnect or restore.
3. Show scheduled, held, submitting, provider processing, confirmed, rejected and unknown separately. For GBP record the resource name, destination, observed time and independent Google-side readback in LIVE state before marking the occurrence published. A create receipt alone leaves the result pending. Preserve the audit trail when a hold arrives after submission. Stop future work and report what the provider already accepted.
4. Begin with zero authorized paid generation and advertising. Before incurring any hosting, storage or external cost, name the payer, tenant and period, units, hard internal limit and escalation owner. Atomically reserve the worst-case charge before any concurrent billable dispatch. Settle once on evidence, retain the reservation for ambiguous results and decline work without headroom. Retries consume the same authority. Separately disclose vendor billing lag or externally unenforceable limits. Paid campaigns require distinct asset/account/creative/audience/dates/spend approval. [Media and advertising contracts](../../18_MEDIA_LIBRARY.md)

## Decisions to bring to Maxi together

| Owner decision | Recommendation for planning | Consequence if deferred |
|---|---|---|
| Eligible pilot account and its owner | Maxi confirmed one local business, one approved GBP text post and an independently verifiable result as the planning assumption. Record eligibility privately and publish only its disposition | Keep adapter conditional. Export/demo can proceed later under its own scope, but cannot complete G3 publication |
| Architecture, admin connection and operations owner | Direct application + worker, transactional database, restricted admin API and signed PC client. Name the person responsible for deployment, recovery and lost-device revocation | #30 can map tests in parallel. #8 and #9 cannot finalize deployment paths or threat boundaries |
| Publication authority and escalation | One explicit customer approval per exact occurrence, operator hold, zero automatic retries after an ambiguous send, manual escalation | Keep dispatch disabled until roles, retry ceiling and stop behavior are accepted |
| Data handling and uploads | First slice text only. Approve region, processor list, retention/deletion including backups, numerical file and worker limits, key custody and support access separately | Without accepted access/privacy evidence, withhold external customer access. Without accepted #43 controls, keep uploads and remote media retrieval disabled |
| Cost and payer | Separate operational ceiling from per-tenant generation and ad limits. Zero paid provider/ad authority unless a named owner approves amounts, period, currency and billing escalation | No spend or live integration. Estimate hosting and operating costs in G2 before choosing deployment |

## Evidence carried beyond G2

[#88](https://github.com/Maeximilion/MaexSocial/issues/88) owns the five open limits: embedded analytics, Google-side publication in the researched product, its write workflows, other tiers and authenticated REA capture. It blocks [G5 / #18](https://github.com/Maeximilion/MaexSocial/issues/18). No G2 package reopens that research. If an earlier decision would rely on missing evidence, remove that reliance or require evidence at that nearer boundary. Each newly deferred gate gap needs an owned issue, a closure condition, a G5 blocker link and any nearer prerequisite. Evidence from our own future pilot has a different target from the competitor research gap.
