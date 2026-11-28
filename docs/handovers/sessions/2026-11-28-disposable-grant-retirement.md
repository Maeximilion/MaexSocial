# Handover 2026-11-28 — G3 Task 5, #310

## Status

Local verification finished at 2026-11-28T13:23Z. Node 24.22.2 and npm 11.19.1 built the
pilot. The integrated base was `a089ac569f659fcd0d3265f830dc1dcc2d571d42`. The six ordinary dispatch, stop, reconciliation, worker wake, fake and terminal
export files passed (10 outer tests). The predecessor audit-retention drill passed across restart. Repository validation passed. Python ran 134 tests
with 32 skips and Node foundation tests passed 20/20.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial).
- Task — [#310](https://github.com/Maeximilion/MaexSocial/issues/310) within [#166](https://github.com/Maeximilion/MaexSocial/issues/166).
- Branch — `dev-codex/310-disposable-grant-retirement`.
- Work head before the handover commit — `f9527d83bd0e6d7f09d18a09509f7a8bafedb81c`.
- Implementer — Codex, gpt-6.2-astra with High reasoning. At this pre-publication checkpoint, automatic Claude API review and hosted candidate CI are pending. The PR linked from #310 carries their current receipts.
- [Reproduction commands](../../../ops/local/README.md#disposable-grant-retirement-310) and [executable drill](../../../tests/pilot/grant-retirement.ts).

## Decisions

The dedicated fixture locks the current location through each fake call. A version-bound
digest verifies private file contents. The app DB role cannot read the verifier.
Ordinary runners lack the private mount. No raw material enters the fake's call record.

Original A had one create and one attempt. Substituted bytes left a different committed
attempt with zero creates even after restart. The stale approval had zero attempts. The
old grant's two readbacks both preceded revocation. Subsequent wakes reported unknown.
Independent B and reissued A each had one create and remained readable after removal.

The DB clock bracketed commit within 2.240 ms. Denial and the physical presence check
completed within 1,129.273 ms of the pre-commit sample. A fresh runner exercised a
wrong-store refusal, a failed digest check and safe retry. File absence was observed
within 10,406.641 ms of that sample. At the simulated 24-hour observation the old file
was absent, with two live files present. The drill verified removal of its temporary
directory. Standard shutdown stopped the containers and retained disposable volumes.

## Gate

This is on-demand local evidence for the grant subcase. Integrated [G3 Task 5](https://github.com/Maeximilion/MaexSocial/issues/166)
and [G3](https://github.com/Maeximilion/MaexSocial/issues/16) remain open. Deployed
scheduling, credential custody, provider consent and media erasure remain outside the drill.

## Open

Publish the normal PR on the integrated base and report current
Claude, candidate CI and thread evidence. The coordinator owns integration.

Console — PowerShell. Select `$env:USERPROFILE/.codex/worktrees/issue-310-disposable-grant-retirement/MaexSocial`
with `Set-Location`, then run `git status --short --branch`.
First message — Continue #310 from this handover on its confirmed serial base.

## Lessons

Authority denial, the persistent fake's counters and direct file absence provide separate
observations of the same grant version.
