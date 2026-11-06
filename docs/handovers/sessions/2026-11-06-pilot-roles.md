# Handover 2026-11-06 — MS-013 pilot roles

## Status

Stopped at (UTC) — 2026-11-06T00:02:42Z (documentation checkpoint). Codex updated the pilot access contract. On the first PR head, repository checks and all 20 Node tests passed. The Python suite ran 86 tests with one platform skip using the configured Gitleaks executable. After the review corrections, repository validation passed again. The final integration run and both final reviews are pending at this checkpoint.

Implementation/review — Codex → Claude review, with a separate GPT-6 Astra/high reviewer. The first independent review identified stale case lists, pending signup credentials and a revocation race. The [first Claude API review](https://github.com/Maeximilion/MaexSocial/pull/106#issuecomment-6672792242) identified first-Manager provisioning, Manager revocation and the missing direct hold citation. The PR records final dispositions.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial)
- Task — [MS-013 / #30](https://github.com/Maeximilion/MaexSocial/issues/30)
- Branch — `dev-codex/30-pilot-roles`
- Work head before the handover commit — `3a6eb06cfea5e93ae072176294412a94fc9a6c3b`
- Delivery — [PR #106](https://github.com/Maeximilion/MaexSocial/pull/106), open at this checkpoint
- Contract — [roles, invitations and ACCESS cases](../../17_ACCESS_SECURITY.md)

## Decisions

Only a Manager of the target customer may approve. A Manager or Employee may export the exact approved revision when Google access is unavailable before dispatch. DEV/Admin provisions customer access separately. An audited, targeted pre-dispatch hold requires fresh MFA. [Roles](https://github.com/Maeximilion/MaexSocial/issues/30#issuecomment-6671733744) · [Export](https://github.com/Maeximilion/MaexSocial/issues/30#issuecomment-6671746885) · [Hold](https://github.com/Maeximilion/MaexSocial/issues/30#issuecomment-6670980326)

## Gate

Keep #30 open for remaining access-design dispositions. The coordinator decides the serial merge. [G2](https://github.com/Maeximilion/MaexSocial/issues/15) requires separate owner acceptance. [MS-009](https://github.com/Maeximilion/MaexSocial/issues/9) owns the executable mapping. All product scenarios remain planned.

## Open

Verify final PR head, base, merge candidate, CI and both review outcomes. Then report to the coordinator and preserve the worktree and recovery proof before archival.

- Console — PowerShell
- Worktree — `$HOME/.codex/worktrees/30-pilot-roles/MaexSocial`
- Full start command — `Set-Location (Join-Path $HOME '.codex/worktrees/30-pilot-roles/MaexSocial'); codex`
- First message — Read this MS-013 handover and PR #106. Verify published evidence for the current head and coordinate the next action. Keep #30 open and wait for the coordinator's merge decision.

## Lessons

A pending identity and a verified identity need separate invitation paths. Test both orderings of revocation and acceptance. Code Autopilot and Caveman are enabled locally. Only an explicit /start or /task requests advisory checks.
