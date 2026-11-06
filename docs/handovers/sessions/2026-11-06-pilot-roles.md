# Handover 2026-11-06 — MS-013 pilot roles

## Status

Stopped at (UTC) — 2026-11-06T00:02:42Z (first review checkpoint). On head `6774fd2`, repository checks, 20 Node tests and 85 of 86 Python tests passed (one platform skip). Codex → Claude review plus independent GPT-6 Astra/high. Both identified design gaps. [First Claude report](https://github.com/Maeximilion/MaexSocial/pull/106#issuecomment-6672792242). Final results are recorded on the PR.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial)
- Task — [MS-013 / #30](https://github.com/Maeximilion/MaexSocial/issues/30)
- Branch — `dev-codex/30-pilot-roles`
- Work head before the handover commit — `3a6eb06cfea5e93ae072176294412a94fc9a6c3b`
- Delivery — [PR #106](https://github.com/Maeximilion/MaexSocial/pull/106), open at this checkpoint
- Contract — [roles, invitations and ACCESS cases](../../17_ACCESS_SECURITY.md)

## Decisions

Separate Manager approval from customer-side export of that exact revision. DEV/Admin provisions account access. [Roles](https://github.com/Maeximilion/MaexSocial/issues/30#issuecomment-6671733744) · [Export](https://github.com/Maeximilion/MaexSocial/issues/30#issuecomment-6671746885) · [Hold](https://github.com/Maeximilion/MaexSocial/issues/30#issuecomment-6670980326)

## Gate

Keep #30 open. Maxi decides [G2](https://github.com/Maeximilion/MaexSocial/issues/15). [MS-009](https://github.com/Maeximilion/MaexSocial/issues/9) owns the executable mapping.

## Open

Verify final PR head, base, merge candidate, CI and both review outcomes. Then report to the coordinator and preserve the worktree and recovery proof before archival.

- Console — PowerShell
- Worktree — `$HOME/.codex/worktrees/30-pilot-roles/MaexSocial`
- Full start command — `Set-Location (Join-Path $HOME '.codex/worktrees/30-pilot-roles/MaexSocial'); codex`
- First message — Read this MS-013 handover and PR #106. Verify published evidence for the current head and coordinate the next action. Keep #30 open and wait for the coordinator's merge decision.

## Lessons

A pending identity and a verified identity need separate invitation paths. Test both orderings of revocation and acceptance. Code Autopilot and Caveman are enabled locally. Only an explicit /start or /task requests advisory checks.
