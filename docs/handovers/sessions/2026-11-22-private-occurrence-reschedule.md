# Handover 2026-11-22 — #211

## Status

Checkpoint at `2026-11-22T01:48:45Z`. The private reschedule transaction and its fixture checks are complete. The delivery PR is pending serial integration. Implementation used local Codex `gpt-6.2-sol`, reasoning `high` and `danger-full-access` / `never` on the task worktree. The turn did not expose an explicit speed tier. Claude API review is pending.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial)
- Task — [#211, invalidate an unclaimed approval when its destination or time changes](https://github.com/Maeximilion/MaexSocial/issues/211)
- Branch — `dev-codex/211-occurrence-reschedule`
- Tested work head before the handover commit — `bfc688ef53e362d92b0f0e5b5e0065db61f50f95`
- PR — pending at this checkpoint
- [Private entry point](../../../apps/web/src/routes/content.ts), [fixture checks](../../../tests/pilot/occurrence-reschedule.test.ts), and [contract](../../superpowers/plans/2026-11-06-task-2-deliveries.md#private-occurrence-reschedule-211)

| Local command | Observed result |
| --- | --- |
| `npm.cmd run pilot:build` | Strict build passed using cached Node 24.22.2 and npm 11.19.1. |
| `npm.cmd run pilot:up`, `npm.cmd run pilot:migrate -- up` | Fresh isolated fixture verified TLS and applied the existing migrations. This delivery has no migration. |
| `node --test dist/pilot/tests/pilot/occurrence-reschedule.test.js` | 6/6 in the isolated PostgreSQL runner at the tested work head. The test invokes the unmounted production function through a synthetic bound customer session. |
| `node --test --test-concurrency=1` with the reschedule, approval, draft and storage test files | 4/4 file entries on the implementation before the final fixture-only refinements. |
| `npm.cmd run pilot:test` | 39/40 initially. The existing draft route test intermittently received HTTP 403 for valid inputs. Three standalone draft runs compiled from the parent application source passed. The cause of the intermittent denial remains unconfirmed. |
| `npm.cmd run pilot:down`, `npm.cmd run pilot:up`, `npm.cmd run pilot:test` | 40/40 after restarting the same fixture with retained volumes. |
| `python scripts/check_repo.py`, `python -m unittest discover -s tests`, `node --test tests/*.test.cjs` | Repository check passed. Python ran 129 tests with 32 platform skips after clearing injected Git config from that test process. Node metadata tests passed 20/20. |

## Decisions

Match the supplied UTC instant to the local wall time using the existing display runtime. Accept both valid fold choices, reject gaps and preserve fractional precision. Lock the draft and occurrence before checking attempts. Changes detach eligibility in the same commit and preserve immutable approvals, occurrence identity, holds and quarantine.

## Gate

The accepted local G2 plan authorizes the synthetic fixture slice. [#223](https://github.com/Maeximilion/MaexSocial/issues/223) retains authenticated integration and reapproval after [#131](https://github.com/Maeximilion/MaexSocial/issues/131). G3 and G5 remain open.

## Open

After the coordinator releases the serial slot, publish the normal PR and verify required checks and authentic Claude API coverage of the current head and base. The coordinator owns integration and merge.

- Console — PowerShell
- Worktree — `$env:USERPROFILE/.codex/worktrees/issue-211-occurrence-reschedule/MaexSocial`
- Start — `Set-Location (Join-Path $env:USERPROFILE '.codex/worktrees/issue-211-occurrence-reschedule/MaexSocial'); git status --short --branch; gh pr view`.
- First message — Resume #211 in its worktree, verify coordinator control and the serial slot, and reconcile current PR evidence.

## Lessons

The claim test holds the occurrence row and commits an attempt after the reschedule starts waiting. The first attempt read must happen after that lock wait. Code Autopilot and Caveman remain enabled.
