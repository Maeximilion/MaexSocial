# Handover 2026-11-17 — Task 2C / #144

## Status

Prepared at (UTC) — 2026-11-17T18:16:22Z. Implementation and targeted/full local checks passed. First PR, actual candidate CI and genuine current-head/base Claude API review are next; no merge verdict is claimed.

Implementation/review — Codex implementation on native `gpt-6-astra`, effort `high`, service tier null (no Fast override) → required Claude API review. The existing workflow requests Opus 5.5/high/Standard; execution/result are pending. Root alone merges and archives after exact-candidate checks and independently verified private recovery.

Local validation on the source committed as the work head below:

- Node 24.22.2 / npm 11.19.1: `npm ci`, `npm run pilot:build` passed.
- Fresh isolated `npm run pilot:up`; `npm run pilot:migrate -- up`, `down`, `up`; `node --test dist/pilot/tests/pilot/migration-empty.js`: passed, no unrelated volume removed.
- `node --test --test-concurrency=1 dist/pilot/tests/pilot/drafts.test.js dist/pilot/tests/pilot/storage.test.js dist/pilot/tests/pilot/portal-keyboard.test.js`: draft 11/11 and storage 2/2 passed. The first browser run failed because the test navigated before the expected 400 document committed. Added an explicit navigation wait; rebuild and isolated keyboard rerun passed 1/1.
- `npm run pilot:test`: 18/18 top-level entries passed, zero skips, including actual isolated Keycloak/Chromium and the existing edit conflicts/approval-invalidation checks. The earlier #137 observation did not recur; it remains unresolved.
- `python scripts/check_repo.py`: passed. `python -m unittest discover -s tests` with `MAEXSOCIAL_TEST_GITLEAKS` set to the installed Git-config path (Gitleaks 8.30.1): 122 run, 121 passed, one Windows-inapplicable colon-filename case skipped. No scanner tests silently skipped. `node --test tests/*.test.cjs`: 20/20 passed. No extra advisory scan was invoked.
- Restart using `npm run pilot:down`, `npm run pilot:up`, `npm run pilot:test`: passed again, 18/18 with zero skips; existing volumes retained.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial).
- Task — [#144](https://github.com/Maeximilion/MaexSocial/issues/144), bounded child of [#124](https://github.com/Maeximilion/MaexSocial/issues/124).
- Branch — `dev-codex/144-create-drafts`.
- Work head before the handover commit — `a21e0cb69882178ae6ba11c15deb7d38c7abbfca`; base `6b5bb534feefe4d1cea8c058faf98c91076299c0`.
- PR — not yet opened; opening the single normal delivery PR is next after the final local checkpoint. Later run/merge IDs belong in PR/issue comments and private recovery, without repeated documentation-only review commits.
- Contract — [new draft flow and limits](../../superpowers/plans/2026-11-06-task-2-deliveries.md#new-text-drafts-144).
- Code/evidence — [content](../../../apps/web/src/routes/content.ts), [mounts](../../../apps/web/src/server/customer.ts), [migration](../../../db/migrations/004_draft_initial_location.up.sql), [HTTPS/DB tests](../../../tests/pilot/drafts.test.ts), [keyboard](../../../tests/pilot/portal-keyboard.test.ts), [storage](../../../tests/pilot/storage.test.ts). The local editor screenshot was visually inspected; literal text and initial context display correctly. Private fixture/screenshots remain ignored under `work/`.

## Decisions

Existing authority/session locks and the shared LF/Unicode text helper govern creation. Resolve the stored own-tenant location under a key-share lock, then insert exactly one generated draft and immutable revision 1 in the same transaction. Only the new POST gains the 20 KiB/three-field boundary alongside the editor. No Google grant or fresh MFA is needed for working drafts. Distinct valid submissions can create distinct drafts; there is no retry-deduplication promise.

Nullable `initial_location_id` records initial context. Old drafts stay null, and later occurrence/approval locations remain independent. Migration down discards this new metadata column; it is not lossless metadata rollback. The populated migration drill rolls back its whole transaction to preserve other fixtures. No schema/auth contract or #143-owned file was changed.

## Gate

The [accepted local G2 decision](https://github.com/Maeximilion/MaexSocial/issues/15#issuecomment-6681723454) authorizes invented data only. These seeded sessions establish domain behavior, not real login/MFA. #124 retains facts, scheduling and immutable Manager approval; #131 retains identity/MFA/lifecycle. Task 2, G3/G5 and #137 remain open. No external runtime service, credential change, deployment or product gate acceptance occurred.

## Open

Push this bundled delivery, measure complete PR input and verify actual Claude API/publisher execution and current candidate CI. Root serializes merge before #143 publication. Then preserve source/Git/index/untracked/ignored/nested content and a usable restored checkout outside the source; Root independently audits recovery and owns transcript capture/archive. Do not start another task.

- Console — PowerShell.
- Folder/worktree — existing linked checkout for `dev-codex/144-create-drafts` from `git worktree list`.
- Full start command — `Set-Location ((git worktree list --porcelain | Select-String -Pattern '^worktree ' | ForEach-Object { $_.Line.Substring(9) } | Where-Object { (git -C $_ branch --show-current) -eq 'dev-codex/144-create-drafts' }) | Select-Object -First 1); git status --short; git rev-parse HEAD` (from a MaexSocial checkout).
- First message — Continue only #144 from this handover and the verified Root checkpoint; inspect actual PR/head before finishing review/CI and recovery. Root alone merges and archives.

## Lessons

Browser response arrival precedes document navigation completion; wait for the resulting URL before the next navigation. Real database lock barriers and exact stored-row assertions prove complete simultaneous creation; HTTP status alone does not. Code Autopilot and Caveman remain enabled with Ponytail for bounded implementation. No extra reviewer loop or implicit `/start`/`/task` advisory scan is authorized.
