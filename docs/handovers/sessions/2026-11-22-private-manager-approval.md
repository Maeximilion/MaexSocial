# Handover 2026-11-22 — #208

## Status

The private approval transaction and its PostgreSQL fixture tests are complete on the verified #225 base. The delivery PR and its Claude API review are pending at this checkpoint. Implementation used local Codex gpt-6.2-sol with high reasoning and danger-full-access/never. The turn did not expose an explicit speed tier.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial)
- Task — [#208, immutable Manager approval](https://github.com/Maeximilion/MaexSocial/issues/208)
- Branch — `dev-codex/208-approval-record`
- Work head before the handover commit — `59e4f9ec6798bcf0d2061669a08ec1ea0afc8ba3`
- PR — pending at this checkpoint
- [Private entry point](../../../apps/web/src/routes/content.ts), [migration](../../../db/migrations/007_approval_destination.up.sql) and [fixture test](../../../tests/pilot/approval.test.ts)

| Local command | Observed result |
| --- | --- |
| `npm.cmd ci --offline --no-audit --no-fund`, `npm.cmd run pilot:build` | Strict TypeScript passed with cached Node 24.22.2 and npm 11.19.1. |
| `npm run pilot:up`, `npm run pilot:migrate -- up`, `npm run pilot:migrate -- down`, `npm run pilot:migrate -- up`, `node --test dist/pilot/tests/pilot/migration-empty.js` | Fresh isolated fixture, full migration drill and rollback guard passed on the earlier base. #225 does not touch migrations. |
| `node --test dist/pilot/tests/pilot/approval.test.js` | 8 passed in the pinned Node runner. Retries converge, stale bindings deny, a first-committed membership withdrawal denies the waiting approval, failure rolls back both the approval and session refresh, and attempt/reservation counts stay at zero. |
| `npm.cmd run pilot:test` | 36 passed and two existing browser checks failed on this work head. The clean base reproduced the same high-ACR SSO OTP stage tracked by [#222](https://github.com/Maeximilion/MaexSocial/issues/222). The keyboard test reached the draft-list URL and timed out waiting for the New draft link. It passed on the isolated clean base. |
| `node --test dist/pilot/tests/pilot/portal-keyboard.test.js` | Passed on the same work head after restarting its retained isolated fixture. The earlier timeout remains unexplained. |
| `python scripts/check_repo.py`, Python unittest discovery and `node --test tests/*.test.cjs` | Repository check passed. Windows Python discovery ran 129 tests with 32 platform skips after removing inherited Git config overrides from that test process. Node metadata tests passed 20/20. |

## Decisions

Reuse existing current-customer and bound-CSRF checks. Lock the draft, occurrence and destination before final validation. Keep the location label and exact PostgreSQL instant in the snapshot. Migration 007 leaves legacy destination labels null. A retry can return the existing ID only for the same current Manager grant and exact proposal before any attempt.

## Gate

Bounded G2 [owner acceptance](https://github.com/Maeximilion/MaexSocial/issues/15#issuecomment-6681723454) covers this isolated pilot. [#223](https://github.com/Maeximilion/MaexSocial/issues/223) retains authenticated approval and reapproval after [#131](https://github.com/Maeximilion/MaexSocial/issues/131). G3 and G5 remain open.

## Open

Verify the delivery PR's current required CI and authentic Claude API coverage. Main owns serial integration and the merge decision.

- Console — PowerShell.
- Worktree — `$env:USERPROFILE/.codex/worktrees/issue-208-approval-record/MaexSocial`.
- Start — `Set-Location (Join-Path $env:USERPROFILE '.codex/worktrees/issue-208-approval-record/MaexSocial'); git status --short --branch; gh pr view`.
- First message — Resume #208 in its worktree and verify current coordinator control, PR head, base, checks and Claude API evidence.

## Lessons

The initial strict build exposed the missing private entry points. The first extended regression run exposed an incorrect test SQL parameter count. The corrected run observed real PostgreSQL blockers. The earlier full pilot on base 00a73d4 passed 37/37. The later Windows keyboard timeout occurred after the initial dashboard and workspace switch passed. It differs from [#137](https://github.com/Maeximilion/MaexSocial/issues/137), which occurred at the first dashboard title. Code Autopilot and Caveman remain enabled.
