# Data concepts for design

Status — conceptual model for G2. Tables and storage technology are not yet selected.

| Concept | Required meaning |
|---|---|
| Workspace | Ownership and isolation boundary |
| User identity | Authentication subject and account lifecycle, with credential material protected by the selected identity system |
| Workspace membership | Identity, workspace, tenant role and revocation state |
| Platform authorization | Separately granted platform role and allowed administrative operations |
| Session | Identity, authentication assurance, lifetime and revocation reference |
| Verification/recovery challenge | Intended identity and purpose, protected token representation, expiry and single-use state |
| Brand profile | Approved business facts, voice, locale and revisions |
| Connected account | Platform identity, workspace, scopes and credential reference |
| Source asset | Original owner, usage permission, content hash and retention policy |
| Content revision | Brief, generated result, source assets, model/provider provenance |
| Authorization | Approver or approved autonomous policy, scope, revision and expiry |
| Publication intent | Account, revision, scheduled time, deduplication identity and state |
| Provider attempt | Request identity, external job/post ID, timing, error and reconciliation |
| Media job | Input revision, render parameters, cost reservation and output assets |
| Recurrence plan | Workspace, selected assets/accounts, timezone, occurrence policy and generation/publication authority |
| Advertising proposal | Ad account, objective, immutable creative revision, eligible audience settings, dates, budget and separate activation authority |
| Audit event | Actor, workspace, action, policy version, time and result |

Platform administration records the actual actor separately from the target customer. Membership, platform authority and session state cannot be widened by user-editable profile fields. A tenant role does not imply platform privileges. Public registration produces a customer identity with verified-email activation proposed before workspace access. Tenant identity must remain attached to jobs, derived media and exports. The selected design must define recovery/revocation and prevent credentials from appearing in customer/admin views or audit data. These are proposed contracts in [access and security](17_ACCESS_SECURITY.md).

## Invariants to test in MS-010 through MS-012

Content edits invalidate approval for the previous revision. A publication intent references an immutable revision. Account reassignment cannot transfer authority across tenants. Store times with an absolute time reference and retain the scheduling timezone. Represent money using exact units appropriate to the provider's pricing, never binary floating point. Credential references must not contain secret values.

An external timeout leaves the outcome unknown until reconciliation. Retry logic must distinguish a rejected request from an accepted request whose response was lost. Deletion of a source asset must account for derived assets and legal retention decisions. The G2 schema specifies state transitions, uniqueness constraints, retention and migration verification for the first slice.

The [media-library proposal](18_MEDIA_LIBRARY.md) adds customer-owned source/derived assets, recurring generation/publication and optional advertising. Generation cost and advertising spend need separate ledgers/limits in the accepted design. Recurrence produces individually traceable publication intents; it must not widen a customer's paid-ad authority.
