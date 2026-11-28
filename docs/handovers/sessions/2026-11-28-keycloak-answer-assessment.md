# Handover 2026-11-28 — G3 identity evidence #299

## Status

Pre-publication checkpoint at 2026-11-28T11:12Z. The [dated disposition](../../security/identity-generation-evidence.md#2026-11-28-assessment-of-the-community-response) covers the community reply, Keycloak 26.8.2 and the three questions in #131. Graphify located the private factor receipt on the same revision as the starting checkout. GitHub readback confirmed the first assessment commit on the task branch.

Codex implemented the assessment using GPT-6.2 Astra, high effort. The PR's automatic Claude Messages API reviewer is pending at this checkpoint. The PR verification section will carry its actual run, complete input and published result for the delivered head/base.

## Artifacts

- Repository and task — [Maeximilion/MaexSocial #299](https://github.com/Maeximilion/MaexSocial/issues/299).
- Branch — `dev-codex/299-keycloak-answer-assessment`.
- Work head before the handover commit — `bb199c6a2622840d5c9490107c651cf0c06aeedc`. Base — `23c75416bbfef16f3709f61f2b6c9dc8d1f6cdc6`.
- PR — pending creation. The PR will close only #299.
- Evidence — the [response](https://github.com/keycloak/keycloak/discussions/55440#discussioncomment-19843003), pinned source and final OpenID specifications in the disposition. The added section's 21 external URLs resolved, including validation of cited source line ranges and specification fragments. `python scripts/check_repo.py` and `git diff --check` passed. `node --test tests/*.test.cjs` passed 20/20. `python -m unittest discover -s tests` ran 134 tests with the configured Gitleaks scanner, 133 passed and one Windows-inapplicable case was skipped.

## Decisions

The proven private OTP event supports a bounded authentication-time claim. The inspected stock contract leaves action-time validity and recovery completion unresolved. Keep the approved design and sensitive entries closed unless the identity owner obtains the missing guarantee or Maxi authorizes a reviewed G2 redesign.

## Gate

[G3](https://github.com/Maeximilion/MaexSocial/issues/16) remains open. [#131](https://github.com/Maeximilion/MaexSocial/issues/131) is still required for #221 and #223. The source assessment grants no product acceptance.

## Open

Open the normal PR. Link the dated disposition from #131. Verify the automatic Claude review, candidate CI and review threads, then send Main the exact head and merge candidate.

- Console — PowerShell.
- Folder/worktree — `$env:USERPROFILE/.codex/worktrees/issue-299-keycloak-answer-assessment/MaexSocial`.
- Full start command — `Set-Location "$env:USERPROFILE/.codex/worktrees/issue-299-keycloak-answer-assessment/MaexSocial"; git status --short --branch; gh pr view --json url,headRefOid,baseRefOid,statusCheckRollup`.
- First message — Resume #299 from this handover and its linked PR. Verify current evidence and report the exact candidate to the authorized coordinator, who owns merge and closeout.

## Lessons

An authenticated logout message establishes which sessions to terminate. It cannot establish which recovery succeeded. Source and documentation checks support that distinction. No new identity runtime, credential operation or excluded experiment ran.
