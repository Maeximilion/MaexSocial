# Handover 2026-11-18 — #153

## Status

Prepublication checkpoint (UTC) — 2026-11-18T18:33:00Z. The synthetic business-facts storage and protected list/detail views are implemented. Targeted actual HTTPS/PostgreSQL checks passed 8/8; keyboard navigation and visual inspection passed. Final complete pilot and retained-volume restart both passed 25/25. No PR has been opened; hosted CI, actual Claude API review, Root merge and final recovery remain pending.

Implementation/review — implementation followed by the existing Claude Messages API workflow. Actual session metadata confirms `gpt-6-astra`, effort `high`, `service_tier: null`; Standard was requested, with no Fast marker or model change claimed. The unchanged review policy configures Claude Opus 5.5/high/standard; no API execution or coverage is inferred from that configuration. Code Autopilot/Caveman and the relevant Superpowers planning/execution/testing steps were used inline.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial).
- Task — bounded Task 2C component [#153](https://github.com/Maeximilion/MaexSocial/issues/153), [admission](https://github.com/Maeximilion/MaexSocial/issues/153#issuecomment-6987410975).
- Branch — `dev-codex/153-business-facts`, based on main `1cc71c2e0490eb66bca9e9d82e3e98ba2277a136`.
- Work head before the handover commit — `886069166958e9665cbe513bf0650a6a24b0f5cc`. This is the complete implementation/test revision; the delivery commit adds documentation and plan progress only.
- PR — not yet opened. Publish one normal `Closes #153` PR after final checks. Later API/CI/merge receipts belong in comments and private recovery, without result-only source commits.
- Source — [renderer](../../../apps/web/src/routes/facts.ts), [migration](../../../db/migrations/005_business_facts.up.sql), [HTTPS/DB tests](../../../tests/pilot/facts.test.ts), [keyboard test](../../../tests/pilot/portal-keyboard.test.ts), [plan](../../superpowers/plans/2026-11-18-business-facts.md).

All JavaScript commands used the existing standalone Node 24.22.2/npm 11.19.1 copied into ignored `work/runtime/`. Docker Engine 29.9.2 runs the pinned internal-only fixture. Dependencies/lockfile are unchanged. Logs, screenshots and private fixture material stay in ignored `work/`. The initial RED fixture was stopped and preserved before a fresh full-migration fixture; both namespaces/volumes remain recoverable.

| Executed command | Observed result |
| --- | --- |
| `npm ci --ignore-scripts` | Passed; unchanged lockfile |
| `npm run pilot:build` | Final strict build passed; initial route-array parameter typing failure was corrected before targeted tests |
| `node --test dist/pilot/tests/pilot/facts.test.js` | Initial RED: HTTP 404 and absent table. Final 8/8 passed, including a nonempty approval-history canary and 1/6000/500 code-point bounds |
| `npm run pilot:up`, `pilot:migrate -- up`, `-- down`, `-- up` | Fresh isolated fixture and complete migration005 up/down/up passed |
| `node --test dist/pilot/tests/pilot/migration-empty.js` | Unknown-object rollback passed and retained the new facts table |
| `node --test dist/pilot/tests/pilot/portal-keyboard.test.js` | Passed; facts screenshot visually inspected |
| `npm run pilot:test` | First run 24/25: unchanged OIDC combined token/JWKS deadline test failed its `Date.now()-before < 6500` assertion (`oidc.test.ts:162`); that subtest's runner duration was 5183 ms. The actual Date.now difference was not logged. Cause remains unproven under [#155](https://github.com/Maeximilion/MaexSocial/issues/155); no OIDC code or timing bound was changed |
| `node --test dist/pilot/tests/pilot/oidc.test.js` | Isolated diagnostic control 9/9 passed, including the same deadline assertion |
| Final `npm run pilot:test`; `npm run pilot:down`, `npm run pilot:up`, `npm run pilot:test` | 25/25 passed before restart and 25/25 after restart with the same volumes retained |
| `python -m unittest discover -s tests` with configured `MAEXSOCIAL_TEST_GITLEAKS` | 122 tests OK, one Windows-inapplicable filename test skipped |
| `node --test tests/*.test.cjs` | 20/20 passed |
| `python scripts/check_repo.py`, `git diff --check` | Repository links, JSON/TOML, SVG and diff whitespace checks passed |

## Decisions

Root accepted the schema/test checkpoint before implementation. Reuse the protected request transaction and current identity/session/tenant/membership guards; no new authentication or authorization path. Resolve locations and maximum stored revision by the active tenant. A second membership and request selectors cannot change that scope. Empty own locations return an explanatory page; foreign/unknown locations deny equally.

Store only plain normalized fact text and provenance, positive revisions, composite tenant references and an explicit `synthetic_fixture` marker. The private owner insert trigger checks the active Manager/version under a shared membership lock, and ordinary SQL mutations are rejected. Historical confirmation survives later demotion/revocation and is never treated as current authority. The UI says **Simulated fixture confirmation** and **Not a real customer confirmation or permission to publish**. Application access is SELECT-only; no write route exists. The existing page renderer/escaping is reused.

Complete migration teardown refuses populated fixtures. Direct migration005 down loses fact history and is only a disposable-fixture rollback. The compatibility test compares actual existing domain/approval records after down/up and rolls the transaction back. No other domain records are removed. Migration006 and the internal throttle component belong to sibling #154, which integrates this delivery before its PR.

## Gate

The [accepted local G2 decision](https://github.com/Maeximilion/MaexSocial/issues/15#issuecomment-6681723454) and #153 authorize invented local facts and reads. #124 retains genuine fact confirmation, generated-claim provenance and approval; #131 retains real identity/lifecycle/MFA. [#155](https://github.com/Maeximilion/MaexSocial/issues/155) retains the separate unexplained timing observation and blocks G5; this delivery does not close it. Task 2 and G3/G5 remain open. No real customer, external product request, provider publication, deployment or new authority is delivered. Root alone owns serial merge and archive.

## Open

Publish the single normal PR and attach it to this chat; all required local checks and the six-section handover are complete. Verify metadata/Project, actual complete current-head/base Claude API evidence and actual merge-candidate CI. Freeze head/title/body and report to Root. After merge and the last fetch/fix, preserve source, Git metadata, ignored files, runtime and stopped fixture volumes outside this worktree, verify a usable restore, then let Root audit/archive.

- Console — PowerShell.
- Folder/worktree — `$env:USERPROFILE/.codex/worktrees/153-business-facts/MaexSocial`.
- Full start command — `Set-Location (Join-Path $env:USERPROFILE '.codex/worktrees/153-business-facts/MaexSocial'); $env:PATH=(Join-Path $PWD 'work/runtime/node-v24.22.2-win-x64')+';'+$env:PATH; git status --short; node --version; npm run pilot:build`.
- First message — Continue only #153 and its one PR from this handover and the private progress record. Reconcile Root control, Git head/base, actual local/CI/API evidence and recovery, then take the next unfinished step. Preserve sibling work and canonical main; no second task or own merge/archive.

## Lessons

An isolated positive control does not explain an intermittent timing failure; preserve both results and require full candidate checks. Fact reads need neither active Google grants nor current historical-confirmation membership authority, but they always require current reader authority. Synthetic provenance is consistency evidence, not customer approval. Code Autopilot and Caveman remain enabled from canonical local skills; PR reviews use only the actual Claude API workflow. Advisory checks run only on explicit `/start` or `/task`, neither invoked here. The quota threshold stops new intake, not completion of this admitted delivery.
