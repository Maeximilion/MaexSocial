# Handover 2026-11-21 — #155

## Status

Prepublication checkpoint (UTC) — 2026-11-21T14:56:43Z. The two elapsed assertions use monotonic time and retain the strict `< 6500 ms` bound. A failed timing assertion reports wall and monotonic elapsed milliseconds and identifies the response case where applicable. The delay settings and response override are reset in `finally` blocks.

Implementation/review — Codex implementation. Session model and effort were not independently verified. The repository configures the existing Claude Messages API workflow for Claude Opus 5.5, high effort, standard speed and `standard_only`. Hosted execution and coverage are pending publication.

## Artifacts

- Repository and task — [Maeximilion/MaexSocial #155](https://github.com/Maeximilion/MaexSocial/issues/155), [coordinator disposition](https://github.com/Maeximilion/MaexSocial/issues/155#issuecomment-7064321961).
- Branch — `dev-codex/155-monotonic-test-time`, based on `4391dd4e774304f34f834d679201ad747dcbe15f`.
- Work head before the handover commit — `8afe1463e398e8607046a7db61f960047fc33346`.
- PR — pending publication as the single normal PR against `main`, with `Closes #155`.
- Source — [OIDC test and clock control](../../../tests/pilot/oidc.test.ts).
- November 18, #153 / [PR #156](https://github.com/Maeximilion/MaexSocial/pull/156) — the **token plus JWKS budget** subtest failed its wall-clock assertion even though the entire subtest took 5183.676 ms. A subsequent isolated control passed 9/9 and the same subtest took 5701.136 ms. See the [original observation](https://github.com/Maeximilion/MaexSocial/issues/155) and [delivery evidence](2026-11-18-business-facts.md).
- November 21, #169 / [PR #171](https://github.com/Maeximilion/MaexSocial/pull/171) — the distinct **provider errors and deadlines** subtest failed its wall-clock assertion after a retained-volume restart, with 5376.429 ms reported for the whole subtest. An isolated uninstrumented repeat reported 5374.406 ms for the same failing subtest. A later paired control passed and recorded 5014/5014 ms for the final partial-response case and 5013/5013 ms for the token/JWKS case. See the [recurrence receipt](https://github.com/Maeximilion/MaexSocial/issues/155#issuecomment-7064165910) and [delivery evidence](2026-11-21-approval-preview.md).

| Executed check | Observed result |
| --- | --- |
| `npm ci`, `npm run pilot:build` | Passed with Node 24.22.2 and npm 11.19.1. An initial npm bootstrap attempt used the host's Node 26/npm 12, which rejected its forwarded `allow-scripts` option. The project has the same dependency manifests and lockfile. |
| `node --test --test-name-pattern '^elapsed deadline uses monotonic time across wall-clock changes$' dist/pilot/tests/pilot/oidc.test.js` | Passed 1/1 without a fixture or provider request. A temporary compiled copy using the old wall-clock predicate failed the same test at 6499 ms monotonic and 10000 ms wall. The corrected check accepts 6499 ms and rejects exactly 6500 ms even when the wall delta is negative. |
| `npm run pilot:up`, `npm run pilot:migrate -- up`, `-- down`, `-- up`, `node --test dist/pilot/tests/pilot/migration-empty.js` | Fresh isolated fixture and empty migration drill passed, including the 1/1 rollback control. |
| `npm run pilot:test` | Full local pilot passed 28/28. The two affected nested subtests passed with whole-subtest durations of 5687.462 ms (token/JWKS) and 5395.179 ms (provider cases). |
| `npm run pilot:down`, `npm run pilot:up`, `node --test dist/pilot/tests/pilot/oidc.test.js`, `npm run pilot:down` | Targeted OIDC suite passed after restart (2/2 host, 10/10 isolated), with all three volume identities retained. Both affected nested subtests passed. The fixture stopped successfully. |
| `python scripts/check_repo.py`, `git diff --check` | Passed. |
| `python -m unittest discover -s tests -v` | Initial attempt failed with inherited Git command configuration in subprocesses (`GIT_CONFIG_VALUE_0` missing). A rerun without inherited command-line Git overrides in the test process, with the existing Gitleaks binary, ran 123 tests with zero failures and one Windows-specific skip. Commit and push hooks use the regular environment. |
| `node --test 'tests/*.test.cjs'` | Passed 20/20. |

## Decisions

The pinned Node runner measures the enclosing subtest with `hrtime`; the two inner assertions had used `Date.now()` for elapsed time. In both historical failures the enclosing monotonic interval was shorter than the inner wall-clock threshold. The failed runs never emitted the wall deltas, so the precise host or network event remains undetermined. The paired passing control only describes its own run. Fixing the elapsed measurement and retaining paired diagnostics resolves the bounded issue; protocol timestamps and product/IdP behavior retain their existing semantics. See the [pinned runner source](https://github.com/nodejs/node/blob/v24.22.2/lib/internal/test_runner/test.js).

## Gate

The [accepted local G2 scope](https://github.com/Maeximilion/MaexSocial/issues/15#issuecomment-6681723454) permits this fixture verification. The proposed close is for the test measurement issue and its evidence disposition. [G3](https://github.com/Maeximilion/MaexSocial/issues/16) and [G5](https://github.com/Maeximilion/MaexSocial/issues/18) each retain their own acceptance criteria. The coordinator owns candidate, review, merge and archive decisions.

## Open

Publish and attach the single normal PR. Verify the actual title/body/base/head and run the pinned Claude input preflight. Claude API execution, merge-candidate CI and merger verification are pending. After the actual merge, save and verify an independent restore of the original worktree, task Git and the exact fixture with its retained volumes. Return the private recovery path to the coordinator.

- Console — PowerShell.
- Folder/worktree — the checkout registered in Git for `refs/heads/dev-codex/155-monotonic-test-time`.
- Full start command — run from a MaexSocial checkout: `git worktree list --porcelain | ForEach-Object -Begin { $folder = $null } -Process { if ($_ -like 'worktree *') { $folder = $_.Substring(9) }; if ($_ -eq 'branch refs/heads/dev-codex/155-monotonic-test-time') { Set-Location -LiteralPath $folder } }; git status --short --branch`.
- First message — Continue only #155 and its one delivery PR. Read this handover and the coordinator's latest control, reconcile the actual head/base and CI/review/recovery state, then take the next unfinished step.

## Lessons

Use monotonic time for elapsed bounds and wall time for protocol dates or paired diagnostics. A clean suite or a passing historical control supplies no measurement from a previous failure. Code Autopilot and Caveman are the enabled canonical local skills. Advisory scans run on explicit `/start` or `/task` only. PR review follows the existing Claude API policy.
