# Handover 2026-11-28 — #316 publication audit retention

## Status

Local checkpoint at 13:37 UTC for [Maeximilion/MaexSocial #316](https://github.com/Maeximilion/MaexSocial/issues/316).
Branch `dev-codex/316-publication-audit-retention`. Work head before this handover commit
`ec330dbe204fa46ae211fc450bc35bbb4109b995`. Implementer used Codex with High reasoning. At this
checkpoint the coordinator had queued PR publication after #314. Claude API and integration-candidate
receipts belong on the resulting PR.

## Artifacts

The [dispatch operation](../../../ops/local/dispatch-retention.ts) and
[dedicated fixture drill](../../../tests/pilot/dispatch-retention.ts) use the existing isolated
AppDB, its restricted incident table and the synthetic counting provider. On the original release
base `a089ac569f659fcd0d3265f830dc1dcc2d571d42`, normal retirement of two real fixture claims
removed attempt details while both full audit rows survived. Applying the new migration to that
populated fixture retained both historical events. Neither had a trustworthy terminal clock left.

- Confirmed and rejected operations progressed through pending before local resolution. Each full claim
  survived one microsecond before its 2,160-hour boundary and expired once at equality. Retried terminal
  reads conserved the first resolution time. Two simultaneous retirements returned one successful result.
  Failure at deferred commit preserved the full attempt, audit, and unconsumed incident decision.
- A committed incident hold won a measured lock race. Across restart, the occurrence, full attempt,
  full audit and incident disposition had identical digests. The held attempt kept its ID, approval,
  original claim, observation and resolution times, outcome, and available synthetic resource name.
  The audit kept its event ID, tenant, actor, occurrence, action, reason, initial outcome, time and
  original optional fields. Missing decisions, unavailable disposition storage, mismatched time or
  fixture, duplicate claims and an ambiguous database marker all preserved detail.
- After successful expiry the full audit and its disposition were absent. The six detailed attempt
  fields became NULL. The tenant, occurrence, confirmed/rejected result and retirement flag remained
  for the terminal customer projection and the permanent single-claim slot. The original approval
  and occurrence remained. There was one create per resolved occurrence, zero additional creates,
  zero repeat provider reads, and no dispatch-to-export conversion.
- Separate unresolved, pending, historically held and other-tenant controls survived. After retained
  restart the pending claim allowed one ordinary readback and still had one create. On the separate
  manual occurrence an authorized repeat downloaded the same approved text with exactly one full
  export receipt and zero attempts or creates. The [event-clock drill](../../../tests/pilot/audit-retention.ts)
  expired all seven management classes and retained three domain keys (11 full rows to 3, 27 seconds
  across restart). That operation declined both publication classes even with clear dispositions.
- Windows used Node 24.22.2 and npm 11.19.1 with the offline lockfile. The build, empty up/down/up,
  historical migration and populated downgrade refusals passed. Cold-pair tests passed 5/5, ordinary
  pilot 63/63, Node foundation 20/20, repository validation passed, and Python foundation ran 134 with
  32 environment skips. A test initially expected an ineligible result for a second database marker.
  The existing owner connection refused the ambiguous database earlier. After correcting that assertion,
  the fresh complete dispatch drill and retained restart passed. All five local fixture projects had
  zero running containers at this checkpoint.

## Decisions

The [accepted G2 contract](https://github.com/Maeximilion/MaexSocial/issues/15#issuecomment-6681723454)
covers minimized facts of a resolved send. The local terminal write provides its clock. The operation
locks the occurrence and attempt, conditionally locks the exact clear incident decision, and deletes
the matching audit in the transaction that clears the attempt. This enforces one order while the
original resolution clock still exists. The reader needs no new audit tombstone.

A manual handoff commits the local exported state with an unconfirmed provider outcome. Its full
disclosure receipt stays intact pending the owner's classification and decision on its expiry anchor.
Repeat download still requires live customer authority and available approved text.

## Gate

This is logical online evidence in dedicated synthetic fixtures for [Task 5](https://github.com/Maeximilion/MaexSocial/issues/166).
Maintenance is on demand. The synthetic provider stores its own independent call history. Physical
residue and encrypted backup expiry have separate evidence. Production scheduling, named incident
operators, monthly review and custody remain under [#82](https://github.com/Maeximilion/MaexSocial/issues/82).
Real provider-field retention remains under [#10](https://github.com/Maeximilion/MaexSocial/issues/10).
[G3](https://github.com/Maeximilion/MaexSocial/issues/16) remains open.

## Open

Main owns serial integration. Incorporate its confirmed release base, verify the predecessor's
draft-erasure precedence and migration history, then publish the exact PR, review, CI and Task 5
receipts. Preserve the open export decision unless the owner supplies a contract.

```powershell
Set-Location (Join-Path $env:USERPROFILE '.codex/worktrees/issue-316-publication-audit-retention/MaexSocial')
codex "Continue #316 from docs/handovers/sessions/2026-11-28-publication-audit-retention.md and the latest owner and coordinator decisions."
```

## Lessons

Using the claim or provider timestamp would erase detail early for delayed local resolution.
A missing terminal timestamp on a previously retired claim stays unknown.
