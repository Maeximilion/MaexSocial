# Handover 2026-11-23 — #280

## Status

Implementation checkpoint at 2026-11-22T23:16:42Z. The existing keyboard integration now proves one synthetic PLAN-01/03 journey. The worker used Codex Sol 6.2 with high reasoning. The existing Claude Messages API review and hosted candidate checks are pending at this checkpoint.

## Artifacts

- Repository and task — [Maeximilion/MaexSocial issue #280](https://github.com/Maeximilion/MaexSocial/issues/280).
- Branch — `dev-codex/280-customer-edit-to-result`.
- Work head before the handover commit — `2f4a3d1a3cf40a4bef69ac7414b2ed632e2c1d50`, based on `eb80475fc209ff5f09cb01f3c02bcaea2f6649f7` after [PR #281](https://github.com/Maeximilion/MaexSocial/pull/281). The #280 PR is pending at this checkpoint.
- Test — [isolated portal keyboard integration](../../../tests/pilot/portal-keyboard.test.ts).

## Decisions

Tenant A reads its fictional opening hours over HTTPS and saves distinguishable plain text as revision 3 through the protected draft editor. That POST returns 303. The existing stale-editor check still returns 409 and preserves the unsaved text. The protected occurrence GET shows the edited proposal, destination and due time.

The harness passes the rotated customer binding to the private proposal and approval operations. They resolve the current A Manager and the fixture's enrolled OTP proof. Private `claimDispatch` commits one attempt. The reopened SQLite fake records one create with the exact revision, occurrence, text and destination. Private `reconcileOccurrence` persists PROCESSING as pending and then uniquely matching LIVE as confirmed for that same attempt. The protected HTTPS GET returns 200 at each stage and displays the associated observation time.

| Observed effects | Tenant A | Independent tenant B control |
| --- | --- | --- |
| Approval and attempt | 1 each | 0 each |
| Fake creates after both GETs | 1 | 0 |
| Exports | 0 | 0 |

Fixture SQL supplies synthetic sessions, facts, draft-occurrence inputs and the local dispatch switch. The ordinary private operations produce the approval, attempt and results. The independent B occurrence and its audit counts stay unchanged.

## Gate

This covers the single local successful path in the [accepted PLAN-01/03 evidence map](../../superpowers/plans/2026-11-05-ms-009-pilot-evidence-map.md). [Real identity and MFA #131](https://github.com/Maeximilion/MaexSocial/issues/131), [authenticated approval integration #223](https://github.com/Maeximilion/MaexSocial/issues/223), [staging #82](https://github.com/Maeximilion/MaexSocial/issues/82) and [real provider verification #10](https://github.com/Maeximilion/MaexSocial/issues/10) stay in the open [G3 gate](https://github.com/Maeximilion/MaexSocial/issues/16).

## Open

Publish the focused PR on the verified base and obtain the existing [Claude API review and current integration-candidate checks](../../tooling/agent-workflow.md#pr-review-policy). Main owns the merge decision.

- Console — Windows PowerShell.
- Worktree and start command — `Set-Location (Join-Path $env:USERPROFILE '.codex/worktrees/issue-280-customer-edit-to-result/MaexSocial'); git fetch origin --prune; git status --short --branch`
- Resume from this record with issue #280, the verified PR head and base, and the actual review and CI statuses.

## Lessons

- Windows migration up/down/up and the focused portal test passed on [the initial test revision](https://github.com/Maeximilion/MaexSocial/commit/2a43c8c48a5c1e4c69447c1b39acedc793b83bf0). The first ordinary `npm run pilot:test` on the newly initialized fixture after the focused test and the full run after restarting with retained volumes each passed 57/57. The host used installed Node 24.22.3 and the pinned Node 24.22.2 runner with locally cached image digests.
- The unchanged draft edit and stale editor cases passed in both Windows phases. The intermittent [#233](https://github.com/Maeximilion/MaexSocial/issues/233) 403 was unobserved. The named two-dimension charging case for [#238](https://github.com/Maeximilion/MaexSocial/issues/238) passed in both phases. These are passing controls. Both diagnoses remain open.
- The integrated work head passed `npm run pilot:build` and the targeted portal, dispatch and reconcile modules, 3/3 outer tests. Foundation checks passed with 20 Node tests and 133 Python tests, including 32 Python skips. The disposable stack was stopped after verification.
