# Handover 2026-11-22 — MS-009 / #252

## Status

The private export implementation was rebased onto the verified #250 merge at
`7fb856db885c58b005360f979f9ba743172e6834`. The earlier isolated Windows pilot
on `43475cfefaa65872c03a94a6a5d71fd26b6679aa` passed 52/52 with the focused
export file passing 8/8. The export transaction now explicitly selects READ COMMITTED.
The delivery PR records the later checks and coverage on its published revision.

Implementation used Codex Sol 6.2 with high reasoning on the local host.
The Claude API review and hosted pilot evidence were pending when this record was written.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial)
- Task — [MS-009 / #252](https://github.com/Maeximilion/MaexSocial/issues/252)
- Branch — `dev-codex/252-private-terminal-export`
- Work head before the handover commit — `ece06269c3f3d80c817e51b91529ea92929d14af`
- PR — Pending when this record was written. The closing PR is linked from #252.
- Evidence — [Private export contract and focused command](../../../ops/local/README.md#private-terminal-text-export-252).

## Decisions

New approvals retain the grant status observed under the destination lock. A one-step loss
of access requires an active grant recorded at approval and the same approved destination.
Legacy approvals keep unknown grant status. They can qualify at their exact stored grant version.
The first export commits its audit and terminal state before returning text. A repeat rechecks
customer authority, the approving Manager, destination, revision and missing access.

## Gate

The evidence is scoped to an isolated synthetic transaction. [Task 4](https://github.com/Maeximilion/MaexSocial/issues/165)
retains the authenticated route, dispatch worker and integrated acceptance.
[G3](https://github.com/Maeximilion/MaexSocial/issues/16) remains open.

## Open

Verify the closing PR's authentic Claude API review, required checks and exact integration
candidate before coordinator merge. Keep the host fixture stopped after local verification.

- Console — PowerShell with pinned Node 24 and Docker.
- Worktree — The attached `issue-252-private-terminal-export` checkout.
- Start command — `Set-Location -LiteralPath (Join-Path $env:USERPROFILE '.codex/worktrees/issue-252-private-terminal-export/MaexSocial'); git status -sb`
- First message — Continue only MaexSocial #252. Verify the linked PR, current head and base, and preserve the private export scope.

## Lessons

Run the test through the normal isolated runner. The SQLite provider counter uses private
temporary storage under `/dev/shm` because the runner mounts its root and source read-only.
Keep the working Code Autopilot and Caveman configuration. The advisory check is explicit-only.
