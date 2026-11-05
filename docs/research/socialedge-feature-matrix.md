# SocialEdge feature and service matrix

[MS-002](https://github.com/Maeximilion/MaexSocial/issues/2) inventories the offer to local businesses as observed on **2026-11-05**. SocialEdge sells staffed Google profile operations alongside a customer portal. The strongest product evidence is for reading activity, ranks, posts, reviews and support controls in one package-2 account. Delivery to Google, unattended cross-channel publishing and image-to-ad-video generation remain unverified.

## Evidence key

Anonymous HTTP GETs on 2026-11-05 returned 200 for all five primary pages below. Their HTML SHA-256 values matched the corresponding CE records from 2026-11-04 in the [Claude manifest](evidence-claude.json). To reproduce, fetch each URL as HTML without signing in and compare the response bytes with the named manifest entry. No forms, app sessions, bundles, purchases or write actions were used in this inventory.

| Source key (all retrieved 2026-11-05) | What to look for | Prior capture |
|---|---|---|
| [H · Homepage][H] | Performance Hub, posts, reviews, support, scan and case examples | CE-001 |
| [P · Pricing][P] | Standard and subsidized cards, detailed comparison by package, enterprise and bonuses | CE-002 |
| [T · Terms][T] | Version 2026-07-29. Parts 1–3 (duties, content, portal), 5–6 (guarantee and territory) | CE-004 |
| [D · Privacy policy][D] | Version 2026-10-30. §§8–10 (TikTok account, Google access, ranking suppliers), §12 (AI use) | CE-003 |
| [R · Ranking check][R] | Hearing-care landing page, scan steps, social offer availability | CE-005 |

**VC** means a vendor claim, including a written promise in the terms. **ST** means earlier inspection of static client text. **UI** means the earlier read-only walkthrough of one P2 account, recorded 2026-11-04 23:50 to 2026-11-05 00:07 UTC. **INF** marks an inference. **Unknown** names the outstanding verification. The [Codex report](codex-rea.md) and [manifest](evidence-codex.json) cover three selected files on 2026-11-04. The [Claude report](claude-rea.md) supplies the SE claim crosswalk, CE evidence IDs and P2 scope. Two readings of the same page establish one source. No external publication result was observed in either lane.

## Commercial scope

Prices are the net EUR amounts shown on the observation date. Each paid audience is a local business. The table distinguishes the standard rate from the vendor's illustrative BAFA consulting totals. Eligibility and award were untested. P2 includes P1, and P3 includes both. [P][P] · [T §§1.8, 3.3, 5–6][T] · SE-022, SE-030, SE-031.

| Offer | Standard | Advertised scope or distinction |
|---|---|---|
| Free access | Free | Terms list one monthly scan, chat, selected calculators and informational videos. Ongoing managed production belongs to the paid offer. Free-account limits were not exercised. |
| P1 · Marketing-Assistent | €300/month, €3,600/year | Profile and local visibility work. BAFA example €800–1,850 net total for 12 months. |
| P2 · 24/7 Vertriebsmitarbeiter | €450/month, €5,400/year | Listings, AI-search visibility, replies, follow-ups and video reporting. The **16-month subsidized example** uses a €7,200 base and quotes €1,600–3,700 net total. |
| P3 · Marketing- & Operations-Abteilung | €1,500/month, €18,000/year | Production, campaigns and managed operations. Sold out with a waiting list at capture. BAFA example €12,400–14,500 net total for 12 months. |
| Enterprise | By enquiry | Custom AI systems developed, integrated and maintained for the buyer. Deliverables and price depend on the project. |
| Conditional bonuses | Offer-specific | Cards advertise an NFC/QR review kit with staff guide, website SEO/AI setup and maintenance at P2/P3, and a P3 print/design pack. P1/P2 cards say “01. Dezember” without a year. Bonuses depend on the offer at booking. |

The commercial promise is organic growth with one customer per industry and region. T §5 measures an agreed 12-month target using the sum of call clicks, website clicks and directions. Under its conditions the vendor continues service for up to 12 further months if the target is missed. Testimonials report selected outcomes. Neither those examples nor the growth calculator measures an individual prospect's future sales. [H][H] · [P][P] · [T §§3.8, 5–6][T]

## Capability inventory

Use the stable **M** row IDs when referencing this inventory. SE and CE IDs keep their original meanings. Each source key links to the primary page with the date above. A package range describes what is advertised. The actor and evidence columns distinguish who does the work from what a customer could actually see.

| ID · audience | Inputs → offered output | Actor and delivery | Primary evidence and boundary |
|---|---|---|---|
| M01 · Prospects / free users | Business, location, website, first name and email → regional rank scan, competitor and AI visibility results on a personal page and by email. Business assumptions → potential-growth estimate. | Prospect supplies inputs. Vendor describes a scan and a separate calculator. | VC [H][H], [R][R], [D §10][D], [T §§3.3, 3.7–8][T]. R advertises 78 search locations. D excludes disposable email addresses. No scan or calculator result tested. SE-022 covers registration, CE-101 records the form only. |
| M02 · Paid owner and staff | Website, Maps profile, photos, opening hours, services and products → reviewed business facts and maintained Google profile. | Owner supplies facts. For an existing profile the owner grants manager access. For a business without a profile the team assists with setup and verification. The team maintains profile data, catalogue, photos and keywords. Paid support includes suspensions and video verification. Google decides reinstatement. | VC [H FAQ][H], [P][P], [T §§1.5, 2.1–2, 3.5–3.5a][T], [D §9][D]. ST SE-009, SE-027, SE-029 show access and prefill paths. UI CE-112 could not open foundation onboarding. Edits and access check untested. |
| M03 · P1–P3 | Search terms, competitors, locations and profile metrics → opportunity analysis, rank heatmap, history, notifications and activity lists. | Team interprets local demand. Portal shows trends and work performed. Local Dominator supplies embedded rank views. | VC [H][H], [P][P], [D §10][D]. ST SE-010. UI SE-028, SE-033, SE-039, CE-103–105 show checklists and embeds. Iframe internals, acquisition rights and scan accuracy unknown. |
| M04 · P1–P3 | Approved facts and media → drafted, scheduled Google posts, customer review or automatic release. | Team plans, writes and designs. Customer approves, requests revisions or enables automatic release. Operator may hold a post. | VC [H][H], [P][P], [T §§2.1–4][T]. UI SE-034–036 / CE-106 shows local post labels and scheduled items. ST SE-023–025 includes a clock-based published state. Provider receipt, retries and actual cadence outside that P2 sample unknown. |
| M05 · P2–P3 | Fresh reviews and customer context → tailored replies. Disputed reviews plus evidence → complaint to Google (P3). | Team prepares replies or complaints. Owner can review or enable automatic release. Google decides removal. | VC [H][H], [P][P], [T §§2.5, 2.8][T]. UI SE-026, SE-037, SE-038, CE-107 show reply labels and active auto-approval in P2. No manual transition, Google reply or removal verified. |
| M06 · P2–P3 | Business name, address and phone → consistent entries and duplicate prevention across 50+ listings. | Vendor manages directory data. Directories control their listings. | VC [P][P], [T §§2.1, 2.7][T], SE-015. Directory roster, update latency and per-directory write access unknown. A listing count does not establish social posting support. |
| M07 · P2–P3 | Service catalogue, keywords, website and structured data → pages prepared for AI/local search. | Team optimizes the customer's content for discovery by Google and assistants. | VC [P][P], [R][R]. A recommendation by ChatGPT, Claude or Gemini is an intended outcome. Assistant placement and causation unverified. |
| M08 · P2–P3 | Customer photos/video via WhatsApp or Google Drive → collected, edited material for ongoing content. | Customer supplies material. Team processes it. Vendor claims automatic Drive sync. | VC [P][P]. ST SE-029 / CE-017 describes folder creation. UI CE-109 shows vendor videos in the portal library. Customer asset storage, import, permissions and deletion unknown. |
| M09 · P3 | On-site shoot → edited images and short clips for up to a year of content. | Production team shoots and edits at the business. | VC [P][P], SE-016, SE-018. This is evidence for a staffed shoot. An image-to-video generator, ad buying or autonomous campaign delivery remains unknown. |
| M10 · P3 | Local topics and seasonal offers → press releases, media outreach, Google copy and graphics. | Team develops campaigns and contacts regional media. Publishers decide placement. | VC [P][P]. No customer PR console, automatic distribution or guaranteed placement established. |
| M11 · P2–P3 | Purchase, feedback and appointment data → follow-up and reminders. P3 adds inactive contacts → email/messenger win-back campaigns and maintained customer database. | Team configures flows, structures and synchronizes data. Customer must supply usable contact and event inputs (INF). | VC [P][P], SE-016. UI SE-032 / CE-102 found no customer CRM/follow-up screen in the sampled P2 navigation. Connectors, triggering, consent records and actual sends unknown. |
| M12 · P1–P3 | Rank and Google interaction data → monthly breakdown. P2/P3 add a short personal results video. P3 adds monthly calls, annual plan and quarterly adjustments. | Portal exposes indicators. Staff explain results, plan with the customer and send video by messenger or email. | VC [P][P], [H][H], [T §3.6][T]. UI CE-103–105 covers portal views only. Delivery of reports, calls and source reconciliation unknown. |
| M13 · P1–P3 | Customer question, change request or attachment → help from a named contact. Learning materials → guides/courses. | Staff answer dashboard chat or WhatsApp. Customer reads the learning portal where entitled. | VC [H][H], [P][P], [T §3.11][T]. UI CE-108 saw chat controls. SE-040 / CE-112 saw Academy access denied in P2 despite advertised courses. Sending, response time and actual course provisioning unknown. |
| M14 · P3 / enterprise | Repetitive business tasks → custom workflows and AI assistance for copy or operations. | Vendor consults, integrates and maintains tailored systems. | VC [P][P], [D §12][D]. SE-013 records provider disclosures. Which model executes any given task, deployment scope and unattended operation unknown. |
| M15 · Prospects | Business situation → individual consulting, subsidy application assistance and region availability check. | Team advises and offers application handling. Funding body decides subsidy. | VC [H][H], [P][P], [T §6][T]. Eligibility, territory availability and savings for a given customer unknown. |
| M16 · Customer social channels vs vendor's own channel | Marketing materials → potential future customer social operations. Vendor's own clips → TikTok drafts. | Customer social service marked forthcoming on R. D describes a connection to the vendor's own TikTok account only. | VC [R][R], [D §8][D], SE-019. No customer account connection, publication on Meta/TikTok, paid advertising or cross-channel scheduler verified. |
| M17 · Local businesses seeking a website | Business offering and contact goals (INF) → website aimed at calls and bookings. | Vendor advertises website creation separately from the P2/P3 promotion for optimizing and maintaining agreed pages. | VC [R][R], [P][P]. Package assignment, build process, hosting, integrations and conversion results unknown. |

## Handoff to MS-005

[MS-005](https://github.com/Maeximilion/MaexSocial/issues/5) depends on this inventory. Carry the M IDs into its official-provider feasibility checks. For each proposed operation record account ownership, permission and app-review requirements, limits, cost, confirmation of success and fallback when access is denied.

| Rows | Question for the feasibility matrix |
|---|---|
| M02, M04, M05 | Separate staffed setup or verification assistance from API authority to create or verify a location. Which Google APIs allow profile reads/edits, posts and review replies for an authorized location? The vendor's dated policy calls its Business Profile API connection planned. Static client sync and P2 “Live” labels supply no provider receipt. Separate approval, attempted write and confirmed result. |
| M01, M03, M06, M07, M12 | Separate official profile metrics from purchased geogrid scans, directory synchronization and AI search estimates. Which sources license each input, with what coverage, freshness and cost? |
| M08, M09, M16 | Check customer media intake separately from generation, organic posting and advertising. Compare media-provider API/MCP output, commercial rights, retention and cost, then verify Meta/TikTok permissions per account type. The [media proposal](../18_MEDIA_LIBRARY.md) is a MaexSocial requirement. |
| M10, M11, M13–M15, M17 | Retain staff, customer and third-party decisions when comparing CRM, messaging, reporting and bespoke workflows. Identify the authorized sender, consent basis and fallback before attributing an automated operation to a provider. |

G1 synthesis and owner acceptance remain separate. Other tiers, customer writes, Google publication receipts, directory updates and paid media runtime remain open.

[H]: https://www.socialedge.ai/
[P]: https://www.socialedge.ai/preise
[T]: https://www.socialedge.ai/agb
[D]: https://www.socialedge.ai/datenschutzrichtlinien
[R]: https://www.socialedge.ai/hoergeraete-check
