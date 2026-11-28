# Handover 2026-11-28 — MS-009 / #302

## Status

2026-11-28 11:58 UTC. [Issue #302](https://github.com/Maeximilion/MaexSocial/issues/302)
remains open. The local physical drill on `dev-codex/302-last-encrypted-copy-expiry`
tested `992dfb9184c7a0236223fa7206ecf7c8f77a31e3` on base
`b81d15e3c1b4d1f9939edb1630a4325d8310978e`. The later pair remained
eligible at the purge deadline and still contained the seeded A marker.
[Task 5](https://github.com/Maeximilion/MaexSocial/issues/166) remains at four of five criteria.
Codex GPT-6.2 Astra High implemented the drill. The PR records its subsequent
base, head, Claude API review and integrated candidate checks.

## Artifacts

Both format-3 captures came from the same two database volumes. Both PostgreSQL
system identifiers matched across captures, and each new archive had a different
ciphertext digest. The first physical import was held before history replay.
The later import used a second fresh target. Both targets held all five occurrences,
blocked application access and used two internal networks with zero published ports.

| Stage | A revisions | B revisions | A fact marker in AppDB / IdP |
| --- | ---: | ---: | --- |
| First pair, offline import before replay | 2 | 2 | Present / absent |
| Continued source after committed purge | 0 | 2 | Measured on archives only |
| Later pair, offline import before replay | 0 | 2 | Present / absent |

The drill generated a new random label and checked the full first revision text.
It compared the complete B rows across the source and both imports. Each archive
passed ciphertext verification and authenticated decryption. Only presence or absence
was recorded. The probe does not locate the bytes within PostgreSQL or establish a
general test for physical erasure.

Elapsed times below use the application's reported completion of the first successful
source erasure as zero. The runner sampled the clock after the database operation
returned from commit and before its idempotent retry. Both captures used their actual
authenticated UTC timestamps. Only the verification and expiry child processes used
a controlled clock. One day is 86,400,000 ms.

| Event | Offset from completed purge | Observed result |
| --- | ---: | --- |
| Last pre-purge capture | −39,167 ms | A present in offline SQL and AppDB archive |
| First post-purge capture | +16,805 ms | A absent from offline SQL, marker present in AppDB archive |
| Earlier capture + 30 days − 1 ms | +2,591,960,832 ms | Verify passed, expiry refused |
| Earlier capture + 30 days | +2,591,960,833 ms | Verify and restore refused before target creation |
| Purge + 30 days | +2,592,000,000 ms | Later pair still verified |
| Later capture + 30 days − 1 ms | +2,592,016,804 ms | Later pair still verified |
| Later capture + 30 days | +2,592,016,805 ms | Later pair refused verification |

Expiry removed exactly two earlier ciphertext files, leaving the original manifest
and authentication tag. A repeat one millisecond later removed zero files.
The distinct later pair still verified, including after its offline restore.
The capture journal, independent deletion interval and control rows compared equal.
After the drill, Docker reported zero containers for each of the three owned projects.

## Decisions

The normal capture CLI requires a new fixture. This drill uses the same checked
cold copying, sealing and verification path on the stopped continuing source.
The inherited history anchor identifies the original journal base. The separately
bound later interval and the source's applied receipt carry the deletion evidence.

A follow-up can enforce an **earliest applicable deadline** for each affected
physical lineage. The authenticated manifest supplies `fixtureId`, `capturedAt`,
`historyAnchor.after` and `historyAnchor.evidenceSha256`. The independent journal
binds the source, interval, deletion sequence and scope. The source instruction
binds the journal digest and records the applying transaction. None of these fields
records an authoritative purge-completion instant.

Record durable, independently retained completion evidence bound to that source,
sequence and journal digest. Carry the earlier of capture + 30 days and the earliest
applicable purge + 30 days across verification, restoration and disposal of affected
pairs. Where completion time is unavailable, an authenticated capture known to
precede the purge can supply a conservative earlier deadline. If neither bound
can be established, keep the affected copy ineligible pending disposition.

A new capture of the same physical databases can inherit an already elapsed
deadline and therefore be immediately ineligible. Starting a new retention period
requires evidence of a clean physical baseline across both databases and applicable
history. A zero SQL count or negative search for one marker cannot establish that
baseline. The choice of operational baseline and existing protected-copy disposition
belongs to the follow-up design.

## Gate

The capture deadline and logical erasure passed. Physical final-copy expiry by the
purge deadline failed in this disposable fixture. Protected and legacy copies,
incident holds, provider and vault retention, real custody and operating acceptance
remain in [#166](https://github.com/Maeximilion/MaexSocial/issues/166) and
[#82](https://github.com/Maeximilion/MaexSocial/issues/82). G3 stays open.

## Open

Main owns serial integration and the separate correction decision. Use the
[drill runbook](../../../ops/local/README.md#restore-before-dispatch-and-terminal-export-258)
with fresh disposable resources. In PowerShell, start from
`Set-Location "$env:USERPROFILE/.codex/worktrees/issue-302-last-encrypted-copy-expiry/MaexSocial"`
and run `git status --short --branch`. First verify the PR's current base, head,
Claude API outcome, candidate and threads before integration.

## Lessons

Node 24.22.2 / npm 11.19.1 built all three checkouts. The physical drill passed
its observation assertions and exposed the retention failure above. Five cold
backup and paired restore tests passed. The repository checker and 20 Node
foundation tests passed. Python completed 134 tests with 32 skips. The source
ran the normal migrations up during capture. The delivery changes no migration,
backup format or production retention policy.
