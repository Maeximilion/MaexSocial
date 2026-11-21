# Handover 2026-11-21 — MS-009 local GBP counting fake

## Status

Delivery checkpoint at 2026-11-21T23:38:27Z. The earlier 22:07 UTC checkpoint is preserved in the delivered adapter and tests. Codex resumed the same task worktree with gpt-6.2-sol at high effort and fast-forwarded to current `main` before verification. The Claude API review and integration candidate CI are pending PR publication.

- Node 24.22.2 and npm 11.19.1: `npm run pilot:build` and `node --test dist/pilot/tests/pilot/fake-gbp.test.js` passed (3 tests). `node --test tests/*.test.cjs` passed (20).
- `python scripts/check_repo.py` passed. `python -m unittest discover -s tests` reproduced the earlier Windows Git fixture error, `missing config value GIT_CONFIG_VALUE_0`. Rerunning with `GIT_CONFIG_COUNT` unset only in the test process passed (129 discovered, 32 skipped).
- `npm run pilot:up`, `npm run pilot:migrate -- up`, `npm run pilot:migrate -- down`, `npm run pilot:migrate -- up` and `node --test dist/pilot/tests/pilot/migration-empty.js` passed on the isolated fixture. The full `npm run pilot:test` had 31 passed and one failed outer test. The unchanged PostgreSQL auth-throttle suite returned `Throttle unavailable` during its connection/process concurrency case and three later cases. All three fake tests passed in that run. `npm run pilot:down` stopped the fixture. The full suite restart drill was not run after the failure.

## Artifacts

- Repository and task — [Maeximilion/MaexSocial, MS-009 issue #199](https://github.com/Maeximilion/MaexSocial/issues/199).
- Branch — `dev-codex/199-local-handoff`. Work head before the handover commit — `28cc2988625de0f00b48ec9188f7ac90a71f6db1`. Tests covered the working-tree changes on that base.
- PR — not yet opened. The coordinator assigned this delivery the first publication slot against `main`.
- [Adapter](../../../tests/pilot/fake-gbp.ts), [tests](../../../tests/pilot/fake-gbp.test.ts) and [fixture and run commands](../../../ops/local/README.md).

## Decisions

Each actual create inserts one SQLite row in the existing provider-state directory. Acceptance commits before an optional simulated lost reply. Each row retains its script across reopen. Readback scopes by tenant, occurrence, attempt and location, with an optional exact resource name. The injected clock advances observations independently of polling. Duplicate creates remain observable.

## Gate

[Task 4](../../superpowers/plans/2026-11-05-ms-009-local-text-pilot.md#4-one-dispatch-claim-terminal-export-and-read-only-reconciliation) remains open. [#165](https://github.com/Maeximilion/MaexSocial/issues/165) owns worker policy and terminal export. [#166](https://github.com/Maeximilion/MaexSocial/issues/166) owns restore evidence. Actual Manager approval and Google access remain outside this local fixture.

## Open

Publish one normal PR against `main` after verifying the base and publication slot. Verify the Claude API review and candidate CI for that layer. The coordinator owns integration.

- Console — PowerShell.
- Folder — the `issue-199-local` worktree for `dev-codex/199-local-handoff`.
- Start command from any checkout of this repository — `$entry = git worktree list --porcelain | Select-String '^branch refs/heads/dev-codex/199-local-handoff$' -Context 2,0; Set-Location -LiteralPath ($entry.Context.PreContext[0] -replace '^worktree ', ''); git status --short --branch`.
- First message — Resume #199 from this handover. Find the PR by branch and verify the current base and review coverage.

## Lessons

The lost-reply test closes and reopens the database before polling, compares the database bytes before and after readback, and verifies the create count stays at one.
