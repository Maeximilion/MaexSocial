# Handover 2026-11-06 — maintenance #109

## Status

Stopped at 2026-11-06 00:29 UTC for the pre-publication checkpoint. The independent GPT-6 Astra/high reviewer reproduced two defects in the initial change. Local Git settings could alter the historical replay, and duplicate JSON keys could replace an overflow or truncation signal. The replay now pins the rendering settings. Both the response envelope and the nested result reject duplicate keys. The two ambiguous-response cases failed before the fix and passed afterward. Final-head review and hosted checks belong on the delivery PR.

## Artifacts

- Repository and task — [MaexSocial #109](https://github.com/Maeximilion/MaexSocial/issues/109). The [offline diagnosis](https://github.com/Maeximilion/MaexSocial/issues/109#issuecomment-6673074291) records the exact #106 base and head and the two historical failures.
- Branch — `dev-codex/109-compact-review`. Base `7287e0615772b5977b2cbdeb3347adba6695bb0e`. Work head before this record `d76d149dc08b4c895a929720e77912d026325722`. PR pending at this checkpoint. Find the delivery and resulting checks on #109.
- Implementer and reviews — Codex implemented. GPT-6 Astra/high covers the full final diff before publication. The default workflow skips a PR that changes its own workflow or API client. Persist the resulting skip separately from the independent review.
- Local evidence — the initial implementation passed 19 focused tests, the repository check and 20 Node tests. The historical test recreated 49,210 escaped bytes across eight files and 15 hunks, passed the entire patch to a mocked transport and exercised the publisher with a synthetic zero-finding response.

## Decisions

Keep the complete historical diff in one request. Automatic reviews return findings and an overflow flag. The publisher renders the main comment from validated findings, including their locations. Manual PR requests retain their written answers. Missing or clipped input, overflow and failed inline placement remain visible. The single-request, cost, trust and output limits still apply. See [review operations](../../08_EVALS.md#advisory-pr-reviews).

## Gate

Foundation workflow only. The two [#106 failures](https://github.com/Maeximilion/MaexSocial/issues/30#issuecomment-6672975569) have no final advisory verdict. Offline evidence cannot determine the rejected predicate, exact stop reason or whether a future provider response would fit.

## Open

Verify the full final-head checks and independent review, then publish the normal PR and report its status to the coordinator. The coordinator owns the disposition of #106. Keep all provider calls, retries and product changes outside this delivery.

- Console — PowerShell
- Folder — `$HOME/.codex/worktrees/109-compact-review/MaexSocial`
- Start command — `Set-Location (Join-Path $HOME '.codex/worktrees/109-compact-review/MaexSocial'); codex`
- First message — Read this handover and #109, verify the task branch, delivery PR, exact-head Astra review and CI, then report the next authorized step to the coordinator.

## Lessons

Measure the framed input separately from the provider output limit. Use fixed local diagnostics for future failures and preserve the uncertainty of historical notices.
