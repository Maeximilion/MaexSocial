# Handover 2026-11-22 — #261

## Status

Checkpoint recorded at 2026-11-22T19:59:03Z. The private issue and resend operation, recipient preview and local controls are implemented. The strict TypeScript build, isolated PostgreSQL/Mailpit tests, browser preview, repository check and 20 Node foundation tests passed. The combined Windows Python run lost injected Git configuration values in subprocesses. Running each module in its own process passed 101 tests with 32 platform skips. The owned fixture is stopped.

Implementation used Codex GPT-6.2 Sol with High reasoning. The hosted Claude Messages API review and exact integration candidate CI were pending at this checkpoint. Use the PR's linked run and result to verify the current revision under the [review policy](../../tooling/agent-workflow.md#pr-review-policy).

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial)
- Task — [#261](https://github.com/Maeximilion/MaexSocial/issues/261)
- Branch — `dev-codex/261-private-management-invitation`
- Work head before the handover commit — `853d25fb00f4a76288f871f138aacc1c00f007cb`
- Pull request — pending at this checkpoint
- Evidence — [fixture contract and commands](../../../ops/local/README.md#private-devadmin-invitation-issuance-261), [issuance tests](../../../tests/pilot/invitation-issue.test.ts) and [browser preview](../../../tests/pilot/invitation-browser.test.ts)

## Decisions

The operation reuses the private management proof, existing schema, the shared workspace and recipient lock, and the pinned Mailpit sink. Pending state and audit commit together before capture. Unconfirmed delivery keeps the pending row. Explicit replacement requires the same issuer version, target role, tenant and recipient. The read-only preview uses the stored role and current issuing grant or Manager membership.

## Gate

This is isolated synthetic evidence for [Task 3](https://github.com/Maeximilion/MaexSocial/issues/164). G3 remains open. Real platform identity, device proof, invitation acceptance and account or membership activation remain with #131, #164 and #221.

## Open

Verify the coordinator's released base, publish the focused PR, and verify the actual Claude API review and current candidate CI. The coordinator owns the merge decision.

- Console — PowerShell
- Worktree — the local `issue-261-private-management-invitation` Codex worktree
- Start — `Set-Location -LiteralPath (Join-Path $env:USERPROFILE '.codex/worktrees/issue-261-private-management-invitation/MaexSocial'); git status --short --branch; git fetch origin --prune`
- First message — Continue #261 from this checkpoint and verify the current PR and required review evidence.

## Lessons

The existing issuer-version columns and immutable invitation binding cover both issuer types without a migration. Keep the Windows Python environment isolated by module when inherited Git settings contain empty values. Use the canonical Code Autopilot and Caveman skills and run advisory checks only for an explicit `/start` or `/task`.
