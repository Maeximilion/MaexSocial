# Handover 2026-11-28 — #309 occurrence decision retention

## Status

Maeximilion/MaexSocial [#309](https://github.com/Maeximilion/MaexSocial/issues/309) extends the local audit subcase of [#166](https://github.com/Maeximilion/MaexSocial/issues/166). Local checkpoint on 2026-11-28 at 12:46 UTC. Work head on `dev-codex/309-audit-domain-state` before this receipt was `399cf9c1285b72196d3054e8db332cc4ccbc526c`. Codex implemented the change with High reasoning.

## Artifacts

- [Migration 016](../../../db/migrations/016_occurrence_decisions.up.sql), [expiry operation](../../../ops/local/audit-retention.ts), [retention drill](../../../tests/pilot/audit-retention.ts) and [domain assertions](../../../tests/pilot/audit-retention-domain.ts).
- On Windows with Node 24.22.2 and npm 11.19.1, the original 015 drill kept all three domain audit rows beyond cutoff. A populated 015 database accepted migration 016. Empty up/down/up and the historical migration regression passed. Four cold-pair tests covered forward 015 to 016 compatibility and reverse refusal.
- The drill started with 11 full audit rows. Five non-occurrence events, one operator hold and two withdrawals of distinct approvals for the same occurrence expired. Each survived one microsecond before its 2,160-hour boundary. The incident-held withdrawal, an incident-held organization event and a younger organization event retained their full-row digests. Exactly three compact keys remained. Concurrent retries expired each target once. A deferred commit failure preserved full detail and disposition and wrote zero keys. An incident hold committed ahead of expiry preserved the full row. Downgrade after compaction refused.
- The final retained restart drill took 30 seconds. A normal operator retry returned held with zero new audit rows. The held occurrence had zero sends and zero exports. Dispatch, export and withdrawal still denied after the fixture temporarily restored an otherwise eligible approved state. Generation two rejected both stale proposals. A deliberate fresh approval succeeded, both old withdrawal retries preserved the new approval, and one export committed. A separate authorized send occurred once. The independent tenant kept its approval and zero effects.
- The [offline quarantine test](../../../tests/pilot/restore-quarantine.test.ts) seeded an imported compact hold and verified it after the real quarantine command and retry. This checks the lifecycle transition. Pair verification used synthetic archives. Physical import of an audit-retention archive was outside this drill.

The pinned build passed. The ordinary Windows pilot passed 62/62, including hold, withdrawal, dispatch and export. The dedicated dispatch-retention drill passed for both terminal outcomes across restart. The offline restore test passed. Repository validation passed, Python foundation ran 134 tests with one platform skip, and Node foundation passed 20/20. All six private fixture projects showed zero running containers after teardown.

## Decisions

A compact hold stores only `tenant_id`, `occurrence_id` and NULL `approval_id`. A withdrawal stores the same tenant and occurrence plus the exact original `approval_id`. Foreign keys constrain the scope and lifetime to the referenced occurrence or approval. Actor, device, reason, outcome, event time, audit ID and disposition leave the online audit sink with the expired detail.

Normal writers retain their existing mutation and audit transaction. Expiry locks the occurrence before its disposition. The guarded delete writes the compact key and deletes the full row in one transaction. A read-only union exposes distinct decisions from historical full rows and compact keys without inferred backfill. The application can neither write compact keys nor delete audit detail. Incident holds preserve evidence. Operator holds continue to prevent publication.

## Gate

This is local synthetic online evidence for [Task 5](https://github.com/Maeximilion/MaexSocial/issues/166). Dispatch claims and occurrence exports remain separate full publication records. Encrypted copies belong to [#302](https://github.com/Maeximilion/MaexSocial/issues/302) and [#307](https://github.com/Maeximilion/MaexSocial/issues/307). Real incident authority, monthly reviews, production retention and provider policy remain with [#82](https://github.com/Maeximilion/MaexSocial/issues/82) and [#10](https://github.com/Maeximilion/MaexSocial/issues/10). [G3](https://github.com/Maeximilion/MaexSocial/issues/16) remains open.

## Open

Main owns serial integration. The delivery PR linked from #309 carries current CI, head/base, Claude API execution and review receipts.

```powershell
Set-Location (Join-Path $env:USERPROFILE '.codex/worktrees/issue-309-audit-domain-state/MaexSocial')
codex "Resume #309 from docs/handovers/sessions/2026-11-28-expired-occurrence-decisions.md and verify current delivery receipts with Main."
```

## Lessons

The exact withdrawn approval key supports a safe old retry and the preview generation. A count alone cannot identify the original approval.
