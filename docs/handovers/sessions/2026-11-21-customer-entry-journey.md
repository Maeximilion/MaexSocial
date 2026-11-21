# Handover 2026-11-21 — #177

## Status

Checkpoint (UTC) — 2026-11-21T16:52:06Z. The customer entry and keyboard acceptance specification is ready for PR publication. `python scripts/check_repo.py` and `git diff --check` passed. `node --test 'tests/*.test.cjs'` passed 20/20 on Node 24.22.2. `python -m unittest discover -s tests` initially failed because the Windows child process lost an empty value from the injected Git configuration. Repeating the suite with process-local `GIT_CONFIG_COUNT` removed passed 91 cases with 32 skipped. The isolated browser evidence comes from the hosted pilot on the source baseline listed below. No separate fixture was started for this docs-only patch.

Implementation — Codex. The existing Claude API workflow is the reviewer. Publication, PR CI and actual review execution are pending at this checkpoint. The [configured review policy](../../tooling/agent-workflow.md#pr-review-policy) calls for `claude-opus-5-5`, effort `high`, speed `standard` and `service_tier=standard_only`. Verify actual execution and coverage from the PR's run and receipt.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial)
- Task — [#177](https://github.com/Maeximilion/MaexSocial/issues/177), an independent documentation delivery for [#163](https://github.com/Maeximilion/MaexSocial/issues/163)
- Branch — `dev-codex/177-customer-entry-journey`
- Work head before the handover commit — `31501db2500dbc1f37ce05b17728547800df56e7`
- PR — Pending publication at this checkpoint.
- Deliverable — [Customer entry acceptance journey](../../06_GUI.md#customer-entry-acceptance-journey)
- Source and browser evidence — `fbf4d2cc979ec0fb094438f80e372e230bc34241` matched the Graphify index. The [hosted pilot run](https://github.com/Maeximilion/MaexSocial/actions/runs/44919738723) passed 28/28 before and after restart, including the isolated portal keyboard test on a seeded session.

## Decisions

Specify the fixed same-origin portal target, customer account and workspace transitions, accessible feedback, and public notice placement. Keep the current fixture paths and observed browser outcomes distinct from the staging requirements. The accepted separate Windows administration path remains private. Runtime source, routes, identity provider configuration and fixtures require no change for this delivery.

## Gate

[G2](https://github.com/Maeximilion/MaexSocial/issues/15#issuecomment-6681723454) is accepted for the bounded local design. [G3](https://github.com/Maeximilion/MaexSocial/issues/16) and [#163](https://github.com/Maeximilion/MaexSocial/issues/163) retain the authorized staging journey and actual DNS/TLS proof. [#131](https://github.com/Maeximilion/MaexSocial/issues/131) retains integrated identity and recovery evidence, and [#82](https://github.com/Maeximilion/MaexSocial/issues/82) retains staging access assurance. Maxi owns the host, operator, legal notice, optional hero and launch decisions.

## Open

Open the normal PR with `Closes #177`, attach it to the owning chat, and report it to the coordinator. Verify exact-head/base CI and the complete Claude API result. The coordinator owns merge and archive after verified recovery.

- Console — PowerShell.
- Folder/worktree — Resolve the local checkout for `dev-codex/177-customer-entry-journey` from the MaexSocial repository. The absolute path is in the private coordinator record.
- Start command from any MaexSocial checkout — `$entry = git worktree list --porcelain | Select-String '^branch refs/heads/dev-codex/177-customer-entry-journey$' -Context 2,0; if (-not $entry) { throw 'Task worktree unavailable' }; Set-Location -LiteralPath ($entry.Context.PreContext[0] -replace '^worktree ', ''); git status --short --branch`
- First message — Resume only #177 from this handover. Verify the newest owner controls and current PR before taking any publication or review action.

## Lessons

The dashboard fixture can prove keyboard workspace switching, session rotation and sign-out. Provider sign-in, signup, invitations, account switching, recovery, error focus and public notices still need the integrated staging matrix. Code Autopilot and Caveman remain enabled under the [development skill rules](../../tooling/development-skills.md). The advisory scan runs only on explicit `/start` or `/task`.
