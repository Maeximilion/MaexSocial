# MS-004 Claude Code REA report — SocialEdge

**Lane** — Independent Claude Code research for [issue #4](https://github.com/Maeximilion/MaexSocial/issues/4). **Plan** — [investigation plan](../superpowers/plans/2026-11-05-ms-004-claude-rea.md). **Manifest** — [evidence-claude.json](evidence-claude.json).

**Report revisions**

| Revision | Date (UTC) | Content |
|---|---|---|
| R1 — independent checkpoint | 2026-11-04T23:34:59Z, commit `35c61ac` | Sections 1–5. Written before the Codex report or manifest was read |
| R1a — own evidence addendum | 2026-11-04T23:40Z | CE-028 REA route analysis completed after the freeze, still before reading the Codex lane |
| R2 — comparison | 2026-11-04T23:50Z | Sections 6–8 after reading the Codex report and manifest |

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

Before planning, `docs/01_STATUS.md` was read as required by repository rules. It states that Codex analyzed three selected client chunks with REA 6.8.0 and that its report contains candidate demos. No Codex report body or manifest content was read before this checkpoint revision was committed.

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

- **ST** Approved posts are synchronized to Google through `/api/posts/gbp` with actions `sync`, `delete` and per-user `enable`/`disable`. The client retries a partial sync up to five times at 60-second intervals (CE-015).
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

- Authenticated UI and runtime behavior (C-S6) were not observed. All app statements above are static candidates; reachability, permissions and server logic are unverified.
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

C-S6 requires Maxi to provide a SocialEdge account session (free tier at minimum, paid tier for posts, reviews and analytics) and an explicit action scope. Read-only navigation is the proposed default. Approving, rejecting, toggling auto-approval, uploading, chatting or purchasing each needs separate permission because they notify staff or change account state.

## 6. Comparison with the Codex lane (Phase B)

Phase B started after commits `35c61ac` and `13ccff8`. Sources: [Codex report](codex-rea.md) and [Codex manifest](evidence-codex.json), both unchanged by this lane. Codex sections are cited as SM (Scope and method), EV (Evidence), OSF (Observed static facts), MC (Marketed capabilities), VD (video-demo candidates). Codex evidence is `ev_ff44c65c…` (complete analysis) with capture hashes from its manifest.

**Version alignment.** Both lanes captured on 2026-11-04 UTC. Byte-identical SHA-256 values for the dashboard shell (`5bafea14…`), homepage (`b477a09b…`), pricing page (`b14a1f97…`), language layout (`8f7f25b6…`), dashboard layout (`518093de…`) and dashboard page (`465ab7d8…`) show the same deployed versions. REA route IDs for the eleven dashboard routes are identical in both lanes because the same layout chunk was analyzed. Agreement on those routes is therefore same-source corroboration produced by separate runs, not independent sources.

| Claim ID and exact claim | Codex evidence | Independent Claude evidence | Result | Source dates and scope | Unknowns and next check |
|---|---|---|---|---|---|
| SE-001 An anonymous GET of `/de/dashboard` returns HTTP 200 with a Next.js application shell | SM; manifest capture `app`, `5bafea14…` | CE-010 identical hash; CE-011 runtime load | confirm | Both 2026-11-04, anonymous, HTTP + Claude runtime | None for anonymous scope |
| SE-002 The public homepage and pricing page return HTTP 200 | SM; captures `home` `b477a09b…`, `pricing` `b14a1f97…` | CE-001, CE-002 identical hashes | confirm | Both 2026-11-04, anonymous HTTP | None |
| SE-003 The dashboard HTML references 19 scripts | SM | CE-010: 19 `script src` tags | confirm | Both 2026-11-04, static HTML | None |
| SE-004 The client app is built with Next.js | OSF (inference from `/_next/` paths) | CE-010 shell markup, CE-013 Next.js App Router chunk layout, CE-003 states Vercel hosting | confirm | Static + vendor claim | Framework version unknown |
| SE-005 The dashboard layout holds navigation for analytics, billing, history, media library, posts, reviews, settings and support | OSF; `518093de…` | CE-014 same chunk, separately parsed; CE-028 route candidates | confirm | Same chunk, separate runs | Reachability per plan needs C-S6 |
| SE-006 The layout also references academy, fundament and rechner | OSF | CE-014; CE-028 lists `/dashboard/fundament`, `/dashboard/rechner`; CE-025 academy page chunk | extend | Static | Claude adds: academy and analytics are plan-gated, foundation and calculator appear conditionally (CE-014, CE-021) |
| SE-007 REA recovers eleven `/dashboard` route candidates | OSF; manifest `route_candidates` | CE-028 (15 candidates incl. same eleven) | confirm | Separate REA runs, overlapping sources | Server-only routes unknown |
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
| SE-024 Approved posts sync to Google via `/api/posts/gbp` with twelve displayed states and client retry | Absent | CE-015 | extend | Static | Server write path, idempotency |
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

- All app behavior is static or anonymous-runtime evidence. C-S6 remains blocked pending access and action scope.
- Vendor claims (pricing, terms, privacy policy) describe intent and contracts, not verified operation.
- Shared-source corroboration: SE-005 and SE-007 rest on the same layout chunk in both lanes.
- Smallest next checks: (a) read-only walkthrough of a free account for SE-022 and plan gating; (b) paid-tier read-only view of posts and reviews for SE-024–SE-026; (c) ask SocialEdge or observe a post sync to settle SE-027 versus SE-024.
