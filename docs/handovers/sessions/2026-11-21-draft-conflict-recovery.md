# Handover 2026-11-21 — #187

## Status

Pre-publication checkpoint (UTC) — 2026-11-21T18:39:57Z. The local pilot shows the saved revision and the submitted proposal when a stale edit returns HTTP 409. The original implementation passed the strict TypeScript build, an empty database migration round trip and four focused draft, keyboard, facts and occurrence suites. The same four suites passed after restarting with the same fixture volumes. The four source and test files are byte-identical on the delivery branch after the #193 base update.

Codex implemented the change. The delivery session used Sol 6.2 at high effort. The repository's Claude API review (Opus 5.5, high, standard) and hosted checks are pending at this checkpoint.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial)
- Task — [#187](https://github.com/Maeximilion/MaexSocial/issues/187)
- Branch — `dev-codex/187-draft-conflict-delivery`
- Work head before the handover commit — `1164aeab6d99ed5b64f2848ea2bfae56af292952`
- Locally tested implementation — `ae87b52e27b2e8236ade40b1d7a9578bad66bd1b` on `bf879e69193be6ea1f10fe27ede482d47e2904b2`. Delivery base — `1daddca907772b4cce720b39e353624cc6059450`.
- PR — Pending at this checkpoint. Follow the closing PR from [#187](https://github.com/Maeximilion/MaexSocial/issues/187) for exact-head checks and review evidence.
- [Conflict view](../../../apps/web/src/routes/content.ts), [locked draft write](../../../apps/web/src/server/customer.ts), [database coverage](../../../tests/pilot/drafts.test.ts) and [keyboard coverage](../../../tests/pilot/portal-keyboard.test.ts).

## Decisions

Use the authorized, locked revision read during the save. Roll back the stale edit before rendering the saved and submitted text in escaped, read-only fields. The current editor opens by GET and every later deliberate save goes through the existing revision check. Invalid stale input keeps the generic conflict response.

## Gate

The [bounded G2 decision](https://github.com/Maeximilion/MaexSocial/issues/15#issuecomment-6681723454) covers synthetic local validation. [#179](https://github.com/Maeximilion/MaexSocial/issues/179) delivered the existing text validation. [#124](https://github.com/Maeximilion/MaexSocial/issues/124), [#131](https://github.com/Maeximilion/MaexSocial/issues/131) and [G3](https://github.com/Maeximilion/MaexSocial/issues/16) retain their remaining acceptance work.

## Open

Publish the normal #187 PR, run the pinned input preflight and verify hosted CI plus the authentic Claude API result on the exact head and base. The coordinator owns serial integration.

- Console — PowerShell.
- Folder/worktree — The absolute folder registered for `dev-codex/187-draft-conflict-delivery`.
- Full start command — Run from a checkout of the repository.

```powershell
$taskWorktree = git worktree list --porcelain | Select-String '^branch refs/heads/dev-codex/187-draft-conflict-delivery$' -Context 2,0
Set-Location -LiteralPath ($taskWorktree.Context.PreContext[0] -replace '^worktree ', '')
git status --short --branch
gh pr list --repo Maeximilion/MaexSocial --head dev-codex/187-draft-conflict-delivery
```

- First message — Continue MaexSocial #187 from this checkpoint. Verify the closing PR and its exact-head CI and Claude API evidence with the coordinator.

## Lessons

Assert textarea values in Chromium. The HTML parser can consume the first line break after the opening tag. The keyboard test checks a leading newline, literal HTML and Unicode against the submitted text.
