# Handover 2026-11-28 — G3 Task 5, #310

## Status

Local verification finished at 2026-11-28T13:28Z. Node 24.22.2 and npm 11.19.1 built the
pilot. The integrated base was `a089ac569f659fcd0d3265f830dc1dcc2d571d42`. On integrated revision `f9527d8`, the six ordinary dispatch, stop, reconciliation, worker wake, fake and terminal
export files passed (10 outer tests). The predecessor audit-retention drill passed across restart. Repository validation passed. Python ran 134 tests
with 32 skips and Node foundation tests passed 20/20.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial).
- Task — [#310](https://github.com/Maeximilion/MaexSocial/issues/310) within [#166](https://github.com/Maeximilion/MaexSocial/issues/166).
- Branch — `dev-codex/310-disposable-grant-retirement`.
- Work head before the handover commit — `649258ac4b7b4c42fc2a070b8ae8d4fce94640f9`.
- Implementer — Codex, gpt-6.2-astra with High reasoning. [PR #317](https://github.com/Maeximilion/MaexSocial/pull/317) carries current receipts. The [first Claude API run](https://github.com/Maeximilion/MaexSocial/actions/runs/46149427903) produced [two findings](https://github.com/Maeximilion/MaexSocial/pull/317#pullrequestreview-6098015520) on `138ac6b`. The work head fixes both. New-head coverage follows on the PR.
- [Reproduction commands](../../../ops/local/README.md#disposable-grant-retirement-310) and [executable drill](../../../tests/pilot/grant-retirement.ts).

## Decisions

The dedicated fixture locks the current location and its disposable verifier through each fake call. A second database session failed to acquire the verifier update lock during use. A version-bound
digest verifies private file contents. The app DB role cannot read the verifier.
Ordinary runners lack the private mount. No raw material enters the fake's call record.

Original A had one create and one attempt. Substituted bytes left a different committed
attempt with zero creates even after restart. The stale approval had zero attempts. The
old grant's two readbacks both preceded revocation. Subsequent wakes reported unknown.
Independent B and reissued A each had one create and remained readable after removal.

The DB clock bracketed commit within 3.131 ms. Denial and the physical presence check
completed within 1,024.962 ms of the pre-commit sample. A fresh runner exercised a
wrong-store refusal, a failed digest check and safe retry. File absence was observed
within 8,985.310 ms of that sample. The deadline check returned not due one microsecond before the
persisted 24-hour cutoff, overdue at the cutoff with the file present, and absent at that
same cutoff after purge and restart. Both live files remained present. The drill verified removal of its temporary
directory. Standard shutdown stopped the containers and retained disposable volumes.

## Gate

This is on-demand local evidence for the grant subcase. Integrated [G3 Task 5](https://github.com/Maeximilion/MaexSocial/issues/166)
and [G3](https://github.com/Maeximilion/MaexSocial/issues/16) remain open. Deployed
scheduling, credential custody, provider consent and media erasure remain outside the drill.

## Open

Verify the new Claude review, candidate CI and threads before serial handover. The coordinator owns integration.

Console — PowerShell. Select `$env:USERPROFILE/.codex/worktrees/issue-310-disposable-grant-retirement/MaexSocial`
with `Set-Location`, then run `git status --short --branch`.
First message — Continue #310 from this handover on its confirmed serial base.

## Lessons

Authority denial, the persistent fake's counters and direct file absence provide separate
observations of the same grant version.
