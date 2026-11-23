# Handover 2026-11-23 — #291

## Status

Checkpoint (UTC) — 2026-11-23T00:54:18Z.
Offline quarantine revokes both AppDB session audiences before paired restore readiness.
The Windows Node 24.22.3 host ran the physical encrypted-pair drill and the disposable
quarantine regression on `c9d04b512e5c946e9ed1c3e6520fa9ad4856eff8`. Two previously
current bindings were revoked, two original revocation timestamps were preserved, and the
audit, source, separate control and archive authentication checks passed. The faulted import
had no readiness record. Incomplete history, restart and explicit reopen refusal passed.
The extended drill on the integrated work head was running at this checkpoint.
Implementation used Codex Sol 6.2 High. The Claude Messages API review was pending PR publication.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial)
- Task and issue — [#291](https://github.com/Maeximilion/MaexSocial/issues/291)
- Branch — `dev-codex/291-restore-revoke-sessions`
- Work head before this handover commit — `a78343a305078f30bb55f73a226c1677dd0d8ab3`
- Integration base — `09dea043f21c9c3b84d02fb0dc81a1e03530a0b1`
- PR — Pending at this checkpoint. The issue links the PR when published.
- Reproduction — [Offline restore session drill](../../../ops/local/README.md#restored-appdb-session-revocation-291)

## Decisions

Use the existing AppDB revocation field inside the owner-gated quarantine transaction.
Keep the two database imports and the readiness result shape compatible. The failure control is a
separate synthetic source with a database constraint that rejects the revocation write.

## Gate

This is bounded Task 5 evidence under [#166](https://github.com/Maeximilion/MaexSocial/issues/166).
G3 release acceptance, real identity and operating recovery remain under #166, #131 and #82.

## Open

Publish the serial PR from the confirmed base. Record the integrated drill, review receipt and
eligible candidate checks on the PR and hand over to the coordinator for merge.

- Console — PowerShell, in the attached `issue-291-restore-revoke-sessions` worktree.
- Start — `Set-Location -LiteralPath (Join-Path $env:USERPROFILE '.codex/worktrees/issue-291-restore-revoke-sessions/MaexSocial'); git status --short --branch`
- First message — Verify the #291 PR head, base, checks and complete Claude API review before merge handover.

## Lessons

The existing identity version guard also applies to synthetic fixtures. Seed sessions with the
current identity version so an unchanged source binding supplies meaningful positive control evidence.
