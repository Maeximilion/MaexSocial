# SocialEdge discovery by Codex

Captured on 2026-11-04. This is a bounded public-source baseline for the independent Claude Code investigation and later joint synthesis.

## Scope and method

The target was https://app.socialedge.ai/de/dashboard, with public marketing context from https://www.socialedge.ai/ and https://www.socialedge.ai/preise. Unauthenticated HTTP GET requests returned status 200 for all three pages. The dashboard served a Next.js application shell and linked JavaScript. A previous failure to open this URL through the web tool therefore does not establish that the public shell is inaccessible.

REA 6.8.0 analyzed the language layout, dashboard layout and dashboard page chunks as inert text. The selected files totalled 86,823 bytes. Eleven JavaScript files were inventoried, three were analyzed, and eight remained outside the selected scope. The HTML referenced 19 scripts, so the downloaded inventory is also a subset of all delivered dependencies. No target JavaScript was executed. No authenticated account, private API, publishing operation or paid generation was used.

## Evidence

- Complete analysis ID `ev_ff44c65c3adf03d7f1fc5fb91c22dad13379a8af78c1f6bbb4d2bed957c4849f`.
- Summary ID `ev_005dbec9407e50c2e721c34a58861b49675cf0fbd3bd509b429d4fcf2611853e`.
- Captured artifact SHA-256 `d84fbfeddaaefd1753d83dce2678334586bb69834fb477af5561901640889de5`.
- The sanitized [evidence manifest](evidence-codex.json) contains source URLs, individual file hashes, selected paths, statistics, route candidates and coverage limits.
- Raw captures and the complete evidence bundle are local in `work/rea-codex/`, excluded from version control. Raw evidence is about 18.7 MB and contains third-party source projections.

REA reported three successfully parsed JavaScript files, zero parse failures, 179 findings and 15 modules. Both application and semantic graph coverage are partial. There are 8 application unknowns and 3,221 semantic unknowns. The summary's `complete-within-view` describes only the returned summary projection and must not be interpreted as complete application coverage.

## Observed static facts

The dashboard layout contains navigation strings for analytics, billing, history, a media library, posts, reviews, settings and support. It also contains strings for academy, fundament and rechner. REA's route inventory recovers candidates including `/dashboard/posts`, `/dashboard/reviews`, `/dashboard/analytics`, `/dashboard/library` and `/dashboard/history`.

The shipped source contains pending-post and pending-review labels, a `googleAccess` identifier, and dashboard activity and ranking-scan text. These are observations of source content. They do not prove a user's permissions, successful requests, working publication, accurate rankings or automated backend execution.

The `/_next/static/chunks/` paths and bundled client code support the inference that the public client is built with Next.js. The internal database, job system, AI providers and hosting architecture remain unknown.

## Marketed capabilities

SocialEdge publicly offers local Google customer acquisition through managed profile optimization, posting, review management, visibility monitoring, directory synchronization and reporting. Higher packages add media collection, customer follow-ups, CRM support and on-site photo/video services. These are vendor claims about a mix of software and managed delivery. They require individual verification before being treated as autonomous software features. [Homepage](https://www.socialedge.ai/) · [Packages](https://www.socialedge.ai/preise)

The media offering includes collecting business material and producing content on site. The public wording alone does not establish an autonomous image-to-ad-video generation API or autonomous management across every social platform. These remain distinct MaexSocial requirements to validate.

## Implications for the next investigation

| Question | Current evidence | Next check |
| --- | --- | --- |
| What does the dashboard organize? | Static navigation and labels | Authorized runtime walkthrough of each module |
| How do post approvals and publication work? | Posts and pending-post labels | Observe draft, review, scheduling and result states in a permitted test account |
| How are reviews answered? | Review navigation and pending-review labels | Document generation, approval, publication and failure behavior |
| What Google data is used? | Google access label and ranking text | Observe authorized requests and compare documented provider APIs |
| Is social/video automation included? | Marketing text and separate user requirement | Verify each platform and media operation independently |
| Which backend is used? | Unknown | Retain as unknown unless authorized observable evidence establishes it |

Authenticated workflows need an owner-provided session and a defined non-destructive test scope. A dashboard label must not be promoted to a verified feature. Do not probe hidden endpoints or replay captured writes to fill these gaps.

## Candidates for the remembered video demo

The exact TikTok advertisement remains unidentified. The following official vendor demonstrations match parts of the description and provide leads for the later provider evaluation.

- Luma documents making product clips from a single product photo through Claude, including still cleanup and motion variants. This is a close functional match, with no evidence tying it to the user's remembered clip. [Luma product clip](https://luma.ai/mcp/product-clip)
- Runway demonstrates MCP-driven marketing videos and character-led product advertisements through compatible assistants. [Runway MCP](https://runway.com/mcp)
- Kling documents a Claude/MCP fashion workflow that starts with product photos and builds video variations. [Kling tutorial](https://kling.ai/blog/claude-kling-mcp-fashion-video-workflow)

These pages were found through web search on 2026-11-04. Connector compatibility, pricing, rights and output quality have not been tested. No connector was installed or authorized.

## Handover result

Codex public static discovery is complete within the stated scope. Full SocialEdge parity and authenticated behavior remain open. Claude Code should produce its own evidence-backed report, then compare findings against this baseline. The synthesis must resolve disagreements and explicitly retain inaccessible behavior as unknown before a product architecture is approved.
