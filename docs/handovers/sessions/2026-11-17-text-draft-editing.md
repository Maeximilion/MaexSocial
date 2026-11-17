# Handover 2026-11-17 — Task 2C / #140

## Status

Prepared at (UTC) — 2026-11-17T17:25:28Z. Implementation and local checks complete; publication, current-candidate CI and Claude API review are next. This record precedes the PR and is not a merge or review verdict.

Implementation/review — Codex implementation → required Claude API review. Native implementer context verified `gpt-6-astra`, effort `high`, service tier null (no Fast override). API execution/settings and published review are not yet observed at this checkpoint. Root alone merges and archives after exact-candidate evidence and private recovery verification.

Local commands on the work tree committed as the work head below:

- Node 24.22.2 / npm 11.19.1; `npm ci` and `npm run pilot:build` passed.
- Fresh isolated `npm run pilot:up` and `npm run pilot:migrate -- up` passed. No schema change; destructive migration down was not repeated against populated data.
- Baseline `node --test dist/pilot/tests/pilot/portal.test.js` passed.
- New `drafts.test.js` first failed with the missing route (404), then its six subcases plus parent passed. A newly added leading-newline browser case failed before the textarea correction and passed afterward.
- `npm run pilot:test` final result: 16/16 top-level tests passed, including real isolated browser editing and persisted revision readback. Earlier runs exposed two invalid test seeds (expiry ordering and a management audience without its required binding); both were corrected without weakening database constraints. A build initially rejected `isWellFormed` under the existing TS library target; explicit Unicode validation preserved that target.
- `python scripts/check_repo.py` passed; `python -m unittest discover -s tests`: 122 tests passed with the configured Gitleaks, one Windows-inapplicable colon-filename test skipped (the initial run skipped 32 because the scanner was absent from the test PATH); `node --test tests/*.test.cjs`: 20/20 passed. Hosted checks remain required for the actual candidate.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial).
- Task — [#140](https://github.com/Maeximilion/MaexSocial/issues/140), bounded subset of [#124](https://github.com/Maeximilion/MaexSocial/issues/124).
- Branch — `dev-codex/140-text-draft-editing`.
- Work head before the handover commit — `01534c95282a3fda105ec42f7bac42a73dcd6d6c`.
- PR — not yet opened; open one normal PR with `Closes #140`, attach it to its originating chat, then verify live CI and API receipt.
- Code — [content](../../../apps/web/src/routes/content.ts), [protected mounts](../../../apps/web/src/server/customer.ts), [HTTPS/DB tests](../../../tests/pilot/drafts.test.ts), [keyboard test](../../../tests/pilot/portal-keyboard.test.ts).
- Private local evidence — ignored `work/140/` and `work/portal-preview/`; no fixture credentials, raw logs or machine-specific recovery paths are published.

## Decisions

Preserve the [Root-disposed domain contract](../../superpowers/plans/2026-11-06-task-2-deliveries.md#existing-text-editing-140): existing tenant draft only, exact three-field POST, 20 KiB only for editing, 1–1500 code points, immutable append and explicit 409 for stale revision IDs. Caller authority/session locks precede draft and sorted occurrence locks through commit. Future approval/claim implementations must retain this order.

Invalidate only affected unclaimed draft/approved/held/quarantined rows without attempts; only approved becomes draft. Preserve holds/quarantine, every claimed/terminal row and immutable history. Ordinary URLs remain text. No auth issuance, new draft/location, facts management, scheduling, approval, export or provider action. #139 owns its independent schema/OIDC files, untouched here.

## Gate

The [accepted G2 decision](https://github.com/Maeximilion/MaexSocial/issues/15#issuecomment-6681723454) permits this isolated synthetic component. Seeded sessions/current identity and negative-control approval rows do not prove real login, Manager MFA or approval. #124/#131, integrated Task 2/3 and G3/G5 remain open. The earlier unexplained browser observation #137 did not recur in these checks and remains open.

## Open

Push this branch, measure the complete intended input, create/attach the normal PR, then verify the actual current-head/base Claude API run and candidate CI. Fix concrete findings with normal pushes. Root owns merge; after merge prepare verified full private source/Git/runtime recovery and let Root preserve the native transcript and archive. Do not start another task in this chat.

- Console — PowerShell.
- Folder/worktree — the existing linked checkout selected by `git worktree list` for `dev-codex/140-text-draft-editing`.
- Full start command — `Set-Location ((git worktree list --porcelain | Select-String -Pattern '^worktree ' | ForEach-Object { $_.Line.Substring(9) } | Where-Object { (git -C $_ branch --show-current) -eq 'dev-codex/140-text-draft-editing' }) | Select-Object -First 1); git status --short; git rev-parse HEAD` (run from any MaexSocial checkout).
- First message — Continue only Issue #140 from this handover; inspect the current branch/PR and Root checkpoint before acting. Finish its current-candidate review/CI and private recovery, without adding auth, approval, export or another task.

## Lessons

An HTML textarea consumes one initial newline; emit a structural newline before escaped stored text and verify the actual browser value. PostgreSQL's text bound counts Unicode code points, unlike HTML maxlength's UTF-16 units. Separate valid sessions/connections and observed PostgreSQL blockers prove concurrency; timing sleeps alone do not.

Code Autopilot and Caveman remain enabled, with bounded plan execution and Ponytail implementation. The repository Claude API policy supersedes imported extra reviewer rounds. No advisory/security scan is implied; only explicit `/start` or `/task` requests trigger it. Preserve all local fixture data and other worktrees during recovery.


