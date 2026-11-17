# Handover 2026-11-17 - MS-010 Task 2A1 review corrections

## Status

Checkpoint (UTC): 2026-11-17T15:41:30Z. Codex implemented the three actual Claude API findings; no substitute review. Model setting not independently reverified. Local strict build, full pilot 13/13, Python 122 tests (one Windows colon-filename skip; configured Gitleaks), Node foundation 20/20, repository/anchor/whitespace checks passed. Fresh migration evidence remains from the unchanged schema at the [previous checkpoint](2026-11-17-synthetic-session-foundation.md).

## Artifacts

- Repository: [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial); issue [#117](https://github.com/Maeximilion/MaexSocial/issues/117), normal [PR #135](https://github.com/Maeximilion/MaexSocial/pull/135), attached to its creating chat.
- Branch: `dev-codex/117-customer-activation`; work head before handover commit: `a146c3c8ad893685676dc8fefa72be7c9c2207ac`. Base `bfad8dd1569dae2374fc271e627bf16fca991f3c` integrated normally. This head is the tested product source; the handover commit is documentation only.
- First real [API run](https://github.com/Maeximilion/MaexSocial/actions/runs/44115296971) and [complete receipt](https://github.com/Maeximilion/MaexSocial/pull/135#issuecomment-6952637790) cover `9d0b2c2e4cbbd8d424f640487c076bba1a3fa51c`, with three findings. That head's hosted checks passed. Corrected-head CI/API review is pending; PR receipts remain authoritative.
- Fixture `maex-pilot-a1d5ba468eb48a0f0339391c53676c16`; browser worker cleaned up. Private prior source/work/ledger backup is outside the worktree at `C:/Users/Maxi/.codex/backups/maexsocial-117-20261117-review-wait`; 99 files including the verified Git bundle were checked. Refresh recovery evidence for this head before archival; retained Docker volumes are not exported backups.

## Decisions

Tenant authority reads use `FOR SHARE`: independent members proceed while suspension/version updates wait. Tenant writers prelock their complete sorted tenant set exclusively; no later lock upgrade. Both reader/suspension commit orders, actual blocking PIDs, valid independent readers, stale sessions after reactivation and the existing switch/removal barriers pass. Logout reaches a served neutral page; the real keyboard test confirms cookie deletion. The contract anchor now matches its heading.

Regression history: the new tests first reproduced logout 404 and independent-reader lock timeout. A first barrier assertion incorrectly expected both MultiXact blockers simultaneously; it now observes/releases each actual blocker. A subsequent full parallel run exposed a separate test conflict: `storage.test.ts` calls migration down, which takes ACCESS EXCLUSIVE on all tables, while `session.test.ts`/`session-rotation.test.ts` hold transactions. PostgreSQL reported those specific table-lock cycles. Root authorized sequencing files through central `pilot:test`; local and CI share it, and explicit within-test concurrency and all migration guards remain. The corrected complete run passed 13/13. This is fixture isolation, not a claimed product deadlock fix.

## Gate

[Bounded G2/local acceptance](https://github.com/Maeximilion/MaexSocial/issues/15#issuecomment-6681723454) unchanged. [A1/A2/B/C ownership](../../superpowers/plans/2026-11-06-task-2-deliveries.md) retains #131 real identity/MFA/recovery and G3/G5 blocks. No public auth issuance, deployment, real account access or blocked IdP probe.

## Open

Measure the full corrected candidate, push normally, verify its complete CLI preflight, hosted checks and automatic Claude API receipt; address/resolve verified review threads and report to root. Root alone merges.

PowerShell start:

```powershell
Set-Location 'C:/Users/Maxi/.codex/worktrees/117-customer-activation/MaexSocial'
git status --short --branch
git fetch origin --prune
gh pr view 135 --repo Maeximilion/MaexSocial --json headRefOid,baseRefOid,statusCheckRollup
```

First message: Continue #117/PR135 from this checkpoint; verify final-head CI/API review, preserve A1 scope and #131 obligations, and report to root without merging.

## Lessons

Shared fixture DDL and request races must not run as unrelated parallel files. Keep real barrier concurrency and observe locks rather than infer them from sleeps. Code Autopilot/Caveman remain enabled; review feedback followed `superpowers:receiving-code-review`. Do not repeat, rephrase or delegate the blocked credential test.
