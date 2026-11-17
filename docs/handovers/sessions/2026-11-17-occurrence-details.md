# Handover 2026-11-17 — #151

## Status

Prepublication checkpoint (UTC) — 2026-11-17T19:34:38Z. The bounded read-only occurrence route, draft destination links and return navigation are implemented. Targeted real HTTPS/PostgreSQL checks and the full local pilot passed; retained-volume restart validation passed 24/24. This record precedes the first PR. Hosted CI, actual Claude API review, merge and final recovery remain pending.

Implementation/review — Codex implementation followed by the existing Claude Messages API workflow. Actual session metadata confirms `gpt-6-astra`, effort `medium`, `service_tier: null`; Standard was requested and no Fast marker or model change is claimed. Claude Opus 5.5/high/standard is configured by the unchanged repository policy; actual execution and head/base coverage are pending, not inferred from local checks.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial).
- Task — bounded Task 2C component [#151](https://github.com/Maeximilion/MaexSocial/issues/151), [admission](https://github.com/Maeximilion/MaexSocial/issues/151#issuecomment-6958477172).
- Branch — `dev-codex/151-occurrence-details`.
- Work head before the handover commit — `10d799bc87af864294d2cc1b79d5d4560ea7daa8`, on integrated main `9acf86c75b31ece9f35117bcd60edd67d52d3a0c`. Source tests ran on this implementation tree; subsequent changes are only focused status/work-package/handover documentation.
- PR — not yet opened. Opening the single normal delivery PR is the next publication step after local verification. Later CI/API/merge evidence belongs in comments and private recovery, without result-only commits.
- Source — [detail renderer](../../../apps/web/src/routes/content.ts), [protected route](../../../apps/web/src/server/customer.ts), [focused HTTPS/DB tests](../../../tests/pilot/occurrences.test.ts), [keyboard navigation](../../../tests/pilot/portal-keyboard.test.ts).

All JavaScript commands use standalone Node 24.22.2/npm 11.19.1 copied into ignored `work/runtime/`; the host's default Node is not used. Docker Engine 29.9.2 runs the repository-pinned internal-only fixture with a fresh namespace. The lockfile, dependencies and migrations are unchanged. Private screenshots/logs remain in ignored `work/`.

| Executed command | Observed result |
| --- | --- |
| `npm ci` | 96 packages installed; unchanged lockfile |
| `npm run pilot:build` | Strict TypeScript passed |
| `npm run pilot:up`, `npm run pilot:migrate -- up` | Fresh isolated fixture and existing migrations passed |
| `node --test dist/pilot/tests/pilot/occurrences.test.js` | 5/5 inner checks passed on real HTTPS/PostgreSQL |
| `npm run pilot:test` | 24/24 passed, including real keyboard navigation; occurrence screenshot visually inspected |
| `npm run pilot:down`, `npm run pilot:up`, `npm run pilot:test` | 24/24 passed with the existing volumes retained |
| `python -m unittest discover -s tests` | Initial run: 122 tests OK with 32 skipped without Gitleaks on the test path. Final run with installed Gitleaks 8.30.1 via `MAEXSOCIAL_TEST_GITLEAKS`: 122 tests OK, one Windows-inapplicable filename test skipped |
| `node --test tests/*.test.cjs` | 20/20 passed |
| `python scripts/check_repo.py`, `git diff --check` | Repository links, JSON/TOML and SVG checks passed; diff whitespace check passed |

## Decisions

Reuse the existing customer transaction and current session/identity checks. Resolve by active `tenant_id` plus occurrence ID and join the location on both tenant and location ID. A second membership never changes the active tenant. Malformed UUIDs and unknown/foreign valid IDs return the existing generic denial; request role/tenant/subject values grant nothing.

The detail shows stored status, the occurrence destination rather than draft initial location, the original UTC instant and local date/time formatted with standard `Intl.DateTimeFormat` and the saved timezone. Winter, summer and repeated DST wall-time assertions preserve explicit UTC disambiguation. Existing HTML escaping and page structure are reused. GET leaves domain rows unchanged; inherited session activity updates remain allowed. No approved text/revision, approval controls, schedule editing, attempts, export, provider result or delivery mutation is added.

## Gate

The [accepted G2 local implementation decision](https://github.com/Maeximilion/MaexSocial/issues/15#issuecomment-6681723454) and #151 authorize this synthetic local read slice. #124 retains its remaining content/approval flow; #131 retains actual identity/lifecycle/MFA and the [current-enrollment/recovery-generation evidence gap](../../security/identity-generation-evidence.md). Task 2 and G3/G5 remain open. No external publication, live customer, deployment or product spending is authorized. Root owns serial merge and archive decisions.

## Open

Publish one normal `Closes #151` PR and attach it. Verify metadata/Project, actual complete current-head/base Claude API review and all required merge-candidate CI. Send evidence to Root for merge. After the last fetch/fix, preserve source, Git metadata, ignored files, runtime and retained fixture state outside the worktree and verify an independently usable restore before Root archives this chat.

- Console — PowerShell.
- Folder/worktree — `$env:USERPROFILE/.codex/worktrees/151-occurrence-details/MaexSocial`.
- Full start command — `Set-Location (Join-Path $env:USERPROFILE '.codex/worktrees/151-occurrence-details/MaexSocial'); $env:PATH=(Join-Path $PWD 'work/runtime/node-v24.22.2-win-x64')+';'+$env:PATH; git status --short; node --version; npm run pilot:build`.
- First message — Continue only #151 and its one delivery PR from this handover. Reconcile Root's current control, Git head/base, actual local/CI/API evidence and private recovery, then perform the next unfinished step. Preserve other work and keep canonical main clean; do not begin another task.

## Lessons

Code Autopilot and Caveman remain enabled from their canonical local copies; Ponytail supplies the minimal implementation workflow. No separate planning or Codex review round is needed. The real browser fixture proves keyboard navigation and observed customer-only requests; synthetic AppDB sessions do not prove public identity lifecycle or a provider publication outcome. Security/quality advisory checks are only invoked by explicit `/start` or `/task`; neither was requested. The remaining-quota admission threshold does not pause this existing delivery.


