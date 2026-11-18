# Handover 2026-11-18 — #154

## Status

Prepublication checkpoint (UTC) — 2026-11-18T18:34:00Z. The internal throttle component, migration 006,
private fixture key and focused database tests are implemented. This record precedes the first normal PR.
Publication waits for #153's actual merge, integration of its migration 005 and fresh candidate checks.
Hosted CI, authentic current-head/base Claude API review, Root merge and final recovery remain pending.

Implementation/review — Codex implementation followed by the existing Claude Messages API workflow.
Actual local turn metadata reports `gpt-6-astra`, effort `high`, `service_tier: null`; no Fast setting or model
switch is claimed. Claude Opus 5.5/high/standard is configured by the unchanged repository policy, but no
review has executed for this delivery yet. The [accepted design/plan](https://github.com/Maeximilion/MaexSocial/issues/154#issuecomment-6987536506)
uses native Superpowers execution, without an additional Codex review.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial).
- Task — bounded Task 2A2 [#154](https://github.com/Maeximilion/MaexSocial/issues/154), child of #131.
- Branch — `dev-codex/154-auth-throttle`.
- Work head before the handover commit — `570d129c3aa479d119da3f194a3c82c6f228de97`, based on main
  `1cc71c2e0490eb66bca9e9d82e3e98ba2277a136`. That work head is pushed; publication/integration checks remain.
- PR — not yet opened. Open only after #153 merges and its main is integrated. Later CI/API/merge evidence
  belongs in issue/PR comments and private recovery, without result-only commits.
- Source — [internal server component](../../../apps/web/src/server/auth-throttle.ts),
  [migration](../../../db/migrations/006_auth_throttle.up.sql),
  [database tests](../../../tests/pilot/auth-throttle.test.ts),
  [separate process probe](../../../tests/pilot/auth-throttle-process.ts),
  [contract and limits](../../../ops/local/README.md#internal-accountsource-throttles-154).

Commands use standalone Node 24.22.2/npm 11.19.1 in ignored `work/runtime/`, not the host default Node.
The isolated pinned fixture has internal networks and no published ports. Secrets, test logs and the preserved
initial fixture stay in ignored `work/`. No dependency or lockfile change was required.

| Executed command | Actual result |
| --- | --- |
| `npm ci`, `npm run pilot:build` | Installed existing 96 packages; strict TypeScript passed |
| `node --test dist/pilot/tests/pilot/auth-throttle.test.js` | Initial RED found absent storage; implemented storage GREEN. Expanded suite found Unicode folding accepting a non-ASCII mailbox; ASCII validation before folding fixed it. Final focused run passed 10/10 inner checks |
| `npm run pilot:up`; `npm run pilot:migrate -- up`, `down`, `up` | Actual fresh disposable fixture and migration cycle passed |
| `node --test dist/pilot/tests/pilot/migration-empty.js` | Unknown-object refusal rolled back teardown; passed |
| `npm run pilot:test` | 25/25 passed, including existing real browser tests; production source at `e89872552b38fa48bd7c4be2a0456fb2fbf9b40f` |
| `npm run pilot:down`; `npm run pilot:up`; `npm run pilot:test` | 25/25 passed after actual retained-volume restart; exhausted throttle canary and key binding remained effective |
| `python -m unittest discover -s tests` with configured `MAEXSOCIAL_TEST_GITLEAKS` | 122 tests OK; one Windows-inapplicable filename test skipped |
| `node --test tests/*.test.cjs` | 20/20 passed |
| `python scripts/check_repo.py`; `git diff --check` | Passed including this handover |

The later test-only commit allows an already-expired restart canary to recover rather than assuming every
manual rerun happens within 15 minutes. Its strict build and focused suite passed. Final integrated candidate
coverage must be recorded separately after #153; earlier runs do not establish future-head CI/API coverage.

## Decisions

Root accepted a single transaction advisory lock `(154,1)`, true moving `(t-W,t]` windows, one post-lock
PostgreSQL timestamp, independent account/source charging on ordinary denial and commit before boolean result.
Keep only the newest L attempts per bucket, at most 4096 buckets overall. Fail closed on SQL/config/key/capacity
errors, with both changes rolled back. The small SQL helper supplies deterministic actual-predicate boundary
tests; the Node API takes no clock and is the only supported orchestration boundary.

Normalize bounded ASCII mailbox input before HMAC, validate and canonicalize trusted transport IPs, and use
flow/dimension domain separation. Account existence is never queried. The random private fixture key persists
across restart; a durable key binding rejects accidental rotation even after bucket cleanup. No public route,
provider/mail/credential/session action, proxy support, reset API or background cleanup is introduced.

The [contract](../../../ops/local/README.md#internal-accountsource-throttles-154) records global contention,
finite-capacity availability, ASCII mailbox scope and operation-driven physical deletion. PostgreSQL DELETE
does not securely erase heap/WAL/backups. Inactive expired rows persist until consumption or explicit cleanup;
product retention and a future timed cleanup obligation are preserved.

## Gate

The [accepted local G2 decision](https://github.com/Maeximilion/MaexSocial/issues/15#issuecomment-6681723454),
this issue and Root's technical disposition authorize this synthetic internal slice. It does not complete
public ACCESS-09, #131, #149's missing provider-generation guarantee, integrated Task 2 or G3/G5. No excluded
provider experiment was inspected or reconstructed. Real accounts, external product requests, deployment and
product spend remain outside scope. Root alone merges and verifies archival.

## Open

Wait for #153's merge, integrate main/migration 005, rerun changed/integrated
checks, and create/attach the single normal `Closes #154` PR. Verify complete actual Claude API review and
candidate CI; fix confirmed findings, then freeze source/title/body and send Root the final merge checkpoint.
After merge and the last fetch, preserve source, ignored files, task Git, runtime and volumes outside the
worktree, verify a usable restore and send Root the frozen recovery checkpoint. No second assignment.

- Console — PowerShell.
- Folder/worktree — `$env:USERPROFILE/.codex/worktrees/154-auth-throttle/MaexSocial`.
- Full start command — `Set-Location (Join-Path $env:USERPROFILE '.codex/worktrees/154-auth-throttle/MaexSocial'); $env:PATH=(Join-Path $PWD 'work/runtime/node-v24.22.2-win-x64')+';'+$env:PATH; git status --short; node --version; npm run pilot:build`.
- First message — Continue only #154 and its one PR from this handover and `work/154-plan/progress.md`.
  Reconcile Root's current control, #153 merge, actual head/base/checks and private runtime, then complete the
  next unfinished step. Preserve canonical clean main and unrelated work; do not start another task.

## Lessons

Code Autopilot and Caveman remain enabled at their canonical local locations; Superpowers supplies this
bounded design/plan/native execution and Ponytail the minimum implementation. Repository policy chooses
actual Claude API review instead of a separate Codex review. Security/quality advisory checks require explicit
`/start` or `/task`; neither was requested. The 7% admission threshold stops new work, not this admitted delivery.
Reject non-ASCII text before lowercasing: Unicode case folding can otherwise create an unintended ASCII alias.
