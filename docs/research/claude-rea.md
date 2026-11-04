# MS-004 Claude Code REA report — SocialEdge

**Lane** — Independent Claude Code research for [issue #4](https://github.com/Maeximilion/MaexSocial/issues/4). **Plan** — [investigation plan](../superpowers/plans/2026-11-05-ms-004-claude-rea.md). **Manifest** — [evidence-claude.json](evidence-claude.json).

**Report revisions**

| Revision | Date (UTC) | Content |
|---|---|---|
| R1 — independent checkpoint | 2026-11-04T23:34:59Z, commit `35c61ac` | Sections 1–5. Written before the Codex report or manifest was read |
| R1a — own evidence addendum | 2026-11-04T23:40Z | CE-028 REA route analysis completed after the freeze, still before reading the Codex lane |

## 1. Method, scope and access

| Item | Value |
|---|---|
| Targets | `https://www.socialedge.ai/` (public site, sitemap pages) and `https://app.socialedge.ai/de/dashboard` (customer app) |
| Capture window | 2026-11-04T23:22Z–23:40Z UTC (2026-11-05 CET) |
| Access tier | Anonymous visitor. No account, cookie or session. No sign-up, login, form submission or chat |
| Tools | REA 6.8.0 MCP (`capture_browser_scenario`, `list_browser_targets`, `analyze_web_bundle`), REA 6.8.0 CLI, headless Chrome 156.0.8078.80 in temporary profiles, `curl` GET, local Python text extraction |
| Raw data | Ignored `work/rea-claude/`. Only hashes and sanitized observations are committed |

Evidence classes used below: **VC** vendor claim (public marketing/legal text), **RT** runtime observation, **ST** static artifact observation of client JavaScript served to an anonymous visitor, **INF** labelled inference, **UNK** unknown.

Static bundle method. The dashboard HTML shell is served with HTTP 200 to anonymous visitors and lists its route chunks. The dashboard layout chunk names eleven sub-routes. Each sub-route's public HTML shell was fetched once and its chunk list collected. 36 JavaScript files were retained for local, non-executing analysis. REA's passive `analyze_web_bundle` saw only five scripts before the client redirect, so the downloaded chunk set is the primary static source. A REA MCP `analyze_javascript_application` call on that set exceeded the host tool deadline. It was not repeated unchanged. The CLI fallback on all chunks hit REA's per-source deadline on a React vendor chunk. A CLI run on the 15 route chunks completed (CE-028) and independently lists the eleven dashboard sub-routes, sign-in, billing and two PDF downloads as static route candidates.

## 2. Exposure disclosure

Before planning, `docs/01_STATUS.md` was read as required by repository rules. It states that Codex analyzed three selected client chunks with REA 6.8.0 and that its report contains candidate demos. No Codex report body or manifest content was read before this checkpoint revision was committed.

## 3. Independent findings

### 3.1 Product offer

- **VC** SocialEdge presents itself as a done-for-you local visibility service for Google Business Profiles, explicitly "more than software". The team plans, writes and implements; the customer reviews in a "Performance Hub" (CE-001, CE-002).
- **VC** Three annual packages: P1 "Marketing-Assistent" 300 €/month net (3,600 €/year, 12 months), P2 "24/7 Vertriebsmitarbeiter" 450 €/month (5,400 €/year, 16 months under BAFA variant), P3 "Marketing- & Operations-Abteilung" 1,500 €/month (18,000 €/year, marked sold out, waitlist). Enterprise custom AI automation on request (CE-002). The app's billing chunk carries the same three plans plus a free plan (CE-019).
- **VC** Package scope as described: P1 profile optimization, posts, photos, competitor/keyword analysis, ranking dashboard, guides, monthly view, named contact. P2 adds AI-assistant visibility (ChatGPT, Claude, Gemini), listings on 50+ platforms, media intake via WhatsApp or Google Drive, review responses, automated follow-up/reminders, 5-minute video report. P3 adds an on-site photo/video shoot, local PR, win-back campaigns, CRM build, workflow automation, monthly call and annual plan (CE-002).
- **VC** Commercial terms: 12-month growth guarantee on the sum of call, website-click and direction-request metrics from the Google profile, otherwise up to 12 months of extra service. One customer per industry and region. BAFA consulting subsidy is used as a sales channel (CE-002, CE-004 Part 5–6).
- **VC** Human operation is central: personal contact, support chat, WhatsApp voice messages, video reports, monthly calls (CE-001, CE-002, CE-004 §3.11).
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
