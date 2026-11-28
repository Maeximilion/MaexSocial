# Handover 2026-11-28 — MS-009 / #312

## Status

[Issue #312](https://github.com/Maeximilion/MaexSocial/issues/312) supplies local draft-payload
evidence for [Task 5](https://github.com/Maeximilion/MaexSocial/issues/166). The implementation
and physical drill ran in Maeximilion/MaexSocial on `dev-codex/312-authorized-draft-erasure`.
The physical regression ran on `f894d98b9b83d1fa8d369d3e6df13429d9cdedab` in [PR #319](https://github.com/Maeximilion/MaexSocial/pull/319) after the initial automatic review.
Codex GPT-6.2 Astra High implemented this slice. The PR records the subsequent actual Claude
API review, integration base, candidate checks and thread disposition.

## Artifacts

The [private operator command and physical drill](../../../ops/local/README.md#authorized-draft-text-erasure-312)
use Node 24.22.2 and npm 11.19.1. Four drafts in the snapshot each had two distinct revisions. A fifth draft with one revision was created after capture.
One selected draft had a dispatch-eligible occurrence, a confirmed attempt, an unresolved
attempt, a management hold and a withdrawn approval. The other had an already committed private export. Same-tenant and other-tenant controls
each had an authorized repeatable download.

| Observation on the above work head | Result |
| --- | --- |
| Source database authorization, UTC | 14:01:59.610 |
| Committed purge confirmed by the source database, UTC | 14:02:13.900 and 14:02:13.978 |
| Authorization to confirmed removal | 14,290 ms and 14,368 ms |
| Scoped revision payloads | 4 present before, 0 present after source purge and target replay |
| Unaffected payloads | 4 matched their original digests on the source and the restored AppDB |
| Approved snapshots | 6 selected approvals lost 4 historical proof/grant fields each. Both control approvals retained all four |
| Provider outcomes | 2 original fake creates, 0 further creates. The confirmed result survived. The open attempt reached confirmed by readback |
| Holds and withdrawals | The held and withdrawn occurrences kept the original decision and zero attempts. Repeating withdrawal added zero decisions |
| Continued physical backup | The format-4 copy inherited the original deadline of 2026-12-28T14:01:47.918Z |
| Draft created after capture | Its single revision was erased on the source by 14:02:15.571Z, 15,961 ms after authorization. Its absence on the offline target satisfied this event without an insert |
| Offline recovery | 2 encrypted clusters restored, 13 occurrences quarantined, 3 events processed, 0 on replay after restart |

On the preceding integrated code `b2157f5`, migration up/down/up, a populated downgrade refusal and historical approval upgrade passed.
The export suite passed there. On integrated code `5c344f9`, all five cold-pair tests passed,
including the historical stack fingerprint and both schema compatibility directions. The Python foundation suite ran 134 tests
with 32 skips. The preceding implementation on the #307 base passed all 63 pilot tests.

The operator exercised source refusal with missing authority and changed journals. Deferred
commit failure restored payloads and left zero completion receipts. After a database restart,
the purge held the draft lock while a normal worker wake or repeat download waited. Both
waiters observed erasure and created zero new effects. Repeated erasure removed zero revisions.
The original private export committed before authorization. Authorized control reads/downloads
continued. Missing and incomplete target history kept the pair offline. Source ciphertext,
authenticated manifest, capture journal and key digests matched after restore.

## Decisions

Every revision loses its `text`. Revision rows retain the composite identifiers, revision number
and creation time. Existing approval foreign keys target the exact revision and a retired
revision prevents ordinary writers from adding content to that draft. Preview HTML and private
download responses derive from those rows. The selected approval, occurrence, audit and attempt
records contained zero copies of the invented payloads. The separate provider simulator retains
the two submitted intents. Previously delivered external copies, including client downloads,
are outside this operation.

| Approval fields | Treatment and current reader |
| --- | --- |
| `mfa_at`, `created_at`, `grant_version`, `grant_active_at_approval` | Cleared on every selected approval. Ordinary new approvals still require the original proof fields |
| `tenant_id`, `id`, `occurrence_id`, `draft_id`, `revision_id` | Preserve composite references from the occurrence, attempt and withdrawal decision to the authorized draft/revision |
| `membership_id`, `membership_version`, `tenant_version` | The original Manager's withdrawal and membership invalidation resolve the approval against its original authority |
| `location_id`, `due_at`, `timezone` | Resolved attempt retirement verifies the occurrence's original destination and schedule before dropping attempt details |
| `provider_location` | Restricted readback uses the approved destination to correlate an unresolved provider result |

The [worker](../../../apps/worker/src/reconcile.ts) reads attempt, tenant, occurrence, provider
destination and any persisted resource name. The [retirement operation](../../../ops/local/dispatch-retention.ts)
and [withdrawal path](../../../apps/web/src/routes/content.ts) use the bindings above.
The seven-day policy still covers approval metadata. Uniform retention of those bindings on
terminal exports and retired attempts awaits a state-specific minimization decision under #166.
The evidence here covers payload erasure and the four cleared fields.

## Gate

G3 remains open. The local fixture owner invokes the private maintenance command. Production
scheduling, provider deletion, incident decisions, physical storage sanitization and custody
of the independent journal require separate evidence.

## Open

Main owns the serial publication basis and expected-head merge. In PowerShell, run
`Set-Location "$env:USERPROFILE/.codex/worktrees/issue-312-authorized-draft-erasure/MaexSocial"`
and `git status --short --branch`. Begin by verifying the current PR head, integration base,
complete Claude API result, candidate CI and review threads before integration.

## Lessons

The source serializes erasure with the same draft lock as editing, approval, dispatch and
download. The database rejects completion while selected payloads or obsolete approval fields remain. An observation after commit on the
issuing database clock supplies the measured upper bound. Readback of a prior attempt needs
its correlation keys and preserves the original effect independently of the revision payload.
