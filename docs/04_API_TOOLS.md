# API and MCP feasibility

MS-005 produces a sourced matrix before provider selection. For every proposed capability record platform, official documentation URL, observation date, supported operation, account type, scopes, app-review requirement, rate limits, price and unresolved restriction.

## Initial capability groups

| Group | Questions to prove |
|---|---|
| Google business profile | Which profile fields, posts, media, reviews and metrics can be read or changed through approved APIs? |
| Social publication | Which formats and account types support scheduling or direct publication? Who performs scheduling? |
| Reputation | Which review responses and notification workflows are supported? |
| Analytics | Which metrics are available, over which periods, with what delay and attribution limits? |
| Media generation | Image-to-video inputs, output formats, rights, job polling/webhooks and cancellation |
| Optional paid advertising | Separate ad-account authority, app review, eligible audiences, paused versus active campaigns, budgets, reporting delays and stopping |
| MCP integrations | Maintainer, authentication boundary, exposed operations, version and availability guarantees |

## Side-effect contract required at G2

The [customer media-library proposal](18_MEDIA_LIBRARY.md) includes a bounded official-source check for Higgsfield, Runway and Meta. It is an input to MS-005, not its completed feasibility matrix. Verify website/API parity, private input/output lifecycle, commercial embedding terms, selected-model pricing, account/format eligibility and the separate publishing/advertising permissions before provider selection.

Every write operation specifies input validation, workspace/account authorization, policy decision, revision identity, idempotency behavior, timeout handling, external result identity, retry classification and audit fields. Read operations specify data scope, pagination and freshness. Webhooks require authenticity checks and replay handling.

The existence of an MCP server does not establish permission to publish or spend money. Provider documentation and an authorized test must establish the actual operation. The first implementation contract belongs to MS-009 and must include concrete request/response schemas and error cases for the selected channel.
