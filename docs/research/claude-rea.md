# MS-004 Claude Code REA report — SocialEdge

**Lane** — Independent Claude Code research for [issue #4](https://github.com/Maeximilion/MaexSocial/issues/4). **Plan** — [investigation plan](../superpowers/plans/2026-11-05-ms-004-claude-rea.md). **Manifest** — [evidence-claude.json](evidence-claude.json).

**Report revisions**

| Revision | Time basis (UTC) | Content |
|---|---|---|
| R1 — independent checkpoint | Git commit time 2026-11-04T23:34:59Z, `35c61ac` | Sections 1–5. Claude reports no prior reading of the Codex report or manifest |
| R1a — own evidence addendum | Git commit time 2026-11-04T23:36:11Z, `13ccff8` | CE-028 route analysis added after R1; Claude reports this preceded reading the Codex lane |
| R2 — comparison | Git commit time 2026-11-04T23:38:30Z, `5ac75fa` | Sections 6–8 contain the Codex comparison |
| R3 — authenticated UI addendum | Reported observation-window end 2026-11-05T00:07Z | Section 9, scenario C-S6 |

The R1–R2 timestamps above are Git committer times, not observation times (`git show -s --format=%cI 35c61ac 13ccff8 5ac75fa`, converted to UTC). Git ancestry establishes that the checkpoint commits precede the committed comparison; it does not independently establish when Claude read the Codex files. Exact R1a observation and R2 reading times are unverified; the earlier revision labels 23:40Z and 23:50Z are withdrawn. Capture windows elsewhere remain as originally reported, not revalidated by this correction. Sections 1–8 preserve the R1/R2 scope; section 9 records later R3 UI coverage and current gaps.

## 1. Method, scope and access

| Item | Value |
|---|---|
| Targets | `https://www.socialedge.ai/` (public site, sitemap pages) and `https://app.socialedge.ai/de/dashboard` (customer app) |
| Capture window | 2026-11-04T23:22Z–23:40Z UTC (2026-11-05 CET) |
| Access tier | Anonymous visitor. No account, cookie or session. No sign-up, login, form submission or chat |
| Tools | REA 6.8.0 MCP (`capture_browser_scenario`, `list_browser_targets`, `analyze_web_bundle`), REA 6.8.0 CLI, headless Chrome 156.0.8078.80 in temporary profiles, `curl` GET, local Python text extraction |
| Raw data | Ignored `work/rea-claude/`. Only hashes and sanitized observations are committed |

Evidence classes used below: **VC** vendor claim (public marketing/legal text), **RT** runtime observation, **ST** static artifact observation of client JavaScript served to an anonymous visitor, **INF** labelled inference, **UNK** unknown.

Static bundle method. The dashboard HTML shell is served with HTTP 200 to anonymous visitors and lists its route chunks. The dashboard layout chunk names eleven sub-routes. Each sub-route's public HTML shell was fetched once and its chunk list collected. 36 JavaScript files were retained for local, non-executing analysis. Public pages were selected from the sitemap's 116 URLs (CE-009); case studies and the calculator (CE-007, CE-008) were read but not used as capability evidence. REA's passive `analyze_web_bundle` saw only five scripts before the client redirect (CE-012), so the downloaded chunk set is the primary static source. A REA MCP `analyze_javascript_application` call on that set exceeded the host tool deadline. It was not repeated unchanged. The CLI fallback on all chunks hit REA's per-source deadline on a React vendor chunk. A CLI run on the 15 route chunks completed (CE-028) and independently lists the eleven dashboard sub-routes, sign-in, billing and two PDF downloads as static route candidates.

## 2. Exposure disclosure

Before planning, `docs/01_STATUS.md` was read as required by repository rules. It states that Codex analyzed three selected client chunks with REA 6.8.0 and that its report contains candidate demos. Claude reports that no Codex report body or manifest content was read before this checkpoint revision was committed; Git history does not independently verify that reading sequence.

## 3. Independent findings

### 3.1 Product offer

- **VC** SocialEdge presents itself as a done-for-you local visibility service for Google Business Profiles, explicitly "more than software". The team plans, writes and implements; the customer reviews in a "Performance Hub" (CE-001, CE-002).
- **VC** Three annual packages: P1 "Marketing-Assistent" 300 €/month net (3,600 €/year, 12 months), P2 "24/7 Vertriebsmitarbeiter" 450 €/month (5,400 €/year, 16 months under BAFA variant), P3 "Marketing- & Operations-Abteilung" 1,500 €/month (18,000 €/year, marked sold out, waitlist). Enterprise custom AI automation on request (CE-002). The app's billing chunk carries the same three plans plus a free plan (CE-019).
- **VC** Package scope as described: P1 profile optimization, posts, photos, competitor/keyword analysis, ranking dashboard, guides, monthly view, named contact. P2 adds AI-assistant visibility (ChatGPT, Claude, Gemini), listings on 50+ platforms, media intake via WhatsApp or Google Drive, review responses, automated follow-up/reminders, 5-minute video report. P3 adds an on-site photo/video shoot, local PR, win-back campaigns, CRM build, workflow automation, monthly call and annual plan (CE-002).
- **VC** Commercial terms: 12-month growth guarantee on the sum of call, website-click and direction-request metrics from the Google profile, otherwise up to 12 months of extra service. One customer per industry and region. BAFA consulting subsidy is used as a sales channel (CE-002, CE-004 Part 5–6).
- **VC** Human operation is central: personal contact, support chat, WhatsApp voice messages, video reports, monthly calls (CE-001, CE-002, CE-004 §3.11). **ST** The in-app support chat is addressed to a named team member (CE-023). **VC** The operator is a two-person German partnership (CE-006).
- **VC** A free software tier exists: one ranking scan per month, support chat, selected calculators, media library of public videos. No content production (CE-004 §3.3). **ST** The app gates Analytics and Academy behind non-free plans (CE-014, CE-021).

### 3.2 Business setup

- **ST** Self sign-up at `/de/sign-up` with name, email, password (≥6 chars) and consent to AGB/privacy. Email confirmation link follows (CE-027). Registration fires an internal user-registered event with marketing-consent flag (CE-013).
- **ST** Settings collect user data, billing address and company data. Company data is seeded from a Google Maps link parsed server-side (`/api/maps/parse-link`) (CE-020).
- **ST** "Fundament" (foundation) onboarding: industry selection, website and Google profile link, then a server scan (`/api/fundament/scan`) pre-fills fields from the profile and website for customer review. Other parts: Google attribute loading per industry, opening hours, services, competitors, image import from profile/website (`/api/fundament/import-images`), a per-customer Google Drive upload folder (`/api/fundament/drive-folder`), a photo checklist, completeness tracking (CE-017).
- **ST** Google access is granted by the customer adding a SocialEdge email as **Manager** in Business Profile settings. The app then checks access server-side (`/api/google-access/check`, states granted/notFound). A path exists for customers without a profile (CE-017). **VC** The privacy policy confirms manager access through separate SocialEdge Google accounts and states that the Google Business Profile API connection is planned but not activated (CE-003 §9).
- **INF** Profile edits are done by staff through manager access, not by an OAuth API integration, as of the policy date. Not verified at runtime.

### 3.3 Content

- **VC** The team writes and designs Google posts. Customers can approve, reject with a change request, or enable automatic release. Staff may hold an auto-release item if in doubt. Feedback is requested 24 h before the planned time (CE-001, CE-004 §2.3–2.4).
- **ST** Post records carry `status` pending/approved/rejected/published, `scheduledFor`, `title`, `text`, `imageUrl`, `approvedAt`, and a structured `rejectionReason` with presets (factually incorrect, tone, wrong timing) plus free text. A per-user `autoApprovePosts` flag bulk-approves pending posts. Approval triggers a team notification (`/api/approval-notification`) (CE-015).
- **VC** AI is used to draft texts, images and responses, with human review "where appropriate". Named providers: OpenAI API, Anthropic API, business Gemini, Figma AI with Google's image model (CE-003 §12, CE-004 §1.7).
- **UNK** How drafts are generated, prompted and revised server-side.

### 3.4 Publication

- **ST** Client code can request synchronization of approved posts through `/api/posts/gbp` with actions `sync`, `delete` and per-user `enable`/`disable`. The client retries a partial sync request up to five times at 60-second intervals (CE-015). Whether posts are actually delivered to Google is unverified.
- **ST** Twelve displayed publication states: queued, sending, waiting (publishes on the scheduled day), scheduled at Google, processing at Google, live, rejected by Google, error (will retry), failed (re-save required), removed manually at Google, cancelled, deleted (CE-015).
- **ST** For posts without a Google sync record, the client sets `status` to published once an approved post's scheduled time has passed (CE-015). **INF** For such posts "published" reflects time, not a confirmed provider result.
- **VC** Contract terms: Google decides on display and removal. A publication failure caused by SocialEdge is corrected and re-sent (CE-004 §2.9).
- **UNK** Server-side mechanism behind `/api/posts/gbp` given that the policy says the Business Profile API is not yet active. Idempotency and duplicate-send protection.
- **VC** TikTok Content Posting API connects only SocialEdge's own account, as drafts (CE-003 §8). Customer social channel management is "coming soon" (CE-005).

### 3.5 Reviews

- **ST** Review records carry `reviewerName`, `rating`, `originalReview`, `response`, `status`, `createdAt`. Customers approve, reject with preset/free-text reason (soft delete), or set `autoApproveReviews` (CE-016). Rating summary data is read from the Local Dominator snapshot (CE-016).
- **VC** One drafted response per review. Customers accept, reject or allow auto-publication (CE-001, CE-004 §2.5). Package 3 adds help with reporting false reviews; only Google decides removal (CE-002, CE-004 §2.8).
- **UNK** How reviews are retrieved and how approved responses reach Google. No client call to a review-publishing endpoint was found in the retained chunks.
- **VC** Review acquisition via NFC/QR kit and tips; no bought or fake reviews (CE-002, CE-016).

### 3.6 Visibility, analytics and reports

- **VC/ST** Rank tracking uses Local Dominator: geo-grid scans, competitor comparison, directory checks. The dashboard embeds the Local Dominator heat-map via iframe from per-user snapshot records (CE-003 §10, CE-018).
- **ST** Dashboard home "Performance Hub" shows activities (done/open), notifications and the latest heat-map scan. History lists optimizations and ranking changes. Analytics (views, interactions, calls) is plan-gated (CE-018, CE-021, CE-022).
- **VC** Directory sync on 50+ platforms in P2. Monthly report and a personal 5-minute video report (CE-002). **UNK** Which directory network or tool performs listing sync.
- **VC** Free public ranking check: 78 grid points via Local Dominator, Google Places API, PageSpeed, Outscraper, directory lookups, plus OpenAI/Anthropic/Gemini/Perplexity queries for AI-assistant recommendations (CE-003 §10, CE-005).

### 3.7 Follow-up and CRM

- **VC** P2 automated follow-up after purchase, feedback collection and appointment reminders. P3 win-back by email/messenger, CRM build and sync (CE-002).
- **VC** Internal CRM and email: Brevo. Client calls sync newsletter and language preferences to Brevo (CE-003 §11, CE-013).
- **UNK** No customer-facing CRM or follow-up workflow UI exists in the retained app chunks. **INF** These are delivered as services outside the observed app.

### 3.8 Media

- **VC** Media intake via WhatsApp or Google Drive. P3 includes an on-site shoot with images and short-video material for up to twelve months (CE-002).
- **ST** The app supports image import from profile/website and a Google Drive upload folder. The "Mediathek" route lists SocialEdge's own educational videos (CE-017, CE-024).
- **VC** AI image/design editing through Figma AI with Google's image model (CE-003 §12).
- **UNK** Image-to-video generation. No observed app feature, endpoint or vendor statement supports it. Absence in the retained chunks does not prove absence server-side.

### 3.9 Platform and data handling

- **VC/RT/ST** Public site on Webflow behind Cloudflare. App is Next.js on Vercel (`fra1`). Firebase Authentication, Cloud Firestore (`europe-west3`), Firebase Storage. Stripe billing. Calendly booking (CE-001, CE-003, CE-010, CE-013).
- **ST** Firestore collection names in client code: users, posts, reviews, notifications, activities, chats, rankings, localdominator (CE-013). Notification types include foundation to-do, Google-access setup, onboarding video (CE-013).
- **RT** Anonymous request to `/de/dashboard` loads the shell, calls `/api/auth/session` and redirects client-side to `/de/sign-in` (email/password, remember me, password reset, register link) (CE-011).
- **ST** Layout enforces re-acceptance of updated legal terms (`legalAcceptance.agbVersion`) (CE-014).

## 4. Coverage limits and open questions

- In R1/R2, authenticated UI and runtime behavior (C-S6) were not observed. All app statements above are static candidates; reachability, permissions and server logic are unverified.
- Server routes (`/api/*`), background jobs, AI prompting and Google write paths are not visible to the client.
- Per-package feature mapping on the pricing table was taken from text order; checkmark columns were not parsed.
- Bundle completeness: 36 chunks from 15 routes. Code-split chunks not referenced by these shells may be missing.

Questions for the authorized walkthrough:

1. Does `/api/posts/gbp` write through an API, a third-party scheduler or staff action, and how are duplicate sends prevented?
2. How do review responses reach Google after approval?
3. Which directory network delivers the "50+ platforms" sync?
4. Does any customer-visible follow-up or CRM feature exist in paid plans?
5. Is any video generation, including image-to-video, part of content production?

## 5. Access request

At the R1/R2 checkpoint, C-S6 required Maxi to provide a SocialEdge account session (free tier at minimum, paid tier for posts, reviews and analytics) and an explicit action scope. Read-only navigation is the proposed default. Approving, rejecting, toggling auto-approval, uploading, chatting or purchasing each needs separate permission because they notify staff or change account state.

## 6. Comparison with the Codex lane (Phase B)

The committed Phase B comparison (`5ac75fa`) follows checkpoint commits `35c61ac` and `13ccff8`; the actual reading sequence is Claude's disclosure, not independently observed. Sources: [Codex report](codex-rea.md) and [Codex manifest](evidence-codex.json), both unchanged by this lane. Codex sections are cited as SM (Scope and method), EV (Evidence), OSF (Observed static facts), MC (Marketed capabilities), VD (video-demo candidates). Codex evidence is `ev_ff44c65c…` (complete analysis) with capture hashes from its manifest.

**Version alignment.** Both lanes captured on 2026-11-04 UTC. Both public manifests record byte-identical SHA-256 values for five artifacts: the dashboard shell (`5bafea14…`), homepage (`b477a09b…`), pricing page (`b14a1f97…`), dashboard layout (`518093de…`) and dashboard page (`465ab7d8…`). These show the same deployed versions for those artifacts. The language layout digest (`8f7f25b6…`) appears only in the Codex manifest; Claude's manifest covers that chunk only through the set digest of CE-013. Both lanes report eleven `/dashboard` route candidates derived from the same layout chunk (`518093de…`). Claude's manifest lists no per-route REA IDs for CE-028, so equality of route IDs is not demonstrated in the public evidence; only the route paths and counts are compared. Agreement on those routes is same-source corroboration produced by separate runs, not independent sources.

| Claim ID and exact claim | Codex evidence | Independent Claude evidence | Result | Source dates and scope | Unknowns and next check |
|---|---|---|---|---|---|
| SE-001 An anonymous GET of `/de/dashboard` returns HTTP 200 with a Next.js application shell | SM; manifest capture `app`, `5bafea14…` | CE-010 identical hash; CE-011 runtime load | confirm | Both 2026-11-04, anonymous, HTTP + Claude runtime | None for anonymous scope |
| SE-002 The public homepage and pricing page return HTTP 200 | SM; captures `home` `b477a09b…`, `pricing` `b14a1f97…` | CE-001, CE-002 identical hashes | confirm | Both 2026-11-04, anonymous HTTP | None |
| SE-003 The dashboard HTML references 19 scripts | SM | CE-010: 19 `script src` tags | confirm | Both 2026-11-04, static HTML | None |
| SE-004 The client app is built with Next.js | OSF (inference from `/_next/` paths) | CE-010 shell markup, CE-013 Next.js App Router chunk layout, CE-003 states Vercel hosting | confirm | Static + vendor claim | Framework version unknown |
| SE-005 The dashboard layout holds navigation for analytics, billing, history, media library, posts, reviews, settings and support | OSF; `518093de…` | CE-014 same chunk, separately parsed; CE-028 route candidates | confirm | Same chunk, separate runs | Reachability per plan needs C-S6 |
| SE-006 The layout also references academy, fundament and rechner | OSF | CE-014; CE-028 lists `/dashboard/fundament`, `/dashboard/rechner`; CE-025 academy page chunk | extend | Static | Claude adds: academy and analytics are plan-gated, foundation and calculator appear conditionally (CE-014, CE-021) |
| SE-007 REA recovers eleven `/dashboard` route candidates | OSF; manifest `route_candidates` | CE-028 (15 candidates incl. the same eleven paths; per-route IDs not listed in the Claude manifest) | confirm | Separate REA runs, overlapping sources | Server-only routes unknown |
| SE-008 The source contains pending-post and pending-review labels | OSF | CE-014 badges `pendingPosts`, `pendingReviews`, `unreadChats` | confirm | Static | Badge data source unverified |
| SE-009 The source contains a `googleAccess` identifier | OSF | CE-013 `/dashboard?googleAccess=1` link; CE-017 manager-access setup and `/api/google-access/check` | extend | Static + vendor claim CE-003 | Server check logic unverified |
| SE-010 The source contains dashboard activity and ranking-scan text | OSF | CE-018 activities, notifications, Local Dominator heat-map iframe | extend | Static + vendor claim CE-003 §10 | Scan cadence per plan unverified |
| SE-011 The internal database is unknown | OSF | CE-013 Firestore collection calls; CE-003 Cloud Firestore `europe-west3` | extend | Static + vendor claim | Server-side stores beyond Firestore unknown |
| SE-012 The job system is unknown | OSF | No own evidence | unverifiable | — | Requires backend evidence; not observable anonymously |
| SE-013 AI providers are unknown | OSF | CE-003 §12 names OpenAI API, Anthropic API, business Gemini, Perplexity (ranking check), Figma AI | extend | Vendor claim only | Which provider drafts which artifact is unverified |
| SE-014 Hosting architecture is unknown | OSF | CE-010 `Server: Vercel`, `fra1`; CE-001 Cloudflare; CE-003 Webflow, Vercel, Firebase, Hostinger | extend | Runtime headers + vendor claim | Server functions' region unknown |
| SE-015 SocialEdge markets profile optimization, posting, review management, visibility monitoring, directory sync and reporting | MC; `home`, `pricing` | CE-001, CE-002 | confirm | Same page versions, vendor claim | Delivery mode per item, see SE-017 |
| SE-016 Higher packages add media collection, follow-ups, CRM support and on-site photo/video | MC | CE-002: media intake and follow-ups in P2; CRM, win-back and shoot in P3 | extend | Vendor claim | Package mapping from text order |
| SE-017 The offer mixes software and managed delivery | MC | CE-001 "more than software"; CE-004 Part 2–3 operator duties and software functions | confirm | Vendor claim + terms | Proportion of automation unknown |
| SE-018 Public wording does not establish autonomous image-to-ad-video generation | MC | No feature, endpoint or vendor statement found (CE-002, CE-003, CE-013) | confirm | Vendor claim + static, bounded negative | Server-side tooling unknown; ask in C-S6 |
| SE-019 Public wording does not establish autonomous management across every social platform | MC | CE-005 social media "coming soon"; CE-003 §8 TikTok API for own account only | extend | Vendor claim | Customer social channels absent at capture time |
| SE-020 Luma, Runway and Kling demos are candidates for the remembered video | VD | Not checked in this lane | unverifiable | Out of MS-004 scope | MS-006 owns this search |
| SE-021 Anonymous dashboard access calls `/api/auth/session` and redirects to `/de/sign-in` | Absent | CE-011 | extend | Runtime, anonymous | None |
| SE-022 Public self-registration and a free plan exist | Absent | CE-027, CE-004 §3.3, CE-019 | extend | Static + terms | Free-plan limits at runtime need C-S6 |
| SE-023 Posts move through pending/approved/rejected/published with a per-user auto-approve flag and structured rejection reasons | Absent (labels only, SE-008) | CE-015; CE-004 §2.3–2.4 | extend | Static + terms | Server transitions unverified |
| SE-024 Client code can request Google sync of approved posts via `/api/posts/gbp`, defines twelve displayed sync states and retries the request | Absent | CE-015 | extend | Static; successful delivery to Google unverified | Server write path, provider result, idempotency |
| SE-025 Posts without a Google sync record are marked published client-side once their scheduled time passes | Absent | CE-015 (code), inference on meaning | extend | Static, inference labelled | Whether such posts still occur |
| SE-026 Review responses can be approved, rejected or auto-approved | Absent (labels only) | CE-016; CE-004 §2.5 | extend | Static + terms | Publication path to Google unverified |
| SE-027 Google access is granted as profile Manager; the Business Profile API is not yet active | Absent | CE-017, CE-003 §9 | extend | Static + vendor claim dated 2026-10-30 | Contradiction with SE-024 server path open |
| SE-028 Rank tracking uses Local Dominator geo-grid scans | Absent | CE-003 §10, CE-018 | extend | Vendor claim + static | None for this claim |
| SE-029 Onboarding scans website and profile, imports images and creates a Drive upload folder | Absent | CE-017 | extend | Static | Scan output quality unverified |
| SE-030 Prices: P1 300 €, P2 450 €, P3 1,500 € per month net, annual term | Absent (no prices) | CE-002, CE-019 | extend | Vendor claim | Prices dated 2026-11-04 |
| SE-031 Growth guarantee counts calls, website clicks and direction requests from Google profile data | Absent | CE-004 §5.2 | extend | Terms dated 2026-07-29 | None |
| SE-032 Customer-facing CRM or follow-up UI exists in the app | Absent | No UI found in 36 chunks (CE-013) | unverifiable | Bounded static negative | C-S6 paid-tier walkthrough |

No Codex claim was contradicted. Differences come from scope: Codex analyzed 3 of 11 files, Claude retained 36 chunks from 15 routes plus legal pages and an anonymous runtime capture.

## 7. MaexSocial proposals (not evidence)

These proposals derive from the observations above and the repository's G2 constraints. They do not choose a provider or implementation.

1. **Provider-confirmed publication states.** SocialEdge displays twelve states but also marks some posts published by clock time (SE-024, SE-025). MaexSocial should only report "published" from a provider confirmation and reconcile uncertain results before retry, as the charter requires.
2. **Per-item approval plus bounded auto-approval.** Structured rejection reasons and an auto-approve toggle with an operator hold (SE-023, SE-026) are a useful pattern. MaexSocial should audit who approved what and allow per-tenant policy, not a single global flag.
3. **Official API authorization over shared manager accounts.** SocialEdge relies on staff Google accounts with Manager access while its API connection is pending (SE-027). MaexSocial should evaluate the Business Profile API with tenant-scoped OAuth in MS-005, keeping revocation and token isolation testable.
4. **Approved business facts from onboarding.** A scan-and-review foundation step (SE-029) maps well to the charter's rule that generated claims trace to approved business facts. Scanned values should stay unapproved until a customer confirms them.
5. **Buy or build rank tracking.** SocialEdge buys geo-grid tracking (SE-028). MS-005 should price a provider option against building on official data before G2.
6. **Media as differentiator.** No image-to-video capability was observed (SE-018). G4 can target it explicitly, with rights, cost cap and review.
7. **Service versus software.** SocialEdge sells a staffed service with a client portal (SE-017). G2 should decide whether MaexSocial is self-serve software, a managed service, or both, because that changes autonomy, support and budget design.

## 8. Limitations and next checks

- At R1/R2, app evidence was static or anonymous-runtime and C-S6 was blocked pending access and action scope. R3 adds 14 UI evidence records from a read-only walkthrough of one package-2 account; authenticated REA runtime capture and external provider results remain unverified (section 9.6).
- Vendor claims (pricing, terms, privacy policy) describe intent and contracts, not verified operation.
- Shared-source corroboration: SE-005 and SE-007 rest on the same layout chunk in both lanes.
- Proposed at R2 (see section 9 for subsequent coverage and remaining gaps): (a) read-only walkthrough of a free account for SE-022 and plan gating; (b) paid-tier read-only view of posts and reviews for SE-024–SE-026; (c) ask SocialEdge or observe a post sync to settle SE-027 versus SE-024.

## 9. Runtime addendum R3 — authenticated read-only walkthrough (C-S6)

### 9.1 Access, tools and boundaries

| Item | Value |
|---|---|
| Window | 2026-11-04T23:50Z – 2026-11-05T00:07Z UTC |
| Account | Maxi's own SocialEdge customer account with one business location. The billing page shows package 2 "Dein 24/7 Vertriebsmitarbeiter" as active (CE-110) |
| Sign-in | Maxi signed in himself in the Claude-in-Chrome tab. No password, cookie or token was read, stored or exported |
| Tool | Claude in Chrome: accessibility tree, page text, DOM reads, network URL/status listing. Evidence class **UI**. Screenshots worked before the dashboard map rendered and then timed out |
| REA | Not connected. Maxi's Chrome had no process with `--remote-debugging-port` and no CDP endpoint on 9222, 9223, 9229 or 9333. A REA connect session needs Chrome's remote-debugging permission for that profile or a separate profile with a debugging port. Neither was changed |
| Actions taken | Navigation, expanding activity rows, post rows and review rows, opening and closing the avatar menu |
| Not taken | Approve/reject, auto-approve toggles, saving settings, chat, upload, adding a location, subscription portal, language switch, sign-out |
| Side effects | Each full page load triggers the app's own `POST /api/auth/session`, `POST /api/create-admin-welcome-message` and Firestore write channels (CE-114). These are application behavior on load, not user actions |

The private observation log with business, post, review and account-holder content stays in ignored `work/rea-claude/cs6/notes.md` (manifest CE-101–CE-114). Only sanitized findings follow.

### 9.2 Coverage

| Scenario | Route / function | Role / tier | Steps | Observation | Evidence | State | Reason |
|---|---|---|---|---|---|---|---|
| C-S6.01 | `/de/sign-in` | Anonymous | Read form | Email, password, remember-me, reset link, register link. No SSO | CE-101 | checked | — |
| C-S6.02 | `/de/sign-up` | Anonymous | Read form, no submit | Name, email, password (≥6), mandatory B2B and AGB/privacy/DPA consent, optional marketing consent | CE-101 | checked | — |
| C-S6.03 | `/de/reset-password` | Anonymous | Read form, no submit | Email field, "send link" | CE-101 | checked | — |
| C-S6.04 | Navigation and header | Customer, P2 | Read tree, open avatar menu | Nine navigation items; single location chip; add-location button; language switch; avatar menu with name, email and sign-out only | CE-102, CE-113 | checked | Add location and language switch not clicked |
| C-S6.05 | `/de/dashboard` | Customer, P2 | Read, expand activity rows | Average rank with date and trend; empty notifications; 16 activity checklists with operator notes; Local Dominator heat-map card | CE-103 | checked | Heat-map internals partly unreadable (third-party iframe) |
| C-S6.06 | `/de/dashboard/analytics` | Customer, P2 | Load page | The whole page is an embedded Local Dominator client dashboard | CE-105 | blocked | Cross-origin iframe unreadable; screenshots time out |
| C-S6.07 | `/de/dashboard/history` | Customer, P2 | Read | Rank change since first scan, review and post deltas, embedded scan history | CE-104 | checked | Scan list inside iframe not read |
| C-S6.08 | `/de/dashboard/posts` | Customer, P2 | Read list, expand two rows | 23 posts: 18 "Live", 5 "Genehmigt", none pending or rejected; auto-accept toggle; details show text, three images, creation date; no row actions | CE-106 | checked | Toggle state not determinable; approve/reject flow not reachable (no pending items, not authorized) |
| C-S6.09 | `/de/dashboard/reviews` | Customer, P2 | Read, expand list and one review | Rating and count; no open reviews; auto-approve shown as active; list of 14 reviews with owner replies, all "Live" | CE-107 | checked | No paging or filter observed for the remaining reviews |
| C-S6.10 | `/de/dashboard/support` | Customer, P2 | Read controls | Chat with a named contact, file attachment, message box | CE-108 | checked | Sending and upload not authorized |
| C-S6.11 | `/de/dashboard/library` | Customer, P2 | Read | Four SocialEdge videos | CE-109 | checked | — |
| C-S6.12 | `/de/dashboard/billing` | Customer, P2 | Read | Active package 2, invoices "N/A", monthly/yearly switch, plan cards, P3 waitlist | CE-110 | checked | Subscription portal not opened |
| C-S6.13 | `/de/dashboard/settings` | Customer, P2 | Read labels and states | User data, billing address, company data (Maps link and name read-only), password, six email notification toggles | CE-111 | checked | Nothing saved |
| C-S6.14 | `/de/dashboard/academy` | Customer, P2 | Direct URL | "No access to the Academy, contact support" | CE-112 | checked | — |
| C-S6.15 | `/de/dashboard/fundament`, `/de/dashboard/rechner` | Customer, P2 | Direct URL | Redirect to the dashboard | CE-112 | checked | Foundation onboarding not reachable for this account |
| C-S6.16 | Google publication result | Customer, P2 | — | Not observable in the app | — | blocked | Needs the public Google profile or provider data, outside the declared target |
| C-S6.17 | Team, integrations, account linking | Customer, P2 | Searched navigation and settings | No team, invitation or integration screens offered | CE-102, CE-111 | checked | Absence holds for this account only |

### 9.3 Runtime status of earlier claims

"Offered" means visible in this account's UI. "Observed" means a state or result was seen at runtime. "Static only" means still inferred from client code.

| Claim | Runtime result | Evidence |
|---|---|---|
| SE-005, SE-006 navigation | Observed for P2: seven main and two account items. Academy, foundation and calculator are absent from navigation; academy is blocked, foundation and calculator redirect | CE-102, CE-112 |
| SE-008 pending badges | Offered; nothing pending at capture | CE-106, CE-107 |
| SE-021 anonymous redirect | Not re-observed in R3; the R1 runtime observation stands. CE-101 is anonymous form inspection only | CE-011 |
| SE-022 self-registration | Offered (form only, not submitted) | CE-101 |
| SE-023 post states and auto-approve | Observed "Live" and "Genehmigt" states and the auto-accept toggle. Pending and rejected flows static only | CE-106 |
| SE-024 twelve Google sync states and `/api/posts/gbp` | Static only. No sync label appeared on 23 posts and no call to `/api/posts/gbp` occurred on load | CE-106, CE-114 |
| SE-025 time-based "published" | Unverified. "Live" posts carry no provider confirmation in the UI; their presence on Google was not checked | CE-106 |
| SE-026 review approval | Observed: auto-approve active, replies shown as "Live". Manual approve/reject static only | CE-107 |
| SE-027 manager access | Unverified in the app; no Google connection screen offered to this account | CE-111 |
| SE-028 Local Dominator | Observed: dashboard heat map, history and analytics are embedded Local Dominator views | CE-103, CE-104, CE-105 |
| SE-029 foundation onboarding | Not reachable for this account (redirect) | CE-112 |
| SE-030 prices | Observed P1 at 300 €/month on the billing page; this account holds P2 | CE-110 |
| SE-032 CRM or follow-up UI | Not offered in this P2 account | CE-102 |

### 9.4 New runtime claims

| Claim ID and exact claim | Codex evidence | Independent Claude evidence | Result | Source dates and scope | Unknowns and next check |
|---|---|---|---|---|---|
| SE-033 The dashboard shows 16 operator activity checklists with per-item open/active state and free-text notes | Absent | CE-103 | extend | 2026-11-05, P2 account, UI | Who updates them and how often |
| SE-034 The posts view shows only app states ("Live", "Genehmigt"), no Google publication state | Absent | CE-106 | extend | 2026-11-05, P2, UI | Compare with the public Google profile |
| SE-035 Posts are scheduled every four days, matching "8 posts per month" in the activity checklist | Absent | CE-103, CE-106 | extend | 2026-11-05, P2, UI | — |
| SE-036 Sampled generated posts assert concrete business facts and target nearby towns | Absent | CE-106 | extend | 2026-11-05, P2, two posts sampled | Source of those facts |
| SE-037 Review reply auto-approval is active for this account and replies appear with status "Live" | Absent | CE-107 | extend | 2026-11-05, P2, UI | Whether replies are on Google |
| SE-038 The review list shows 14 of 429 reviews with no paging, filter or search | Absent | CE-107 | extend | 2026-11-05, P2, UI | Whether older reviews are reachable elsewhere |
| SE-039 Analytics and scan history are embedded third-party (Local Dominator) dashboards | Absent | CE-104, CE-105 | extend | 2026-11-05, P2, UI | Content of the embedded analytics |
| SE-040 Academy access is not included in this P2 account although the P2 offer lists guides and courses | Absent | CE-112, CE-002 | extend | 2026-11-05 runtime vs 2026-11-04 public page | Ask SocialEdge whether access is granted manually |
| SE-041 Every full page load posts to `/api/create-admin-welcome-message` and `/api/auth/session` | Absent | CE-114 | extend | 2026-11-05, P2, network URLs only | Server effect unknown |
| SE-042 No team, invitation or integration management is offered to the customer | Absent | CE-102, CE-111 | extend | 2026-11-05, P2, UI | Other tiers unknown |

### 9.5 Additional MaexSocial proposals (not evidence)

1. Show provider publication state next to the approval state. SocialEdge's "Live" carries no visible Google confirmation (SE-034).
2. Trace every factual sentence in a generated post to an approved fact, because sampled posts assert facts the customer must vouch for (SE-036).
3. Keep auto-approval opt-in and auditable per channel. Here it was active for review replies (SE-037).
4. Make all reviews reachable with paging and filters (SE-038).
5. Keep reads free of server writes, or make page-load writes idempotent and auditable (SE-041).
6. Plan team roles and integration screens explicitly. SocialEdge offered none in the inspected package-2 account (SE-042; other tiers unobserved), while MaexSocial's access requirements need them.

### 9.6 Remaining gaps after R3

- Embedded Local Dominator analytics content (C-S6.06). A manual screenshot from Maxi or a working screenshot path would close it.
- Whether "Live" posts and replies exist on Google (C-S6.16). This needs a comparison with the public Google Business Profile, outside the declared target.
- Approve/reject, auto-approve changes, chat, upload, adding a location and the subscription portal were not authorized; no pending items existed.
- REA runtime evidence for the authenticated app needs a CDP-enabled browser session. All R3 evidence is UI class.
- Findings cover one P2 account with one location. Free, P1 and P3 tiers were not observed.
