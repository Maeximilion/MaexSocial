# MS-007 · What the discovery evidence supports

As of 2026-11-05, SocialEdge documents a staffed local-visibility service. Two independent investigations found a customer portal. One read-only package-2 walkthrough showed operator activity, scheduled posts, replies and ranking embeds. The portal's “Live” label establishes a local state. Neither lane observed delivery to Google or a publication on a customer's social account. The useful first product question is how a customer can approve one revision and learn what actually happened to it.

## Inputs and authority

This bounded delivery for [#7](https://github.com/Maeximilion/MaexSocial/issues/7) uses the following artifacts on main at `ba464cf`. All five inputs are complete within their recorded scopes. On 2026-11-05 the coordinator accepted the five MS-004 limits under Maxi's delegation. Together with the matrix merged in [PR #73](https://github.com/Maeximilion/MaexSocial/pull/73), this [delegated scope decision](https://github.com/Maeximilion/MaexSocial/issues/4#issuecomment-6658967747) completes the research synthesis. [G1](https://github.com/Maeximilion/MaexSocial/issues/14) awaits separate owner acceptance. The design option at the end is for [G2](https://github.com/Maeximilion/MaexSocial/issues/15).

| Input | Provenance, date and delivery scope |
|---|---|
| [MS-002 inventory](socialedge-feature-matrix.md) · [PR #69](https://github.com/Maeximilion/MaexSocial/pull/69) | #2 closed. Five anonymous vendor pages checked 2026-11-05 against earlier captures. M01–M17 distinguish public offers, operators and observed UI. |
| [MS-003 report](codex-rea.md) · [manifest](evidence-codex.json) | #3 closed for public static scope. 2026-11-04, anonymous GETs and inert REA analysis of three selected chunks from eleven inventoried files. |
| [MS-004 report](claude-rea.md) · [manifest](evidence-claude.json) · [PR #34](https://github.com/Maeximilion/MaexSocial/pull/34) | [#4](https://github.com/Maeximilion/MaexSocial/issues/4) closed. R1/R1a checkpoints precede the committed R2 comparison. Claude disclosed prior exposure to the status summary and reported when it first read Codex's report. Git establishes commit order only. R3 adds read-only UI evidence. |
| [MS-005 feasibility](platform-api-feasibility.md) · [PR #71](https://github.com/Maeximilion/MaexSocial/pull/71) | #5 closed. Official API, policy, MCP and cost sources accessed 2026-11-05. Customer grants, quotas, MCP tools, billing and provider outcomes untested. |
| [MS-006 demo search](photo-to-ad-demo.md) · [PR #70](https://github.com/Maeximilion/MaexSocial/pull/70) | #6 closed for bounded search. Four candidates assessed using publisher pages/media on 2026-11-05. Original TikTok identity open. One costed spike proposed, never executed. |

## Claim matrix

Each row compares the two lanes. **confirm** means support for the same scoped claim, **extend** means additional evidence or coverage, **contradict** requires incompatible evidence for the same scope, and **unverifiable** means the comparison cannot settle the claim. Five artifacts share hashes across the manifests (shell, homepage, pricing, dashboard layout and page). Two readings of a shared source give one underlying observation.

Codex locators refer to the report or its manifest: **HTTP** means named captures, **ST** the static findings, **offer** the marketed capabilities, **demo** the candidate list. A dash means no matching evidence. Claude locators are manifest IDs. CE-001–028 refer to the anonymous 2026-11-04 lane (vendor pages, client text or passive runtime as specified). CE-101–114 are form/UI/network observations from 2026-11-04 23:50 to 2026-11-05 00:07 UTC, covering anonymous forms and one signed-in P2 account with one location. Their shared hash covers a private observation log with individual section locators. Later UI evidence qualifies a row without rewriting the original R2 comparison.

| ID | Scoped claim | Codex | Claude | Result | Scope, limit or needed evidence |
|---|---|---|---|---|---|
| SE-001 | Anonymous dashboard GET returns a 200 application shell | HTTP app | CE-010, CE-011 | confirm | Same shell bytes. Anonymous runtime redirects after load. |
| SE-002 | Homepage and pricing return 200 | HTTP home, pricing | CE-001, CE-002 | confirm | Matching bytes for each page. |
| SE-003 | Shell references 19 scripts | HTTP app | CE-010 | confirm | HTML count, distinct from selected files. |
| SE-004 | Client uses Next.js | ST chunk paths | CE-010, CE-013 | confirm | Framework inferred from the shipped client. Version unknown. |
| SE-005 | Layout includes analytics, billing, history, library, posts, reviews, settings and support | ST layout | CE-014, CE-028, CE-102 | confirm | Shared layout. R3 adds navigation for one P2 customer. |
| SE-006 | Layout references academy, foundation and calculator | ST layout | CE-014, CE-021, CE-025, CE-112 | extend | Conditional/gated routes. P2 academy denied, other two redirected. |
| SE-007 | Eleven dashboard route candidates compared across inventories | ST route_candidates | CE-028 | unverifiable | Codex counts root plus ten paths. Claude counts eleven sub-routes among 15 candidates. No itemized CE-028 list to compare. |
| SE-008 | Pending post/review labels exist | ST layout | CE-014, CE-106, CE-107 | confirm | P2 sample had no pending items to exercise. |
| SE-009 | Client references Google access | ST googleAccess | CE-013, CE-017 | extend | Manager setup and check path in client. Server verification unknown. |
| SE-010 | Client references dashboard activity and rank scans | ST page | CE-018, CE-103 | extend | Checklist and heatmap embed visible. Scan cadence unverified. |
| SE-011 | Database architecture unknown to Codex | ST | CE-013, CE-003 | extend | Firestore calls and vendor disclosure. Other server stores unknown. |
| SE-012 | Internal job system unknown | ST | — | unverifiable | No backend evidence in either lane. |
| SE-013 | AI providers unknown to Codex | ST | CE-003 §12 | extend | Vendor names providers/tools. Per-artifact attribution unknown. |
| SE-014 | Hosting architecture unknown to Codex | ST | CE-010, CE-001, CE-003 | extend | Headers and vendor statements identify services. Server deployment topology unresolved. |
| SE-015 | Vendor offers profile care, posts, reviews, visibility, directory sync and reports | offer, HTTP home/pricing | CE-001, CE-002 | confirm | Shared vendor pages. Per-operation delivery varies. |
| SE-016 | Higher packages add intake, follow-up, CRM and on-site media | offer | CE-002 | extend | P2 adds intake/follow-up. P3 adds CRM, win-back and shoot. |
| SE-017 | Software and managed delivery are sold together | offer | CE-001, CE-004 | confirm | Terms assign work to staff. Automation fraction unknown. |
| SE-018 | Public material does not establish autonomous image-to-ad generation | offer | CE-002, CE-003, CE-013 | confirm | Bounded negative. Staff production is advertised. |
| SE-019 | Public material does not establish all-channel customer automation | offer | CE-003 §8, CE-005 | extend | Own TikTok drafts disclosed. Customer social service described as forthcoming. |
| SE-020 | Luma, Runway and Kling are possible remembered demos | demo | — | unverifiable | Claude did not inspect them. MS-006 separately supports candidate existence, not identity. |
| SE-021 | Anonymous dashboard calls session endpoint and redirects to sign-in | — | CE-011 | extend | Anonymous runtime trace. CE-101 later shows a sign-in form only. |
| SE-022 | Self-registration and a free tier are offered | — | CE-027, CE-004, CE-019, CE-101 | extend | Form viewed. Submission and free-plan limits untested. |
| SE-023 | Client models post states, auto-approval and rejection reasons | ST labels only | CE-015, CE-004, CE-106 | extend | P2 showed approved/live items and toggle. Pending/rejected transitions untested. |
| SE-024 | Client can request Google sync, retry and display twelve sync states | — | CE-015, CE-106, CE-114 | extend | No sync label/call in P2 page-load sample. Server path and duplicate handling unknown. |
| SE-025 | Client can mark a post published by scheduled time without a sync record | — | CE-015, CE-106 | extend | Static branch. Whether it explains any sampled “Live” post is unknown. |
| SE-026 | Review replies support approval, rejection and auto-approval in the client | ST labels only | CE-016, CE-004, CE-107 | extend | P2 auto-approval active. Manual transition and Google result untested. |
| SE-027 | Manager access described, GBP API described as planned | — | CE-017, CE-003 §9, CE-111 | extend | Policy dated 2026-10-30. No P2 connection UI found. Actual server integration unknown. |
| SE-028 | Rank tracking uses Local Dominator embeds | — | CE-003, CE-018, CE-103–105 | extend | P2 embeds visible. Their internal data and accuracy unverified. |
| SE-029 | Onboarding client describes scan, import and Drive folder | — | CE-017, CE-112 | extend | Foundation redirected in P2. No end-to-end scan or import. |
| SE-030 | P1/P2/P3 list at €300/450/1,500 net per month | offer lacks prices | CE-002, CE-019, CE-110 | extend | Advertised annual terms. Billing showed P1 price and active P2. Subsidized examples use different periods. |
| SE-031 | Growth guarantee counts call clicks, website clicks and directions | — | CE-004 §5 | extend | Terms dated 2026-07-29. Contractual metric, not observed sales. |
| SE-032 | Customer-facing CRM or follow-up UI exists | — | CE-013, CE-102 | unverifiable | No such UI in selected chunks or P2 navigation. Staff and other tiers unknown. |
| SE-033 | Dashboard showed 16 operator activity checklists with state and notes | — | CE-103 | extend | One P2 account. Update actor and frequency unknown. |
| SE-034 | Posts displayed local “Live” / “Genehmigt” labels | — | CE-106 | extend | No visible Google confirmation for the 23 P2 posts. |
| SE-035 | Scheduled posts in the sample were four days apart | — | CE-103, CE-106 | extend | Consistent with checklist target of eight per month. Other dates/accounts untested. |
| SE-036 | Sampled posts assert business facts and name nearby towns | — | CE-106 | extend | Two P2 posts. Origin/approval of those facts unknown. |
| SE-037 | Review replies showed active auto-approval and “Live” labels | — | CE-107 | extend | One P2 account. Google-side replies unknown. |
| SE-038 | Review view listed 14 of 429 with no paging/filter/search visible | — | CE-107 | extend | Older reviews may be available elsewhere. |
| SE-039 | Analytics and history use third-party embedded views | — | CE-104, CE-105 | extend | Outer P2 pages observed. Iframe contents inaccessible. |
| SE-040 | P2 offer lists courses while sampled P2 account was denied academy access | — | CE-002, CE-112 | extend | Offer vs entitlement. Manual provisioning and other accounts unknown. |
| SE-041 | Observed full page loads posted to welcome-message and session endpoints | — | CE-114 | extend | Network URLs in P2. Server effects unknown. |
| SE-042 | No team, invitation or integration controls were offered in sampled navigation/settings | — | CE-102, CE-111 | extend | P2 only. Other roles and tiers unobserved. |

## Differences, gaps and next evidence

No same-scope contradiction was established between Codex and Claude. Four comparisons remain unverifiable (SE-007, SE-012, SE-020 and SE-032). For SE-007 a sanitized route list could enable item-level comparison. For SE-012 only authorized backend evidence could identify the job system. For SE-020 see the candidate ledger below. For SE-032 the service promise and the lack of a sampled CRM screen can both hold.

The policy describes manager access and a planned API, the client contains sync/retry code, and the customer saw local status labels (SE-024–027, SE-034, SE-037). Those sources answer different questions. The publication mechanism, external outcome and retry safety remain unresolved. Likewise, the P2 course offer and the academy access denial need entitlement/provisioning evidence (SE-040). A portal library containing four vendor videos (CE-109) adds scoped corroboration to Maxi's separate description. It establishes neither tenant upload nor automatic reuse of customer assets.

| Accepted MS-004 research limit | Evidence needed if the limit must be closed |
|---|---|
| Embedded Local Dominator analytics | Authorized view of the iframe contents for the observed location. The outer page alone cannot verify metrics or scan accuracy. |
| Google-side result | Authorized match of a specific post or reply to its provider resource/state or public listing. The dashboard label is insufficient. |
| Write workflows | Separate action scope and suitable test items for approval/rejection, toggle changes, chat, upload, location and billing flows. No such action was exercised. |
| Other tiers | Authorized, tier-specific observations for free, P1 and P3. The P2 sample covers one location. |
| Authenticated REA capture | Authorized session with suitable capture tooling. R3 was a UI walkthrough without authenticated REA/CDP. |

## Capability to API/MCP crosswalk

Source date for all M rows is 2026-11-05. [MS-002](socialedge-feature-matrix.md) supplies the actor and original source for each row. [MS-005](platform-api-feasibility.md) supplies the official references, access/review rules, quota and cost basis. Every provider route here is documentation-only. No MaexSocial customer account, grant, publication, connector or paid job was tested.

| Inventory | Observed or advertised work | Documented route, operating limit and fallback |
|---|---|---|
| M01 | Prospect scan and estimate advertised | GBP Performance covers managed-location interactions/search impressions. Geogrid, competitors, AI ranking, scan email and cost require separate supplier/sender rights. |
| M02 | Staff obtain manager access, maintain profile and assist verification | GBP Business Information/Verifications require an approved project, authorized location and business.manage OAuth. Owner requests verification. Escalate duplicates, suspension and unsupported fields. |
| M03 | P2 lists activity and embeds ranks | GBP metrics and licensed geogrid scans have different inputs. Record period/freshness, keep missing values unknown, price/verify supplier coverage. |
| M04 | Staff plan posts, P2 shows local schedule | GBP local posts require an eligible authorized location, compliant project model and specific consent. Keep resource name, read LIVE/PROCESSING/REJECTED. Reconcile uncertain writes before retry or hand off manually. |
| M05 | P2 shows replies, review removal is a staffed request | Verified-location reviews API with specific authority. Read reply back. Pub/Sub notifications require setup. Refer disputes to Google. |
| M06 | Staffed directory consistency across 50+ listings advertised | No verified multi-directory write grant. Obtain roster, rights, prices and per-directory result or keep manual. |
| M07 | Staff optimize content for local/AI search | Reviewed APIs supply no assured recommendation/rank. Identify licensed inputs and report measured outcomes separately. |
| M08 | WhatsApp/Drive intake advertised, P2 showed four vendor videos | Customer library is a MaexSocial proposal. Import scopes, retention, prices and rights unverified. Use only approved inputs under an accepted upload design. |
| M09 | Staffed on-site production advertised | Runway Dev/Higgsfield API document billable asynchronous generation. Commercial terms, tenant authority and actual costs need verification. Keep staff editing available. |
| M10 | Staff contact press for placement | No press-distribution entitlement established. Staff handle outreach and publishers decide placement. |
| M11 | Follow-ups, reminders and win-back advertised | Requires distinct CRM/event source, authorized sender, recipient consent and pricing. No delivery trace. Keep human handling. |
| M12 | Metrics, reports, calls and personal videos advertised | GBP Performance can supply dated interactions. Rank licensing, source reconciliation and staff interpretation remain separate. |
| M13 | P2 showed support controls and academy denial | No confirmed support messaging/course entitlement from publishing grants. Staff handle requests, verify provisioning. |
| M14 | Custom AI consulting and integration advertised | Disclosed AI providers do not identify task execution. Scope each customer's contract, grants, retention and budget before automation. |
| M15 | Subsidy/territory consulting advertised | Human advice and funding-body decision. No checked API settles eligibility, availability or savings. |
| M16 | Own TikTok drafts disclosed, customer social offer forthcoming | Instagram professional account/App Review or eligible Facebook Page grants. TikTok Direct Post requires creator choices, per-post consent and audit for public use. Inbox handoff leaves publication to the creator. Business Accounts API needs separate partner access. Paid ads need independent asset and budget authority. |
| M17 | Website creation advertised separately from optimization | No verified hosting or site deployment entitlement in the checked APIs. Scope hosting, permissions and price as separate staff/supplier work. |

For M02–M05, Google lists API use at no charge for registered users, with project-specific quotas, consent, caching and disconnect conditions. For M16, Instagram documents 100 API posts per moving 24 hours and 24-hour container expiry. Account-specific eligibility, Page quotas, organic fees and ad spend remain open. Google Ads read-only MCP and Meta/TikTok advertising tools grant no organic posting entitlement. No first-party organic publishing MCP was verified for those three destinations. [Google operations and policy](platform-api-feasibility.md#google-business-profile) · [Meta operations](platform-api-feasibility.md#meta-organic-publishing-and-paid-advertising) · [TikTok routes](platform-api-feasibility.md#tiktok-creator-and-business-publishing)

For M08/M09, Runway's documented five-second gen4.5 example costs USD 0.60 before tax. Creative MCP can spend credits. Developer-account tools have different permissions. Higgsfield's API uses a separate balance from its web-account MCP. Its promotional Kling Standard example was USD 0.042–0.063 per output second. Neither price establishes an approved budget or bill. Copy approved outputs before expiry and verify rights and deletion independently of link expiry. [Media terms, rates and lifecycle](platform-api-feasibility.md#customer-media-and-generation) · [MCP boundaries](platform-api-feasibility.md#mcp-availability-and-g1-handoff)

## Which video might Maxi have seen?

[MS-006's original-page evidence](photo-to-ad-demo.md) supports four plausible candidates. Confidence describes the fit of the example, not the identity of the TikTok post.

| Candidate | Distinguishing observation and confidence boundary |
|---|---|
| Luma AI LTD | Strong fit for turning one product image into multiple pack-shot formats. Gallery labels were readable, source image/motion unverified. Distinct from LumaLabs Dream Machine. |
| Runway | Strong photo-to-commercial fit. Moka pot, blue flame and pouring water appear in sampled footage. The gallery does not establish which assistant produced it. |
| Kling | Strong Claude/workflow fit. Tutorial shows fashion references and batch approval, including a watch and blue garments. No live API transaction observed. |
| BAIBE / Higgsfield | Strong presenter-ad fit. Sampled vertical clip shows a jar and a ring-shaped gummy. The walkthrough also requires a product URL, audience brief and human approval. |

TikTok search was restricted and no original permalink or uniquely matched creator/frame was found. Identity stays unresolved unless Maxi can match a distinctive cue to an original post. None of these examples establishes a SocialEdge capability, a generation result on our account or a selected provider.

## Product option for G2 discussion

**One local business, one approved organic post, one known result.** A customer signs into an isolated workspace, confirms the business facts, reviews the exact draft and destination, then approves a single revision for one scheduled occurrence. The operator can hold it. Show approval, scheduled time, submission and provider result separately. Record the provider ID and read back publication state. On revocation, rejection or an ambiguous timeout, stop, reconcile the original attempt or offer a manual export labeled as such. Only a confirmed provider result counts toward the G3 publication case.

This tests the useful P2 journey (M04, SE-023–025 and SE-034–036) and its largest uncertainty in one release. A text-first post could avoid introducing uploads until [MS-014](../security/uploads.md) is accepted, subject to the selected format. GBP best matches the observed local workflow if an authorized project and location are available. A Meta destination could instead test the [owner-requested library/calendar journey](../18_MEDIA_LIBRARY.md) if the customer, format and app grants support it. Choose the destination at G2 after checking actual eligibility. Export is a fallback for a blocked pilot, not evidence of G3 provider publication.

Proposed follow-ons: rights-cleared customer assets and reusable calendar drafts after the upload controls are accepted, then one separately budgeted media spike with output review at G4. Consider recurrence, a narrowly scoped autonomy policy with stop/revocation at G5, and paid distribution only under separate campaign authority. Use original code, copy and design.

| Decision for Maxi at G2 | What the answer fixes for MS-008/009 |
|---|---|
| Which first business, location, account owner, channel and format can be used for the pilot? What if app approval is denied? | Named eligible destination and approved manual fallback. No default channel. |
| Who may draft, approve, hold, schedule and disconnect? Is each content revision individually approved, and who handles rejected or unknown results? | Role/action matrix, specific consent, stop and escalation. Test duplicate-send prevention, revoked grants and revision changes. |
| Will the first release accept uploads or only approved text? Which rights, processors, region, retention, deletion period and file limits apply? | [MS-013 access controls](../17_ACCESS_SECURITY.md) and MS-014 cases, tenant isolation, administrator audit and release prerequisites. |
| What per-tenant cost and retry caps apply to posting and later renders? Which provider, if any, may receive which assets? | Separate storage/API costs, paid generation, retry authority and manual alternative. No provider or advertising approval implied. |
| What result and failure evidence must the supervised pilot produce? When may recurrence, paid campaigns or unattended actions be considered? | One confirmed resource on the intended account, no duplicates after timeout, visible revocation/hold and an audit trail. Future spend and autonomy need independent acceptance. |

If a later decision relies on one of the five limits, obtain the evidence listed above before claiming support. Gate #14 remains open for Maxi’s separate G1 decision.
