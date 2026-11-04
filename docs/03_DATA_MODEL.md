# Data concepts for design

Status — conceptual model for G2. Tables and storage technology are not yet selected.

| Concept | Required meaning |
|---|---|
| Workspace | Ownership and isolation boundary |
| Brand profile | Approved business facts, voice, locale and revisions |
| Connected account | Platform identity, workspace, scopes and credential reference |
| Source asset | Original owner, usage permission, content hash and retention policy |
| Content revision | Brief, generated result, source assets, model/provider provenance |
| Authorization | Approver or approved autonomous policy, scope, revision and expiry |
| Publication intent | Account, revision, scheduled time, deduplication identity and state |
| Provider attempt | Request identity, external job/post ID, timing, error and reconciliation |
| Media job | Input revision, render parameters, cost reservation and output assets |
| Audit event | Actor, workspace, action, policy version, time and result |

## Invariants to test in MS-010 through MS-012

Content edits invalidate approval for the previous revision. A publication intent references an immutable revision. Account reassignment cannot transfer authority across tenants. Store times with an absolute time reference and retain the scheduling timezone. Represent money using exact units appropriate to the provider's pricing, never binary floating point. Credential references must not contain secret values.

An external timeout leaves the outcome unknown until reconciliation. Retry logic must distinguish a rejected request from an accepted request whose response was lost. Deletion of a source asset must account for derived assets and legal retention decisions. The G2 schema specifies state transitions, uniqueness constraints, retention and migration verification for the first slice.
