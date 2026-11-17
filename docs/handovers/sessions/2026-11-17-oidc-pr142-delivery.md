# Handover 2026-11-17 — #139

## Status

Checkpoint at (UTC) — 2026-11-17T17:47:00Z. [PR #142](https://github.com/Maeximilion/MaexSocial/pull/142) is a normal PR attached to its creating chat. The #141 publication hold is lifted; merged main `559480c2afe09e5bf477632e95674c3d287c0fc5` is integrated. The branch was clean and pushed before this documentation update. The PR is In Review and issue #139 In Progress in the Project; labels, milestone and assignee are set.

Codex implementation uses actual native `gpt-6-astra` / `high`, Standard requested with no Fast override observed. Code Autopilot and Caveman remain enabled. No subagents or substitute code review were used. Claude API is the sole review source: `claude-opus-5-5`, high, standard, `standard_only`, as enforced by the executed helper. Actual [run 44140303154](https://github.com/Maeximilion/MaexSocial/actions/runs/44140303154) completed both API and publisher steps with empty gaps; the authentic [result](https://github.com/Maeximilion/MaexSocial/pull/142#issuecomment-6956132280) reports zero findings and usage 28,762 input / 10,396 output tokens. This review covers the work head below, **not this later documentation commit**; fresh automatic coverage must be verified before merge.

On the integrated work head, Node 24.22.2 `npm run pilot:build` and `npm run pilot:test` passed (18/18, including #140's real browser boundary regression). `python scripts/check_repo.py` and `git diff --check` passed. Earlier migration up/down/up, protocol 9/9, real Keycloak/browser 1/1, retained-volume restart 17/17 and Node foundation 20/20 evidence is in the [initial checkpoint](2026-11-17-oidc-checkpoint.md). The [protection checkpoint](2026-11-17-oidc-protection-checkpoint.md) records all 122 Python tests with installed Gitleaks: 121 passed and one Windows-inapplicable colon-filename skip; the earlier scanner skips are superseded.

The actual PR input preflight was complete: 71,067 escaped diff / 75,752 escaped prompt / 70,393 serialized request bytes, no gaps. Foundation [run 44140303165](https://github.com/Maeximilion/MaexSocial/actions/runs/44140303165) actually checked out integration candidate `50ee4dbc017426303743c88e97e85473ce4ab5e7` and passed. Pilot [run 44140303248](https://github.com/Maeximilion/MaexSocial/actions/runs/44140303248) is still running at this checkpoint. New-head input, integration candidate, CI and review are required after this documentation push; no unobserved result is claimed.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial)
- Task — [#139](https://github.com/Maeximilion/MaexSocial/issues/139); parent [#131](https://github.com/Maeximilion/MaexSocial/issues/131)
- Branch — `dev-codex/139-oidc-attempts`
- Work head before the handover commit — `e7ae7235874ad64fdd0eb36e0f7a766406b74f64`
- Base tip and merge base — `559480c2afe09e5bf477632e95674c3d287c0fc5`
- Reviewed diff — `559480c2afe09e5bf477632e95674c3d287c0fc5...e7ae7235874ad64fdd0eb36e0f7a766406b74f64`
- [Contract and limits](../../../ops/local/README.md#private-oidc-verification-139), [accepted disposition](https://github.com/Maeximilion/MaexSocial/issues/139#issuecomment-6955174792)
- Private ignored evidence remains in `work/`; final source/Git/runtime backup and independent restore verification are pending. Retained Docker volumes are not portable database backups. Do not publish raw fixture files, captures or failed-test diagnostics.

## Decisions

Fixed trusted endpoints, mandatory signature and claim validation, fresh owned database transactions and committed one-use consumption remain the contract. Operation-driven cleanup plus an explicit private method is accepted only for this unmounted component. Five-minute logical expiry is immediate; expired idle rows remain until cleanup. Before public use, #131 must add timed cleanup and operating evidence.

No application sessions, customer admission or public auth routes are introduced. No credential replacement, historical excluded probe, provider locking experiment, extra agent or new issue is authorized. The automatic external security comment is not the required Claude review.

## Gate

#131's real admission, MFA freshness, lifecycle and recovery obligations remain open. #123/#124, integrated Task 2, Task 3 and G3/G5 are unchanged. #137's earlier empty-browser-title uncertainty did not recur and is not declared fixed. Local synthetic G2 authorization does not authorize external operation or a new product gate.

## Open

1. Verify the normal documentation push's complete input, current-head/base authentic Claude result, all required CI and actual integration checkout. Address genuine findings in this same PR. Record final evidence in the PR/issue and report to Root; Root alone merges.
2. Stop only the current owned fixture without deleting volumes, preserve all needed original source/Git metadata/index, ignored artifacts and Node runtime outside affected checkouts, and verify usable restoration before Root archives. Report exact private recovery paths to Root.

Runnable start: PowerShell in the dedicated checkout reported by `git worktree list` for `dev-codex/139-oidc-attempts`; the exact local location is in the authorized coordinator's private ledger. Use Node 24.22.2 (the preserved `work/runtime/node-v24.22.2-win-x64`) and Docker. From that checkout: `$env:PATH="$PWD/work/runtime/node-v24.22.2-win-x64;$env:PATH"; npm ci; npm run pilot:build`. Inspect the retained fixture manifest and expiry before any authorized restart; preserve older fixtures/volumes.

First message: “Continue #139 / PR142. Verify live refs and final PR/issue evidence against this historical checkpoint. Complete only its current CI/review/recovery handover; do not rerun successful checks without a new evidence need, enable public auth, or inspect excluded probes. Root owns merge and archive.”

## Lessons

Integrating the smaller text-editor PR preserves its actual 1,500-code-point browser regression in the full 18-case pilot suite. A green review job alone is insufficient: inspect actual API execution, empty coverage gaps, publisher and immutable head/base. A later documentation commit still needs fresh coverage. Advisory scans remain explicit `/start` or `/task` only; none was invoked.
