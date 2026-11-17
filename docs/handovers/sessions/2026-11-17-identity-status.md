# Handover 2026-11-17 — #136

## Status

Checkpoint at (UTC) — 2026-11-17T16:34:41Z. Implementation and local verification are complete; PR publication, hosted CI and authentic Claude API review are next. Both task-owned fixtures are stopped and all six database/mail volumes are retained, not exported. The first fixture's files are preserved separately under ignored `work/`; no existing identity or volume was rewritten. Canonical main remains clean.

Implementation/review — Codex implementation, actual native session `gpt-6-astra` / high; no Fast override, service tier itself not separately reported. Code Autopilot and Caveman are enabled; Ponytail supplies the bounded workflow. Claude Messages API is the only PR reviewer, with repository configuration Opus 5.5/high/standard; it has **not yet run on this change** at this checkpoint. Record the later actual run/result and full head/base/candidate on the PR. No separate Codex review was performed.

Local commands and observed outcomes on the implementation source below:

- Pinned `node:24.22.2-bookworm-slim` image/digest from Compose: `npm ci` and `npm run pilot:build` passed using Node 24.22.2/npm 11.19.1. Host orchestration was Node 26.13.0/npm 12.0.2; the adapter, database and real provider tests run in the isolated Node 24 runner.
- `npm run pilot:up`, `npm run pilot:migrate -- up`, `-- down`, `-- up` and `node --test dist/pilot/tests/pilot/migration-empty.js` passed on the fresh corrected fixture before seeding.
- `node --test dist/pilot/tests/pilot/identity-status.test.js`: all seven inner tests passed. The real local Keycloak read and enabled/disabled/roleless checks are distinct from controlled HTTPS failure tests. The roleless client produces observed HTTP 200 for token authentication and 403 for user inspection. All application identities/sessions in this suite roll back after each check.
- `npm run pilot:test`: 14/14 top-level tests passed before and after `npm run pilot:down` / `npm run pilot:up`. Browser navigation passed both times; #137 did not recur and is not claimed fixed. Final `npm run pilot:down` passed without deleting volumes.
- `python scripts/check_repo.py`, `git diff --check` and `node --test tests/*.test.cjs` passed; Node foundation tests: 20/20.
- `python -m unittest discover -s tests`: 122 tests, 32 initially skipped because the installed scanner was not on PATH. Re-ran `python -m unittest discover -s tests -p test_secret_hooks.py` with `MAEXSOCIAL_TEST_GITLEAKS` pointing to the existing canonical Git hook scanner: 32 tests, one Windows-inapplicable colon-filename test skipped, no failures. Hosted Linux checks remain pending.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial).
- Task ID and issue — [#136](https://github.com/Maeximilion/MaexSocial/issues/136), the bounded status component of [#131](https://github.com/Maeximilion/MaexSocial/issues/131).
- Branch — `dev-codex/136-identity-status`.
- Work head before the handover commit — `be7919361ae7d90a3b6d04f99489f531ade7c0cd`, based on merged A1 `c3dd3885f45813facfd3570089354bcbcd9d0653`.
- PR — not yet opened at this checkpoint; open one normal PR with `Closes #136`, then attach it to the creating chat. The actual later head and receipts belong in that PR.
- Implementation — [adapter](../../../apps/web/src/server/identity.ts), [targeted tests](../../../tests/pilot/identity-status.test.ts), [fixture](../../../ops/local/stack.ts).
- Contract, official pinned sources, limits and commands — [local operations](../../../ops/local/README.md#read-only-identity-status-136).
- Narrow acceptance mapping — [Task 2 evidence map](../../superpowers/plans/2026-11-05-ms-009-pilot-evidence-map.md#task-2-evidence-boundary--november-17).

## Decisions

The coordinator accepted the concrete endpoint/role/DTO/file contract before implementation. `view-users` is the smallest applicable built-in read role; it is realm-wide, including groups and its query composites, not per-field/per-user permission. This is limited to the synthetic isolated pilot realm. Explicit service-account role/client-scope intersection and `fullScopeAllowed=false` remain enforced. Public customer and desktop clients stay disabled.

The first real test failed: client authentication returned 200, then user inspection returned 401. Sanitized token metadata showed the intended view/query roles but only the `realm-management` audience. The pinned 26.8.2 [Admin API audience requirement](https://github.com/keycloak/keycloak/blob/26.8.2/docs/documentation/server_admin/topics/admin-console-permissions/admin-api-audience.adoc) established the missing built-in `kc-admin-api` scope. The coordinator confirmed adding that scope to both new fixture clients without changing roles or disabling audience checks. After stopping and preserving the first fixture inside the verified worktree path, a new random namespace/import passed. No Admin REST write, credential modification or existing-realm repair was attempted.

One deadline spans authentication and both reads. Every failure is generic and closes transport resources. No endpoint URL comes from the subject/client request, and no returned secret/token/profile field enters the DTO. No cache or retry can turn stale or partial status into authority. A1's public routes, lock order, session/MFA representation and guards are unchanged.

## Gate

Bounded local synthetic implementation is already authorized by the [G2 owner decision](https://github.com/Maeximilion/MaexSocial/issues/15#issuecomment-6681723454). This component does not accept G3/G5. Two separate reads are not an atomic lifecycle snapshot; credential enrollment does not establish factor use, reliable MFA time, recovery generation, completion or session admission. Real users in the fixture have no passwords/factors, and even the positive status control fails Manager MFA.

#131 retains actual OIDC/signup/invitation/recovery/MFA/completion provenance and integrated assurance. #123/#124 and Task 3 remain dependent on those obligations. #137's historical browser observation remains open. The excluded prior experiment/private probes were not read, reconstructed or executed. No external deployment, customer data, custom Keycloak extension or management permission is part of this delivery.

## Open

First finish complete-input preflight and publish the normal PR; inspect actual current-candidate CI and Claude API execution/result, fixing only evidenced findings with normal pushes. Root alone decides and performs merge/archival. Before archival preserve tracked, untracked and ignored material, original Git metadata and a verified usable restore outside the worktree; volumes are retained separately, not backed up by a source bundle. Final receipt links and recovery evidence must be sent to the authorized coordinator and recorded on #136/PR.

- Console — PowerShell.
- Folder/worktree — `C:/Users/Maxi/.codex/worktrees/136-identity-status/MaexSocial`.
- Full start command — `Set-Location C:/Users/Maxi/.codex/worktrees/136-identity-status/MaexSocial; git status --short --branch; git fetch origin --prune`.
- First message — “Continue only #136 on dev-codex/136-identity-status. Read this handover and current PR evidence; preserve public-auth closure and #131 obligations. Complete the pinned full-input/CI/Claude review evidence and send Root the result. Do not merge or start another task.”

## Lessons

Having the correct read role alone does not establish a valid Admin API audience in Keycloak 26.8.2. Check the pinned audience requirement before interpreting a 401 as insufficient authority. Diagnose only selected non-secret metadata; never print bearer tokens or raw provider responses. Recreate this task's isolated fixture from a fresh namespace when import configuration changes; retain old data/volumes.

Use the existing repository-check workflow and targeted tests; no duplicate review loops. Advisory security/quality/Dependabot checks still run only on an explicit `/start` or `/task`; none was requested or run here. The active model-routing pause and actual secret/CI controls remain in force.
