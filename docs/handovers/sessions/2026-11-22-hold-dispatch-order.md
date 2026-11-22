# Handover 2026-11-22 — #268

## Status

Local checkpoint at 2026-11-22T21:42:47Z. The work head below passed the build with Node 24.22.2
and npm 11.19.1. A fresh isolated fixture initialized from cached pinned images, passed HTTPS
readiness and committed the up migration. Four focused files passed with 32 inner tests
(dispatch 11, export 8, hold 6, reconciliation 7). `npm run pilot:down` left zero running
containers in the task's fixture project.

`python scripts/check_repo.py` passed and `node --test tests/*.test.cjs` passed 20/20. The
first `python -m unittest discover -s tests` produced two Git initialization errors. Python
environment mocks on Windows lost two empty injected Git config values. The same discovery
passed with 133 tests and 32 skips after preserving the inherited overrides in
`GIT_CONFIG_PARAMETERS` for the test process.

Implementation ran in Codex with GPT-6.2 Sol and high effort. Claude Messages API review and
hosted candidate CI were pending at this checkpoint.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial)
- Issue — [#268](https://github.com/Maeximilion/MaexSocial/issues/268)
- Branch — `dev-codex/268-hold-claim-order`
- Tested work head — `22599f766bd01d09d9ac6993978d40ee4c240427`
- Local base — `c58019a37608a9105d61ce198c21bfa6481a9e85`
- PR — pending at the local checkpoint
- Tests — [dispatch suite](../../../tests/pilot/dispatch.test.ts)

From the worktree root with the pinned runtime and an initialized fixture:

```text
npm run pilot:build
npm run pilot:up
npm run pilot:migrate -- up
node --test --test-concurrency=1 dist/pilot/tests/pilot/dispatch.test.js dist/pilot/tests/pilot/occurrence-hold.test.js dist/pilot/tests/pilot/occurrence-export.test.js dist/pilot/tests/pilot/reconcile.test.js
npm run pilot:down
```

## Decisions

The cases pause the winning operation before its real commit. A separate connection observes
the opposing PostgreSQL backend waiting on the winner, reads the pre-commit state, then lets
the transactions settle. The tests exercise the same due approved occurrence through the
private operations.

| Case | Occurrence and audit | Attempts | Fake creates |
| --- | --- | ---: | ---: |
| Hold commits first, A1 | `held`, one successful hold audit. Active Employee and Manager each receive `Denied` and no text after A1 loses Google access. | 0 | 0 |
| Independent A2 | Separate location grant in the same tenant remains eligible. A2 reaches `in_flight` with one claim audit and rejects a duplicate dispatch. | 1 | 1 |
| Dispatch commits first, A1 | Hold reports `in_flight`. After reopening the fake, readback confirms the original attempt and hold reports `confirmed`. One claim audit remains. | 1 | 1 |
| Stale proof, missing reason, audit failure | Each leaves the due occurrence `approved` with no audit or effect. A subsequent dispatch claims it once. | 0 before dispatch, 1 after | 0 before dispatch, 1 after |

## Gate

This verifies one bounded part of the [accepted Task 4 matrix](../../superpowers/plans/2026-11-05-ms-009-local-text-pilot.md#4-one-dispatch-claim-terminal-export-and-read-only-reconciliation).
[#165](https://github.com/Maeximilion/MaexSocial/issues/165) retains service wiring, authenticated
export and integrated acceptance. G3 remains open.

## Open

After the coordinator confirms the [#266](https://github.com/Maeximilion/MaexSocial/issues/266)
merge and publication base, verify the rebased branch, open the PR and record the current
Claude Messages API and candidate CI receipts there. The coordinator owns the merge.

- Console — PowerShell
- Folder — `.codex/worktrees/issue-268-hold-claim-order/MaexSocial` under the current user's home
- Start — `Set-Location (Join-Path $env:USERPROFILE '.codex/worktrees/issue-268-hold-claim-order/MaexSocial'); git fetch origin --prune; git status --short --branch`
- First message — Continue #268 from this checkpoint and verify the coordinator's base signal before opening the PR.

## Lessons

Keep a separate A2 location grant so A1's grant loss does not disqualify the independence control.
Use Code Autopilot for execution and Caveman for concise updates. Repository advisory checks run
only on explicit `/start` or `/task`.
