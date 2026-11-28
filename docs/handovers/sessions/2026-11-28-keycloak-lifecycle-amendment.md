# Handover 2026-11-28 — G2 identity lifecycle proposal

## Status

Pre-publication checkpoint at 2026-11-28T11:33Z. The [decision document](../../superpowers/specs/2026-11-28-keycloak-lifecycle-amendment-design.md) covers the current realm import, two candidate designs, failure handling, customer journeys, ownership and stop conditions. The coordinator has the immutable document for Maxi. Codex prepared it using GPT-6.2 Astra with high reasoning. The automatic Claude API review is pending publication.

## Artifacts

- Repository and task — [Maeximilion/MaexSocial #303](https://github.com/Maeximilion/MaexSocial/issues/303).
- Branch — `dev-codex/303-keycloak-lifecycle-design`. Work head before the handover commit — `5b694edc259fcbdcca219b47534c9b8c47561e0a`. Initial base — `380ff9256fe9f2181a3408c0e496d9d6be6ca709`.
- Verification — the branch readback matched that work head. All 23 distinct document references were checked, including local targets, upstream source ranges and OIDC fragments. `python scripts/check_repo.py` and `git diff --check` passed. `node --test tests/*.test.cjs` passed 20/20. With the repository-configured Gitleaks binary, `python -m unittest discover -s tests` ran 134 tests, 133 passed and one skipped. The initial scanner path example did not exist. The OIDC reference uses a valid HTML named anchor, recognized by the corrected check. These foundation checks cover the repository and its tooling.
- PR — pending the coordinator's serial publication slot. The PR verification section will carry the actual review outcome, run, reviewed revisions and candidate CI.

## Decisions

The private test flow verifies an enrolled OTP. Normal account management is provisioned by the pinned provider. No configured route supplies both complete mediation of relevant changes and trustworthy operation-bound recovery completion. Recommend a source-level design for an owned component only if Maxi accepts the operational restrictions and the obligation to establish both guarantees.

## Gate

[Parent #131](https://github.com/Maeximilion/MaexSocial/issues/131) and [G3](https://github.com/Maeximilion/MaexSocial/issues/16) remain open. The proposal does not change runtime, approve a gate or activate customer Manager actions.

## Open

After the coordinator confirms the base, verify the final diff and publish a normal PR closing only #303. Attach it to the work chat. Link the immutable document and PR from #131, verify the actual Claude API result, candidate CI and all threads, then report to the coordinator for the expected-head merge.

- Console — PowerShell.
- Worktree — `$env:USERPROFILE/.codex/worktrees/issue-303-keycloak-lifecycle-design/MaexSocial`.
- Full start command — `Set-Location "$env:USERPROFILE/.codex/worktrees/issue-303-keycloak-lifecycle-design/MaexSocial"; git status --short --branch; gh pr status`.
- First message — Resume #303 at this handover. Reconcile coordinator controls and publication slot, verify the reviewed revision and report the candidate for serial integration.

## Lessons

Inspect the generated realm and upstream import defaults together. Disabled customer clients alone give no inventory of account-management capabilities. Source review supplies a bounded decision. No identity experiment, live credential operation or provider-state inspection ran.
