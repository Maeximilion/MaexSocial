# Handover 2026-11-28 — MS-009 / #300

## Status

Local verification checkpoint at 2026-11-28T11:32:19Z. [Issue #300](https://github.com/Maeximilion/MaexSocial/issues/300)
in Maeximilion/MaexSocial covers the continued synthetic source in [Task 5](https://github.com/Maeximilion/MaexSocial/issues/166).
Branch `dev-codex/300-scoped-source-erasure`, verified work head
`41fe5d22bf3481365ee1823039de2a4b522a745e`, integrated base
`380ff9256fe9f2181a3408c0e496d9d6be6ca709`.
The implementer used Codex GPT-6.2 Astra High. At this checkpoint the PR had yet to open.
The PR records the subsequent Claude API execution, reviewed commits, candidate CI and thread disposition.

## Artifacts

The [physical drill](../../../ops/local/README.md#restore-before-dispatch-and-terminal-export-258)
ran under Node 24.22.2 / npm 11.19.1 with PostgreSQL 17.11. The initial regression at `edc1310`
failed before restore with two A revisions where zero were required. In the corrected integrated run,
A and B were independent synthetic tenant/location pairs. The snapshot anchor was sequence 1,
A's deletion was sequence 2 and its device revocation was sequence 3.

| Stage | A revisions | B revisions | Observation |
| --- | ---: | ---: | --- |
| Continued source before erasure | 2 | 2 | Both original revision sequences present |
| Missing instruction, wrong source, crossed tenant/location, or control B request | 2 | 2 | Source refused each and had no applied receipt |
| Deferred commit failure | 2 | 2 | The transaction rolled back the deletion and receipt |
| Authorized source operation and retry | 0 | 2 | Removed 2, then 0. App login and its ordinary control operation worked |
| Offline import before replay | 2 | 2 | Five occurrences held, application login and database connect denied |
| Target after replay, retry and restart | 0 | 2 | Applied 2 events, then 0 and 0. Full B rows matched the continuing source |

The independent replay-only variant also passed on the same integrated revision. Its source retained
all four revisions and its target retained both control revisions. All nine owned test fixture projects
had zero running containers after the drills.

The source's two database processes exited successfully before import. Device A ended at version 2
and B at version 1. Immutable approval bindings matched. One fake create and one original export
were recorded on the source. Four subsequent target calls failed at authentication with `28P01`,
with zero additional creates or exports. Both target networks were internal with zero host ports.
The original encrypted archives, pair manifest, capture journal and later journal were verified.
B revision-set SHA-256 was `603bd32dcf3b8291958f68bbb14111ad29d6738676f0c04ed8a31383dabdf61f` and the
later journal SHA-256 was `7f9c26d8f6a38c5a35873d30b02537d87f84c1567ad6784bc51755504919c00b`.

## Decisions

A private owner-issued instruction pins the exact fixture, journal digest, sequence, tenant and location.
The operation locks that instruction and location. PostgreSQL validates the deleted row set against the
instruction in its applying transaction. Updates and truncation remain immutable. Direct application
deletion and instruction updates failed with `42501`. The database rejected owner changes outside
the authorized row set with `23514`. An authenticated format-3 pair physically captured on schema
013 verified against 014, with its original ciphertext and metadata.

## Gate

This supplies local Task 5 evidence for the source-side deletion criterion. G3 remains open.
The project still requires its separate operational acceptance and custody evidence.

## Open

Open the regular PR against the verified base and record current Claude API coverage and candidate
CI on that PR. Main owns the expected-head merge. For a PowerShell handover in the attached task
checkout, use `Set-Location "$env:USERPROFILE/.codex/worktrees/issue-300-scoped-source-erasure/MaexSocial"`
and `git status --short --branch`. First request: verify the current head, base, candidate and threads
before integration. To reproduce the drill, follow the linked runbook with fresh disposable checkouts.

## Lessons

`npm run pilot:build` and the five cold-backup and paired-restore tests passed. Migration up/down/up,
the empty-migration and immutable-facts tests, and the isolated restore-history interruption/restart test
passed. The Node foundation suite passed 20/20. The Python foundation suite completed 134 tests with
32 skips. The repository checker and whitespace check passed.
