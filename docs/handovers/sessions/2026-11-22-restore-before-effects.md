# Handover 2026-11-22 — #258

## Status

Verification checkpoint (UTC) — 2026-11-22T19:51:07Z. [Issue #258](https://github.com/Maeximilion/MaexSocial/issues/258)
in Maeximilion/MaexSocial is implemented on `dev-codex/258-restore-before-dispatch-export`.
Work head before this handover commit — `4031597582d0c387c91ab06ad175b39a8392448e`, with the
verified merged #259 base `6415f99423ca5287bf15cad53317ee46dd946055`.
The PR and its Claude API review and candidate CI are pending at this checkpoint.
The implementer ran Codex Sol High with Standard speed.

The paired drill passed on Windows with Node 24.22.2, the pinned PostgreSQL 17.11,
Keycloak 26.8.2, Mailpit 1.33.0 and [container runner](../../../ops/local/compose.yaml).
The initial integrated #252/#253 base was `8ecf94f421d1f0c5f86f9242f5d9a670448c4e90`.
The complete historical run at `401c019d312c07d2e7d00fc36500a2155b8203a3` passed
with the same counts and refusal codes. Its AppDB, IdP and pair-manifest SHA-256
values matched byte for byte before and after the target drill. The integration
run used a fresh pair and fresh occurrence IDs.

The pinned Node build, three cold-backup/paired-restore tests, 20 Node foundation
tests, repository checker and Git whitespace check passed. The Python foundation
suite passed 133 total with 32 skips when passing the existing environment
explicitly to child processes. Direct Windows inheritance had dropped empty Git
configuration values and caused two errors on the initial run.

## Artifacts

The [runbook](../../../ops/local/README.md#restore-before-dispatch-and-terminal-export-258)
includes the exact build and drill commands. Synthetic bindings from the integration run:

| Case | Occurrence | Approval | Source result |
| --- | --- | --- | --- |
| A | `7861b79e-a601-413d-93a0-4adcc787180f` | `06ddf5f6-b48f-40a2-86db-f70b1fafe3e5` | `in_flight`, one dispatch audit, one attempt, one independent fake create |
| B | `62155f47-7342-4fe5-8703-a65c5398e34a` | `bd226357-2f2e-4f4f-94d3-67b3b764fb49` | `exported`, one export audit, zero attempts and zero fake creates |

Both were `approved` at capture with zero attempts and zero dispatch/export audits.
Five historical rows were quarantined across the restored fixture, including these
two and the three standard backup-history controls. The two checked rows kept their
approval and revision IDs and saved `approved` as their prior state. They had zero
attempts and zero export audits before and after the repeated quarantine. The second
quarantine changed zero rows. The retained source projection and the independent
fake create count matched their post-operation values. Both original archive hashes
were verified against the byte-identical pair manifest. Both fixture projects
finished with zero running containers.

## Decisions

The target contained only PostgreSQL on two internal networks with zero published
ports. The test verified the global stop, denied `CONNECT` and `NOLOGIN` for
`pilot_app`, and `NOLOGIN` for Keycloak. Both ordinary application operations
failed twice at PostgreSQL authentication with `28P01`. Those invocations returned
zero text and reached no private domain state check. The fixture-owner observations
used read-only queries separate from the attempted operations.

## Gate

The drill supplies bounded Task 5 evidence. [Task 5 / #166](https://github.com/Maeximilion/MaexSocial/issues/166)
retains integrated rollback, recovery and release evidence. The public export route,
production recovery objectives and G3 acceptance require their separate evidence.

## Open

Open or inspect the regular #258 PR against the verified `main`. Record the actual
Claude API execution and complete head/base review, candidate CI and any remaining findings
on the PR. The coordinator owns the merge decision.

Run from PowerShell in a clean source checkout of `dev-codex/258-restore-before-dispatch-export`
and use a second clean checkout pinned to the same commit. Build both with
`npm run pilot:build`. From the source run
`node dist/pilot/tests/pilot/restore-before-effects.js <absolute-target-worktree>`.
First instruction for a new session: verify the PR head, base and receipts before
requesting a fresh run.

## Lessons

An image taken before export can legitimately restore an approved row while the
source audit proves the terminal export happened. Keep the fake receipt and source
audit independent of the restore. Treat the observed PostgreSQL refusal as an
authentication check and the quarantined row as separate state evidence.
