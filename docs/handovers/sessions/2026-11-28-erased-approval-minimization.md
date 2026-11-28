# Handover 2026-11-28 — MS-009 / #318

## Status

[Issue #318](https://github.com/Maeximilion/MaexSocial/issues/318) implements approval minimization for an existing exact draft erasure permit. Codex GPT-6.2 Astra High implemented the pre-integration changes. The original physical regression on schema 017 failed at the terminal export. The same populated database upgraded to 020 and passed the source checks, including readback of the original attempt. The Python candidate test currently rejects the provisional migration gap between 017 and 020. The integration base must include 018 and 019 before publication.

## Artifacts

- Repository and branch — Maeximilion/MaexSocial, `dev-codex/318-erased-approval-minimization`.
- Work head before the handover commit — `bc076a204e1a6f028ca4d66b860dfdfeb5dba931`, based on merged [#319](https://github.com/Maeximilion/MaexSocial/pull/319). PR and Claude API receipt pending serial integration.
- Physical test — `node dist/pilot/tests/pilot/draft-erasure.js` with Node 24.22.2 and npm 11.19.1 on that work head. Source authorization 14:42:37.436 UTC. Commits confirmed by 14:43:07.866 and 14:43:07.965 UTC, 30,430 and 30,529 ms after authorization. Four selected revision payloads disappeared. Four control revisions kept their original digests. Both original creates survived and no additional create occurred. The continued backup inherited its deadline of 2026-12-28T14:42:25.318Z. Two physical clusters restored, 13 occurrences were quarantined, and three history events applied once. The second replay applied zero.
- `npm run pilot:build`, five cold-pair tests, `python scripts/check_repo.py` and 20 Node foundation tests passed. The extended authority, downgrade and schedule assertions passed against the retained offline target. The integrated run must repeat the matrix after #316.

## Decisions

The table describes the approval row on an explicitly erased draft. All rows keep the five linkable tenant, approval, occurrence, draft and revision identifiers for referential integrity. The four proof and grant fields already covered by #312 stay empty.

| State | Authority fields | Destination and schedule fields | Remaining reader |
| --- | --- | --- | --- |
| Current approved, never claimed | Membership ID and version, tenant version | None | Original Manager may withdraw. Membership invalidation can detach the approval. |
| Held, still attached | Membership ID and version | None | Membership invalidation detaches this approval. The independent hold remains. |
| Withdrawn | Membership ID and version, tenant version | None | Exact original-authority retry returns the earlier decision, including after detailed audit expiry. Detached superseded approvals without a decision have no authority reader. |
| Terminal private export | None | None | Occurrence state and existing audit identify the handoff. No text is available for repeat download. |
| Original unknown or pending attempt | Membership ID | Exact approved provider destination | The attempt readback uses the original provider destination, tenant and attempt IDs. The proposed #316 retirement reader compares the claim actor with the original membership. |
| Confirmed or rejected with attempt detail | Membership ID | None | The terminal result stops readback. The historical claim actor check remains until restricted retirement. |
| Retired attempt | None | None | The tenant/occurrence claim and terminal outcome suffice to prevent a second effect. The restricted audit disposition controls evidence expiry. |

The operation locks the authorized draft and its occurrences. A claimed occurrence must match its approved location, instant and timezone before their duplicates leave the approval. Its own schedule stays fixed while the detailed erased claim exists. The approval snapshot cannot be used for a new claim. Reconciliation releases the provider key in the terminal transaction. A deferred refresh sees both halves of a withdrawal transaction. Legacy pairs stay offline and need the current schema before reporting a draft replay complete.

The occurrence, original revision keys and restricted audit/incident compartments still contain linkable records. The seven-day approval policy and the independent 90-day resolved-evidence policy have different readers. Local results do not establish production scheduling, real provider erasure or incident release.

## Gate

G3 remains open. [Task 5](https://github.com/Maeximilion/MaexSocial/issues/166) owns the retention evidence and the outstanding production decisions.

## Open

Reconcile the actual merged #314/#316 readers and test both orders of erasure and restricted claim/audit expiry. Verify held, missing and cleared incident dispositions on the selected claim, retired/rejected outcomes, source restart and offline history. Then run the current integrated checks, complete Ponytail, open and attach the normal PR, inspect authentic Claude input/outcome and candidate CI, and publish the dated #166 evidence link. Main owns the expected-head merge.

In PowerShell run `Set-Location "$env:USERPROFILE/.codex/worktrees/issue-318-erased-approval-minimization/MaexSocial"` followed by `git status --short --branch`. Resume with “Verify the current private coordinator control and the confirmed #316 base, then finish #318 from this branch.”

## Lessons

The worker reads the attempt before considering a new claim. An erased draft can therefore finish an existing readback without preserving its historical scheduling, grant and approver versions. Tests must inspect both sides of that final transaction.
