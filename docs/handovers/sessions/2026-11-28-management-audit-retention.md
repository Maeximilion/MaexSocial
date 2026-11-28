# Management audit retention · #305

## Status

Local evidence checkpoint at 2026-11-28 12:10 UTC. Two new synthetic fixture projects ended with zero running containers. Codex implemented the change with High reasoning. The repository's automatic Claude Messages API review and integration-candidate CI belong to the subsequent PR. Its live receipts identify the reviewed revisions.

## Artifacts

- Maeximilion/MaexSocial, Task 5 [#305](https://github.com/Maeximilion/MaexSocial/issues/305), branch `dev-codex/305-management-audit-retention`. Work head before this handover was `f1ab110ec0051f51e704b6609373dadd900d6cf9`. The PR was awaiting its predecessor at this checkpoint.
- [Private maintenance operation](../../../ops/local/audit-retention.ts), [database guard](../../../db/migrations/015_fixture_audit_retention.up.sql), [fixture drill](../../../tests/pilot/audit-retention.ts) and [domain controls](../../../tests/pilot/audit-retention-domain.ts).
- Node 24.22.2, npm 11.19.1. The pinned build passed. Migration up/down/up committed on an empty database. Four cold-pair verification tests passed, including the exact 014 → 015 compatibility mapping and refusal of the reverse mapping. This is pair verification with synthetic archives. The run did not import an old physical pair.
- On the expanded drill, five of ten online audit rows expired. Each of the five survived one microsecond before its own deadline. PostgreSQL compared its stored instant with 2,160 elapsed hours. The controlled management writer clock had millisecond precision. The original domain and incident evidence and younger control retained their row digests. The restart drill took 27 seconds locally.
- Missing clearance, wrong tenant, mismatched trusted instant and premature expiry left detail intact. An unavailable disposition table, unmarked database and restore marker refused expiry. A competing expiry waited for the hold to commit and preserved the row. A deferred commit failure restored audit and disposition together. Concurrent expiry removed one row once. Ordinary application access could neither edit audit detail nor read the disposition source.
- The retained database accepted a fresh approval and export after denying the stale preview, old export and withdrawn send. A separate authorized send committed once and denied a repeat. All five targeted suites passed (management organization, management role change, occurrence hold, occurrence export and dispatch). The organization suite exercised a failed audit insert and verified rollback of the mutation.
- Repository validation passed. Foundation Python ran 134 tests with the configured scanner, including one Windows-inapplicable skip. The first run without a scanner on PATH skipped 32. Foundation Node passed 20/20. The private CLI rejected ordinary and restore manifests. The database-clock CLI returned `ineligible` for an unknown record. Repeating setup against the populated fixture refused before seeding.

## Decisions

The source inventory at `b81d15e` contained nine action classes. Local synthetic setup is the only incident authority in this drill. The fixture owner binds an exact event, tenant, creation instant and explicit disposition. The maintenance path chooses no disposition. Its transaction deletes an eligible row and cascades only its associated fixture instruction.

| Audit action | Evidence and retained authority |
| --- | --- |
| `organization_create` | Eligible. The tenant row stores the organization. |
| `invitation_issue` | Eligible. The invitation row binds recipient, issuer, version and consumption. |
| `membership_role_changed`, `membership_revoked` | Eligible. Membership role, active flag, versions and invalidations drive authorization and retry. |
| `employee_membership_revoked` | Eligible. Customer revocation reads the scoped membership, invitations and current session. |
| `occurrence_hold` | Full row retained. Approval preview, withdrawal, dispatch, export and dispatch-detail retention consult hold history. |
| `approval_withdrawal` | Full row retained. The occurrence withdrawal count invalidates stale proposals. Exact approval linkage makes withdrawal retries idempotent. |
| `dispatch_claim`, `occurrence_export` | Full rows retained as publication events. This drill proves no expiry for these classes. Attempts and occurrence state track the business effects. |

## Gate

[#166](https://github.com/Maeximilion/MaexSocial/issues/166) retains compound retention and recovery acceptance. This evidence covers logical online expiry for five classes. Full retained occurrence and withdrawal audit records do not satisfy detail expiry. A decision on any alternate minimal durable authorization state belongs to the owner. [#82](https://github.com/Maeximilion/MaexSocial/issues/82) retains real custodians, lawful incident decisions, monthly reviews, external sinks, backups and operating evidence.

## Open

Main owns the serial integration and expected-head merge. Follow the linked issue to the delivery PR for final candidate, review and CI receipts. A future maintainer can open PowerShell in the task worktree and run:

```powershell
Set-Location (Join-Path $env:USERPROFILE '.codex/worktrees/issue-305-management-audit-retention/MaexSocial')
codex "Resume MaexSocial #305 from docs/handovers/sessions/2026-11-28-management-audit-retention.md and verify current delivery receipts before acting."
```

## Lessons

An operator hold controls publication. An incident hold protects evidence. Independent controls in the same drill preserve that distinction. Logical removal and a retained-volume restart provide no evidence of physical removal from backup bytes.
