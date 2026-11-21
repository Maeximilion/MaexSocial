# Product AI decision for #167

**Decision requested from Maxi, 2026-11-21.** Recommend carrying Runway Dev `gen4.5` into [#11](https://github.com/Maeximilion/MaexSocial/issues/11) as the candidate for one operator-only image-to-video trial. The other option is to exclude image-to-video from this evaluation cycle and record the effect on G4 in #11 and #17. Record the choice, date and rationale on [#167](https://github.com/Maeximilion/MaexSocial/issues/167). The candidate, thresholds and custody terms below are proposals. The [dated primary-source comparison](2026-11-21-g4-video-candidate-terms.md#decision-for-167) supplies the evidence and unresolved provider terms.

| Gate and operation | Current disposition | Who decides |
| --- | --- | --- |
| G3 text drafting, caption generation and claim checking | Manual text is selected. Product text generation, translation, rewriting and model-based checks are disabled. | Employees and Managers edit drafts. Any future generation path must bind claims to approved own-location fact revisions. Missing or conflicting evidence needs a human answer. |
| G3/G4 content review and approval | Human review is required. A preview or a model assessment cannot approve a contribution. | Only the current own-tenant Manager can approve the exact revision, occurrence, destination and time with current authority and fresh enrolled MFA. #124/#131 retain implementation and identity evidence. |
| G4 image-to-video | Deferred pending Maxi's choice. The proposed transport is one server-side model API call, optionally via its SDK. No MCP tool is needed. | Named trial operator uses only the approved fixture, window and spend limit. #11 owns execution and final provider selection. |
| G4 output transformation, validation and disclosure | Upscaling, generated sound and additional transformations are disabled. Format validation, provenance and private capture are application responsibilities. | #99 verifies format, upload and tenant-safe delivery. The operator records generated origin and performs the visual check. Any later customer output needs the applicable channel disclosure before release. |
| G5 tool actions, publication, recurring generation and advertising | Model-initiated reads, writes, approvals, spending and publishing are disabled. Bounded autonomy is deferred. | The application enforces authority, limits and stop state. #12 owns the operating envelope if enabled. Development Claude review grants no product authority. |

### Proposed trial terms

After G3 acceptance (#16), obtain a **separate dated release to execute**. It must name the operator, start/end in UTC, isolated project, rights record, fixture hash and prompt revision, the account's effective terms/rate and approved private storage and deletion deadlines. Require the owner's explicit disposition of residual processing-region, training, retention and deletion uncertainty. An unknown mandatory term, insufficient credit or an unapproved purchase keeps the trial on hold.

* **Input and budget.** One metadata-stripped operator-created JPEG of the fictional striped carton, one manually written camera-motion prompt, one submission, one active job, zero resubmissions. Only the server uses the project credential. Proposed generation cap 60 credits (USD 0.60 at the rate recorded in #191). Auto-billing off. A USD 10 minimum initial payment, if required, needs separate purchase authority.
* **Result and quality.** Poll at most once per five seconds for up to ten minutes. Within that window require a terminal result, private capture, H.264 MP4 at 1280 × 720 and a duration of 5.00 ±0.25 seconds. The human reviewer checks motion, label, stripe and carton shape at opening/middle/end, with no invented offer. Record pass/fail per criterion. A single sample cannot establish a success rate.
* **Custody and reconciliation.** The operator records source/rights revision, prompt revision, requested model/API version, returned job identifier, local output hash, elapsed time, billed credits and reviewer result in a restricted receipt. Keep expiring provider links server-side. Proposed local expiry is 24 hours after capture for the clip and trial input copy. The operator deletes the finished provider task after capture, verifies local cleanup, and records any unproven provider purge separately. Reconcile the single attempt to project usage before releasing its reservation. A missing usage row or a cancellation request leaves an uncertain charge open.

### Version 1 offline examples

Run from the repository root with `python -m doctest docs/research/2026-11-21-product-ai-decision.md`. These small reference decisions run on fictional tuples only. They specify expected behavior for the delivery owner to test through the eventual application. The existing application tests separately cover [own-tenant fact reads](../../tests/pilot/facts.test.ts), [immutable draft edits](../../tests/pilot/drafts.test.ts) and [read-only Manager preview](../../tests/pilot/occurrences.test.ts).

**Claims for #11, and #12 if text is enabled.** Each row below represents an approved fact for one field (carton stripe color), identified by tenant, location and fact revision. The application supplies the current scope. Conflicting approved records for that scope require clarification even if one agrees with the draft. Foreign evidence must never reach a prompt or be shown in a clarification.

~~~pycon
>>> scope = ("paper-shop", "west", "facts-2")
>>> def check_claim(scope, facts, claim):
...     values = {value for binding, value in facts if binding == scope}
...     if not values:
...         return "ask for an approved source"
...     if len(values) > 1:
...         return "ask the Manager to resolve the source conflict"
...     return "eligible for human review" if claim in values else "withhold unsupported claim"
>>> facts = [(scope, "blue")]
>>> check_claim(scope, facts, "blue")
'eligible for human review'
>>> check_claim(scope, facts + [(scope, "red")], "blue")
'ask the Manager to resolve the source conflict'
>>> check_claim(scope, facts, "gold")
'withhold unsupported claim'
>>> check_claim(scope, [], "blue")
'ask for an approved source'
>>> check_claim(scope, [(("other-shop", "west", "facts-2"), "blue")], "blue")
'ask for an approved source'
>>> check_claim(scope, [(("paper-shop", "west", "facts-1"), "blue")], "blue")
'ask for an approved source'

~~~

**Rights for #11/#99.** Reuse #190's observation format and evaluator. Even a captured output must be withheld if permission for its exact source revision was denied. Existing cases already cover absent rights and a grant for the wrong revision.

~~~pycon
>>> import json
>>> from pathlib import Path
>>> from scripts.media_evaluation import evaluate
>>> records = json.loads(Path("tests/fixtures/media-evaluation-v1.json").read_text(encoding="utf-8"))
>>> captured = next(row for row in records["observations"] if row["job_id"] == "captured")
>>> denied = captured | {"rights": captured["rights"] | {"state": "denied"}}
>>> job = evaluate({"schema_version": 1, "observations": [denied]})["jobs"]["captured"]
>>> job["verdict"], job["findings"]
('failed', ['rights_denied'])

~~~

**Human approval and tool requests for #11/#12.** Treat source text, captions, model proposals and tool-returned content as data. The following examples classify the *next step* at a disabled model-action boundary. The server supplies the origin and target tenant independently of any text. Even a current Manager's own-tenant request must enter the normal approval flow with an immutable preview, current grant and fresh MFA. On denial, return a scoped reason, preserve the draft and record the attempted action and revision without copying prompts, credentials or foreign content into the audit log. The example grants no approval and has no tools or side effects.

~~~pycon
>>> def next_step(origin, target, action):
...     if target != "paper-shop":
...         return "deny without reading or changing the other tenant"
...     if origin == "Manager" and action == "approve":
...         return "require the manual approval flow"
...     return "deny action"
>>> next_step("Manager", "paper-shop", "approve")
'require the manual approval flow'
>>> next_step("Employee", "paper-shop", "approve")
'deny action'
>>> next_step("model output", "paper-shop", "approve")
'deny action'
>>> next_step("source caption", "paper-shop", "submit render")
'deny action'
>>> next_step("tool result", "paper-shop", "publish")
'deny action'
>>> next_step("model output", "other-shop", "read asset")
'deny without reading or changing the other tenant'
>>> next_step("model output", "other-shop", "change draft")
'deny without reading or changing the other tenant'

~~~

### Evidence still owed by the delivery owners

| Existing case or specified sequence | Expected decision and later evidence |
| --- | --- |
| #190 `captured`, repeated observation, `missing-source-rights`, `conflicting-rights` | The [offline receipt](../08_EVALS.md) distinguishes complete, incomplete and failed, counts one logical job per ID and leaves unmeasured fields explicit. #11 must connect source, rights, output and actual charge. #99 must verify tenant-safe quarantine, validation, private retrieval, expiry and deletion against UPLOAD-01–10. |
| #190 `cancel-requested`, `cancel-confirmed`; changed observations for one job | #11 keeps a requested cancellation unresolved, checks actual terminal state and reconciles usage once. Its runner must show that replay after a timeout or restart adds zero submissions. #190 checks duplicate records only. |
| Stop before dispatch, then restart; stop after submission; provider failure or timeout with unknown ID/output/charge | #11 must persist stop before any new submission, recover it on restart, and reconcile any in-flight attempt. On failure capture terminal status and billing evidence; on uncertainty keep the attempt and reservation open. #12 must verify durable stop/revocation, concurrency and spend limits if enabled. |
| Wrong format, capture expiry, stale approval, missed quality or cost/latency threshold | #99 withholds unsupported or unverified bytes. #11 records the failed or unmeasured criterion, excludes the output and obtains fresh human review after edits. #12 must verify approval/stop at actual dispatch for any enabled surface. |

Keep #167 open for Maxi's dated scope or exclusion. [#11](https://github.com/Maeximilion/MaexSocial/issues/11), [#99](https://github.com/Maeximilion/MaexSocial/issues/99) and [#12](https://github.com/Maeximilion/MaexSocial/issues/12) retain their execution and release evidence.
