# Handover 2026-11-23 — G3 Task 5 / #285

## Status

Checkpoint recorded at 2026-11-22 23:59:17 UTC. The implementation is locally verified on the integrated
work head. Schema 013 and the dedicated retention fixture are present from PR #287. The ordinary pilot and the dedicated retention fixture both passed.

Implementation used Codex Sol 6.2, high, with local full access. Standard speed was requested and no Fast tier was recorded. The required Claude Messages API review and hosted candidate checks run on the delivery
PR. At this pre-publication checkpoint those results are pending.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial).
- Task — [#285](https://github.com/Maeximilion/MaexSocial/issues/285), under [Task 5 / #166](https://github.com/Maeximilion/MaexSocial/issues/166).
- Branch — `dev-codex/285-encrypted-cold-pair`.
- Work head before the handover commit — `81f6ac97cdf6892c90f113ec687f2dc79f33a92b`.
- Integrated main — `22974aeb649fa6fd902aeeb05adaff6b01707c6e`.
- PR — pending at this checkpoint. Consult the PR for its exact check and review receipts.
- [Key provisioning and capture](../../../ops/local/README.md#synthetic-cold-backup-pair-216),
  [paired restore](../../../ops/local/README.md#offline-restore-of-a-verified-pair-235) and
  [restore-before-effects drill](../../../ops/local/README.md#restore-before-dispatch-and-terminal-export-258).

## Decisions

Format 3 uses the pinned Node/OpenSSL AES-256-GCM implementation. The locally provisioned random
key file stays outside both worktrees and the copied fixture. Each role gets a distinct nonce
and authenticates its archive role and source fixture identity. The detached manifest tag binds
both sealed files and their ciphertext hashes to the source revision, compatibility and restore
metadata. Capture streams directly to ciphertext with stdout logging disabled. The offline
importer checks both archives before target creation and checks each stream again before extraction.
A bounded private container tmpfs holds at most one TAR. The import container has no network
or swap allocation. Formats 1 and 2 retain their historical private offline paths. The protected
#216 reference pair was outside the drill.

## Gate

The following checks apply to work head `81f6ac97cdf6892c90f113ec687f2dc79f33a92b` unless stated
otherwise. The host ran Node 24.22.3 and the locked offline dependencies. The isolated runner
image uses Node 24.22.2.

- TypeScript build and `node --test dist/pilot/tests/pilot/cold-backup.test.js` passed, 4/4.
  Checks include distinct AppDB/IdP archive binding, reauthenticated swapped-role refusal,
  missing completion on stream failure, tampered metadata, legacy compatibility and exact expiry.
- `node dist/pilot/tests/pilot/restore-before-effects.js <fresh-target>` passed at the integrated
  013 head and at `a4ddc3bb8c3f6e2894d412e6fa31192ecd5cd06e` (012). The 013 importer also restored
  the newly generated 012-format-3 pair. The AppDB and IdP markers matched, both logins were
  disabled, dispatch stayed stopped, and five historical occurrences were quarantined. Replay
  removed two target facts, retained two control facts, and revoked only the intended device.
  Four source facts and one fake create remained. A repeated replay and a retained target
  restart applied zero additional records. The target published zero host ports.
- Direct entry point controls refused missing/wrong keys, mixed ciphertext and an unpublished
  pair before target creation. An authenticated incorrect IdP system identifier failed during
  the second import and removed both target volumes without a readiness marker. The importer
  received a complete-length stream without its completion digest and left an empty target
  volume. At exactly 30 elapsed UTC days restore refused a genuine disposable pair. Expiry
  removed the two ciphertext files in an owned disposable copy and succeeded on retry.
  Source contents and the unrelated control were preserved.
- Both empty `up → down → up` migration cycles passed. The ordinary `node --test --test-concurrency=1` pilot suite passed 59/59 on the initialized fixture and again after `node dist/pilot/tests/pilot/dispatch-recovery.js`. The separate `node dist/pilot/tests/pilot/dispatch-retention.js` fixture passed. Both test stacks were stopped.
- `python scripts/check_repo.py` and the 20 Node foundation tests passed. Default Python
  discovery showed the known Windows `GIT_CONFIG_VALUE_0` isolation failure. Prioritizing
  `test_repository_hook` and `test_pilot_candidate` in the same discovered suite passed
  133 cases with 32 skips.

Production operator custody, independently recoverable real keys and release acceptance remain
under [#82](https://github.com/Maeximilion/MaexSocial/issues/82) and
[#10](https://github.com/Maeximilion/MaexSocial/issues/10). G3 remains open.

## Open

Verify exact-head hosted Pilot CI and the complete Claude Messages API receipt against the live
main base. Resolve verified findings on this branch. The coordinator owns serial merge.

- Console — PowerShell.
- Folder — the registered `issue-285-encrypted-cold-pair/MaexSocial` task worktree.
- Start — `Set-Location -LiteralPath (Join-Path $env:USERPROFILE '.codex/worktrees/issue-285-encrypted-cold-pair/MaexSocial'); git fetch origin --prune; git status --short --branch`
- First message — Continue #285 from this record. Reconcile the hosted candidate, Claude API
  execution and current base before delivery.

## Lessons

The importer checks plaintext length and the completion digest emitted only after successful
GCM authentication. A partial stream can reach tmpfs without authorizing tar extraction.
Use an explicit Node `--require` argument for the injected expiry clock on Windows.
Keep the key value and generated fixture configuration out of runtime output and review
evidence. Code Autopilot and Caveman remain enabled. Advisory security checks require explicit
`/start` or `/task`.
