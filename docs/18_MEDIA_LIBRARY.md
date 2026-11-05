# Customer media library, calendar and optional advertising

Status — Requested product direction, recorded 2026-11-05 in [planning issue #40](https://github.com/Maeximilion/MaexSocial/issues/40). The workflow and safeguards below are proposals for G2. No application, provider integration, posting authority or advertising budget is approved or implemented by this document.

## Customer request and evidence boundary

Maxi wants the customer dashboard's library to hold the customer's own images and videos, support AI-assisted media production through providers such as Higgsfield or Runway, and feed planned and recurring social posts or Stories. Customers should also be able to request advertising for their intended audience. “Runaway” is interpreted as Runway unless corrected.

Maxi contrasted this with explanatory/promotional videos in [SocialEdge's library](https://app.socialedge.ai/de/dashboard/library). That description is an owner observation, not an independently verified finding here: the public web-tool request could not access the page. The existing Codex report establishes a library navigation route, not its authenticated behavior. Keep this MaexSocial proposal separate from the REA evidence lanes.

## Proposed customer journey

1. **Media library:** upload customer images and videos into a private workspace. Show the original, preview, usage permission, processing state and related generated versions. Files belong to the customer's workspace; a platform administrator's access requires its separate authority and audit trail.
2. **Create:** choose source assets, a business offer, the intended audience and destination formats. Request a caption, visual variation or video. Show estimated generation cost and obtain the required authority before starting a paid job. Store originals and generated versions separately, retaining source/model/job provenance.
3. **Review:** preview the actual text, crop, video and account for each destination. Show missing facts and unsupported formats. Approve an immutable content revision, or use a separately enabled bounded-autonomy policy. Uploading a file does not authorize its publication.
4. **Calendar:** select dates, local timezone and recurrence. Display whether each occurrence creates a draft or may publish under an approved policy. A weekly plan can generate new content from selected assets; it must not silently repost the same item or spend money on new renders without authority.
5. **Publish and learn:** submit through supported platform APIs and show the provider-confirmed result. Distinguish scheduled, submitting, published, rejected and outcome-unknown states per destination. Reconcile uncertain outcomes before retrying; one successful channel must not hide another channel's failure.
6. **Optional campaigns:** create an advertising proposal from selected content. The customer reviews the ad account, objective, creative revision, destination, supported audience settings, dates and budget before activation. Ordinary posting recurrence never implies recurring advertising spend.

Suggested dashboard areas are **Media library**, **Create**, **Calendar** and **Campaigns**. These names and the layout are proposals; accessible interaction design and component states belong to G2. The owner-selected Deep Tech palette remains the visual direction.

Example: a local business uploads three product photos, requests two weekly social drafts and one short video, reviews the variants and places approved content in the calendar. An optional local advertising proposal has its own audience, budget and activation approval. This is a target scenario, not a claim that every format or channel is already supported.

## Delivery approaches for G2

| Approach | Benefit | Trade-off |
|---|---|---|
| Export to Meta Business Suite for manual scheduling | Small initial integration surface; customer uses Meta's interface | Separate workflow; does not deliver MaexSocial's autonomous calendar |
| MaexSocial library/calendar with official publishing APIs | One customer workflow and explicit approval/retry controls | Requires account eligibility, permissions, app review and durable scheduling |
| Third-party publishing service behind the same customer workflow | May cover additional channels through one vendor | Adds vendor cost, data processing and another capability/availability boundary |

Recommendation for G2: own the library and calendar, start with one eligible Meta destination and one media-generation provider, then expand after a verified vertical slice. Meta Business Suite is a user interface, not the backend contract for this design. A third-party service remains a candidate only if it proves a needed capability. MCP may provide a tool interface, but does not replace the provider API contract, durable job handling or customer authorization.

## Public API evidence — bounded check on 2026-11-05

These are documented capabilities and constraints, not successful live integration tests. MS-005 still owns the complete feasibility matrix, including selected versions, permissions, reviews, quotas, costs, terms and account-specific verification.

| Area | Supported planning conclusion | Primary source / remaining verification |
|---|---|---|
| Runway media API | Documented image-to-video and model-specific editing operations return asynchronous tasks. Inputs can use supported uploads/retrievable assets; output URLs are temporary and must be copied into application storage | [API workflow](https://docs.dev.runwayml.com/guides/using-the-api/), [API reference](https://docs.dev.runwayml.com/api/), [input uploads](https://docs.dev.runwayml.com/assets/uploads/), [output lifecycle](https://docs.dev.runwayml.com/assets/outputs/). Account access, chosen model, costs, quality and deletion remain untested |
| Higgsfield media API | A separate developer API exposes model-specific generation, polling and optional webhooks. Documented uploads yield a `public_url`; that is not a tenant-private asset store. Finished request data has a retention/deletion lifecycle | [API introduction](https://higgsfield.ai/creator-hub/help-center/integrations/what-is-the-higgsfield-api), [uploads](https://docs.higgsfield.ai/docs/concepts/file-uploads), [request lifecycle](https://docs.higgsfield.ai/docs/concepts/requests), [retention](https://docs.higgsfield.ai/docs/enterprise/data-retention). Verify selected-model capabilities and customer-data handling before use |
| Meta Business Suite | Meta provides its own Facebook/Instagram management interface; UI features do not prove API parity | [Meta introduction](https://about.fb.com/news/2020/09/a-faster-and-easier-way-to-manage-your-business-on-facebook-and-instagram/) |
| Instagram publishing | Professional accounts are supported. The Facebook Login route requires a linked Page; its Stories publication is limited to business accounts. Reels use a create/upload, status-check and publish sequence | [Meta-maintained Instagram documentation](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api). Verify the chosen login route, format and account; do not promise native stickers/music or every Story feature |
| Facebook publishing | Page authority and a Page token are required in the documented flow. The Reel workflow exposes draft/scheduled/published states | [Meta-maintained Facebook documentation](https://www.postman.com/meta/facebook/documentation/r56bjfd/facebook-api). This does not establish personal-profile support or Facebook Story support |
| Calendar and recurrence | MaexSocial should own recurrence and intent state, dispatching supported provider operations at suitable times | Design inference from the Instagram/Facebook workflows. Verify exact scheduling windows, media-container lifetime, limits and available formats in MS-005 |
| Advertising | Instagram Login is not an ads API. Marketing API access is separate; managing other people's ad accounts requires the relevant Advanced Access. Paused campaign creation and activation are distinct operations | [Instagram Login](https://www.postman.com/meta/instagram/folder/1z5vxzu/instagram-api-with-instagram-login), [Marketing API requirements](https://www.postman.com/meta/facebook-marketing-api/collection/0zr4mes/facebook-marketing-api-mapi), [campaign examples](https://www.postman.com/meta/facebook-marketing-api/documentation/0zr4mes/facebook-marketing-api-mapi) |

The Postman material is published by [Meta's verified team](https://www.postman.com/meta). Direct Meta developer pages returned access/rate-limit barriers during this check. Current App Review/business-verification details, Facebook Story publishing, exact Page-post scheduling windows and a complete permission dependency tree remain verification items. No account was connected and no generation, publication, ad creation or spend occurred.

Keep both media providers as candidates; the check does not establish a quality winner or website/API feature parity. Verify current API billing independently of consumer subscriptions. For commercial embedding, review the actual MaexSocial offer against provider terms, including Higgsfield's distinction between applications adding material functionality and restricted standalone resale. Sources: [Runway API FAQ](https://help.runwayml.com/hc/en-us/articles/50683115755155-Runway-API-FAQs), [Higgsfield API terms](https://open.higgsfield.ai/terms-of-service). Processing region, retention/deletion, data-use settings and the selected model's price remain G2/provider-spike decisions.

## Contracts to settle before implementation

[MS-014 / #43](https://github.com/Maeximilion/MaexSocial/issues/43) expands file validation into the [upload-security contract](security/uploads.md), including initial customer SVG/SVGZ rejection, quarantine, isolated bounded processing, safe delivery and UPLOAD-01–10. These proposed cases supplement MEDIA-01–04; no runtime upload control is implemented yet.

- **Private assets:** enforce tenant access on originals, thumbnails, downloads and derived media. Validate file content/type, size, duration and workspace quota; quarantine invalid or unsafe uploads. Define rights/consent, retention, deletion and treatment of embedded metadata. Keep storage credentials and provider keys server-side. Deleting an asset must account for dependent drafts, scheduled items and retained provenance.
- **Provider handoff:** disclose the selected processor and purpose. Give only the minimum required input through a scoped, time-limited retrieval mechanism where supported. A public provider upload URL is not a tenant access policy. Verify expiry, deletion and revocation behavior before customer-media use; never forward arbitrary user URLs without retrieval controls.
- **Media jobs:** reserve the approved generation budget, track the external job identity, verify callback authenticity where supported, and reconcile duplicate callbacks or lost responses. Store successful outputs in authorized durable storage before provider links expire. Cancellation is a requested state until confirmed; it does not prove the provider stopped processing or billing.
- **Publishing:** separate the immutable creative revision, per-account publication intent and provider attempts. Revalidate account access, format support and current authority immediately before submission. Retain UTC time plus scheduling timezone; choose explicit daylight-saving, missed-run and catch-up behavior. A stopped schedule must not start new posts or renders.
- **Organic autonomy:** start with draft/approval behavior unless the customer explicitly enables a bounded policy covering accounts, assets, subjects, frequency, generation budget, expiry and stop controls. Content changes invalidate exact-revision approval. Scheduled generation, approved publication and autonomous publication are separate modes.
- **Advertising:** keep generation credits and ad spend separate. A draft or paused campaign must not imply permission to activate delivery. Freeze approved creative, account, objective, supported audience settings, dates and budget; changes require new approval unless a separately approved policy explicitly covers them. Validate audience options against current platform rules and the campaign's applicable category; do not promise exact audience delivery.
- **Spend and stopping:** enforce internal authorization/reservation limits before requests and apply supported platform budgets/limits. Monitor actual provider spend and delivery state. External reporting may lag, so a displayed internal cap must not be marketed as a guaranteed instantaneous spend ceiling. Pause/stop prevents new internal work and requests provider-side pausing; show in-flight or unconfirmed effects honestly.

Customer audience controls should explain the chosen region and available eligible audience settings, with an estimated audience only where the provider supplies one. Sensitive/special campaign categories can restrict options. [Meta's documented fairness changes](https://about.fb.com/news/2023/01/an-update-on-our-ads-fairness-efforts/) illustrate why unrestricted targeting cannot be assumed; MS-005 must verify the current rules for the intended market and category.

## Gate and task mapping

| Existing work package | Additional scope |
|---|---|
| MS-005 / issue #5 | Provider API versus website parity, private input/output lifecycle, pricing, commercial embedding rights, account/format support, publishing permissions and separate Marketing API access |
| MS-007 / issue #7 | Keep the owner-requested library/calendar/ads proposal distinct from observed SocialEdge capabilities; reconcile it with feasibility evidence |
| MS-008–009 / issues #8–9 | Approve the first customer workflow, provider/channel, costs, storage/retention, approval modes and proposed contracts; turn accepted cases below into executable tasks |
| MS-010 / issue #10 | Proposed first slice: private media upload → draft/review → one supported destination → schedule → confirmed result |
| MS-011 / issue #11 | Add one approved media-generation workflow, cost reservation, durable output capture and recovery |
| MS-012 / issue #12 | Verify recurring generation/publication and stop/reconciliation under an approved operating policy; optional paid-ad pilot requires its own authority and budget |
| MS-013 / issue #30 | Extend tenant/admin boundaries to originals, derived media, generation jobs, schedules, advertising credentials and audit records |

Paid advertising is a separate optional delivery package after G2 decides its priority. Creating these planning records does not approve unattended ads or expand the first slice to every social channel. The image-to-ad creative pipeline and paid distribution are different capabilities.

## Proposed acceptance cases — not executed

| ID | Scenario and required evidence |
|---|---|
| MEDIA-01 | A customer cannot read, replace or export another tenant's original, thumbnail, derivative or job through UI, direct URL or API |
| MEDIA-02 | Invalid file content, exceeded quota or missing required usage authority produces a clear rejection without starting a paid job |
| MEDIA-03 | A repeated job request/callback or an ambiguous provider response does not silently create a second billable generation; callback authenticity and tenant/job binding are checked |
| MEDIA-04 | Expiring provider output is captured into authorized storage with provenance; failed capture, cancellation, deletion and dependent scheduled content have visible, tested outcomes |
| PLAN-01 | Editing the approved revision or changing destination invalidates approval; the worker refuses an unauthorized revision |
| PLAN-02 | A recurrence across timezone/DST changes, worker restart and retry produces only the intended occurrences under the accepted catch-up policy |
| PLAN-03 | Unsupported account/format, revoked credentials and per-channel failure remain visible; uncertain submission is reconciled before retrying |
| PLAN-04 | Pause/revocation prevents new work and accurately distinguishes already submitted or unconfirmed provider operations |
| ADS-01 | Uploading, generating, scheduling or repeating organic content cannot create or activate paid delivery without separate authority |
| ADS-02 | Changing creative, account, objective, audience, dates or budget outside the approved policy blocks activation until authorized |
| ADS-03 | Concurrent requests respect internal spend reservations; platform budgets, delayed cost reports and pause failures are handled without claiming an unverified hard ceiling |
| ADS-04 | Missing ad-account permission, unsupported targeting or policy rejection cannot fall back to a broader audience or automatic spend |

## Open G2 decisions

Choose the first customer segment and eligible account, one generation provider/model, accepted upload/media formats, storage/processing region and retention, default recurrence/approval behavior, customer-visible cost model and whether paid advertising enters the initial roadmap or a later release. Use an explicitly authorized provider spike with a defined budget to verify the selected path. The current research does not settle those decisions.
