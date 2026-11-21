# Handover 2026-11-21 — #167

## Status

Pre-publication checkpoint at 2026-11-21T19:03:23Z. The decision packet is ready for Maxi. Its Markdown doctest passed all 25 steps on Windows. Repository checks passed, Python reported 129 tests with 32 skipped, and Node passed 20/20. The cases evaluate invented local records. Product runtime, provider access, purchases and gate acceptance are outside this delivery.

Codex prepared the examples and packet. The configured PR reviewer is Claude Opus 5.5 through the repository's Claude API workflow at high effort and standard speed. Actual review and hosted CI await the PR.

## Artifacts

- Repository and task — [Maeximilion/MaexSocial #167](https://github.com/Maeximilion/MaexSocial/issues/167).
- Branch — `dev-codex/167-offline-ai-decisions`.
- Work head before the handover commit — `bcc9fd797cf9b03fd1282394efdb06050e8611d2`.
- PR — pending the coordinator's publication window after #196.
- [Decision packet and executable examples](../../research/2026-11-21-product-ai-decision.md), [existing media evaluator](../../../scripts/media_evaluation.py) and [dated candidate evidence](../../research/2026-11-21-g4-video-candidate-terms.md).

## Decisions

Propose one conditional operator-only Runway trial for #11 or an explicit exclusion for this cycle. The candidate, input, operator authority, 60-credit generation cap, expiry and thresholds require a dated owner disposition. The evidence map reuses #190 and #191. Human approval and application authority remain separate from any model output.

## Gate

Keep [#167](https://github.com/Maeximilion/MaexSocial/issues/167) open for Maxi. G3 acceptance [#16](https://github.com/Maeximilion/MaexSocial/issues/16) and separate execution authority precede [#11](https://github.com/Maeximilion/MaexSocial/issues/11). [#99](https://github.com/Maeximilion/MaexSocial/issues/99) owns format and UPLOAD evidence, [#12](https://github.com/Maeximilion/MaexSocial/issues/12) owns any enabled operating envelope, and [#17](https://github.com/Maeximilion/MaexSocial/issues/17) retains G4 acceptance.

## Open

Verify the coordinator's publication window and base, then open the normal PR with Refs #167. Record the exact hosted review and integration evidence in GitHub. Maxi owns the candidate decision. The coordinator owns merge and archival.

- Console and folder — PowerShell in the worktree for `dev-codex/167-offline-ai-decisions`. From any checkout of this repository, run the following to select that exact worktree and check the examples.

~~~powershell
$worktreePath = git for-each-ref --format='%(worktreepath)' refs/heads/dev-codex/167-offline-ai-decisions
if (-not $worktreePath) { throw 'The issue 167 branch needs an attached worktree.' }
Set-Location -LiteralPath $worktreePath
git status --short --branch
python -m doctest docs/research/2026-11-21-product-ai-decision.md
~~~

- First message — Continue #167 from this handover. Read the latest coordinator control and GitHub issue/PR before acting. Verify the current head and base, outstanding review or publication step, and keep the decision with Maxi.

## Lessons

The Graphify index at `4f36d6fad83c236640b8fdd62d7eb1d772900423` predates the #190 evaluator and #191 packet. Local discovery used main at `72ebb5552829bca3968c0b19a290f3494bc737be`. Reuse the actual rights evaluator for negative rights evidence. A deterministic example or a read-only preview cannot prove a live approval, a provider's cleanup or a billable outcome.
