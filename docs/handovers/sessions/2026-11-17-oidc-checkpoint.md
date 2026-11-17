# Handover 2026-11-17 — #139

## Status

Checkpoint at (UTC) — 2026-11-17T17:29:07Z. The private OIDC component is implemented and locally verified. Publication is held by the coordinator until the independent smaller #140 delivery merges and this branch is reconciled with current main. No PR, hosted CI or Claude API review exists at this checkpoint.

Implementation/review — Codex implementer, native `gpt-6-astra` / `high`; Standard requested, no Fast override observed, service-tier field unset. Claude API is the sole PR reviewer and has **not run** for this change. Code Autopilot and Caveman are enabled; the scoped Superpowers execution and Ponytail implementation rules apply. No subagents were used.

Actual local checks on the work head below:

- Node 24.22.2, downloaded from the official distribution and SHA-256 checked; `npm run pilot:build` passed.
- An initial store assertion failed because `pilot.oidc_attempts` did not exist, then passed after migration 003. Protocol tests failed against the unimplemented verifier before implementation.
- A separate fresh OIDC fixture passed `npm run pilot:migrate -- up`, `down`, `up`. Earlier baseline-only fixture files and volumes were preserved.
- `node --test dist/pilot/tests/pilot/oidc.test.js` passed all nine controlled-HTTPS/real-PostgreSQL cases, including six independent competing callbacks, post-lock expiry, 256-slot saturation, cleanup, TLS/JWKS failures and shared token/JWKS timeout.
- `node --test dist/pilot/tests/pilot/oidc-browser.test.js` passed with real local Keycloak 26.8.2. Browser B had its own binding and received denial with zero exchanges; A then yielded the exact expected issuer/subject and one exchange. Replay remained denied with one exchange; no app session was created and product auth routes remained closed.
- `npm run pilot:test` passed 17/17. `npm run pilot:down`, `npm run pilot:up`, then `npm run pilot:test` passed 17/17 again, preserving the same database volumes.
- `python scripts/check_repo.py` passed; `python -m unittest discover -s tests` passed 122 tests with 32 reported skips; Node 24 `node --test tests/*.test.cjs` passed 20/20; `git diff --check` passed.

These are local checks, not hosted current-candidate CI or product gate acceptance. The initial lockfile installation used host Node 26 and emitted an engine warning; all reported build/product checks used pinned Node 24. No public operating runtime was started.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial)
- Task — [#139](https://github.com/Maeximilion/MaexSocial/issues/139), bounded component of [#131](https://github.com/Maeximilion/MaexSocial/issues/131)
- Branch — `dev-codex/139-oidc-attempts`
- Work head before the handover commit — `acf2cc124821500b099812e64666f30cf27abab9`
- Base — `3e5512df749661b2ef42e816c0b9bbf3a56a331b`
- PR — not yet opened; explicit publication hold described above
- [Implementation and limits](../../../ops/local/README.md#private-oidc-verification-139), [verifier](../../../apps/web/src/server/oidc.ts), [migration](../../../db/migrations/003_oidc_attempts.up.sql), [protocol tests](../../../tests/pilot/oidc.test.ts), [real browser test](../../../tests/pilot/oidc-browser.test.ts)
- [Root contract disposition](https://github.com/Maeximilion/MaexSocial/issues/139#issuecomment-6955174792)
- Private ignored artifacts: `work/139-progress.md`, `work/runtime/`, `work/pilot/`, preserved `work/baseline-pilot/`, test outputs and browser artifacts. Do not publish raw private diagnostics or fixture data. Retained Docker volumes are not portable database backups.

## Decisions

Use pinned oauth4webapi 3.8.8 with explicit signature verification and no custom JOSE verifier. Trust only server-fixed endpoints/configuration. Keep the standalone attempt store independent of identities, customer sessions, membership, lifecycle and dispatch records. Open fresh owned database connections; commit consumption before external exchange. Never retry the same attempt after an exchange failure.

Root accepted operation-driven physical cleanup for this **unmounted** component. Five minutes is immediate logical expiry, not guaranteed physical erasure. Idle expired rows remain until a later operation or explicit cleanup. #131 must supply timed cleanup and operating evidence before public operation. No background sweeper or session platform was added.

Only a fresh isolated fixture initializes an invented user and narrowly scoped client. No existing user's credentials, previous fixture volumes, provider locking, recovery/completion or excluded historical experiment is part of this delivery.

## Gate

The [accepted bounded G2 contract](../../superpowers/specs/2026-11-06-g2-acceptance-packet.md) permits local synthetic work only. #131 retains real admission, lifecycle, recovery and MFA semantics; this verifier does not establish any of them. #123/#124 integration, Task 3 and G3/G5 requirements remain open. The separate #137 browser uncertainty remains unresolved; its earlier empty-title symptom did not recur here.

## Open

1. After the coordinator confirms #140 merged, fetch main, integrate the actual base and check the resulting candidate. Open one normal English PR with `Closes #139`, correct metadata and immediate creator-chat attachment.
2. Run the complete real PR input preflight; verify actual current-head/base CI and genuine complete Claude API execution/result. The staged diff was approximately 52 KB JSON-escaped before this record, **not** a complete API-input measurement. Address genuine findings with targeted checks and normal pushes. Root alone merges.
3. Preserve and independently verify source, original Git metadata, private local artifacts/link targets and necessary runtime before archival. Root owns archival; current ignored files and Docker volumes have not yet received that final independent backup/restore verification.

- Console — PowerShell with Node 24.22.2 and npm 11.19.1; Docker Engine/Compose.
- Folder/worktree — the dedicated `dev-codex/139-oidc-attempts` checkout shown by `git worktree list`; leave canonical main clean. Machine-specific location is recorded privately with the coordinator.
- Start command from that worktree — `npm ci; npm run pilot:build`. Inspect the retained manifest before restarting the fixture; preserve expired/older directories and volumes rather than overwriting them. [Fresh-fixture commands](../../../ops/local/README.md) cover an authorized new namespace.
- First message — “Continue #139 from this checkpoint. Verify the coordinator's #140 publication hold, actual refs and private ledger. Do not rerun successful tests without a new change or evidence need. Finish the single PR and its actual Claude API/CI evidence; do not enable product auth or implement lifecycle completion.”

## Lessons

OAuth Basic credentials are form-encoded before Base64; the controlled server must decode that protocol form. Artificial timestamp updates must share one statement timestamp or they can exceed the database's exact five-minute bound by a microsecond. Those were test-fixture corrections, not relaxed product checks.

The initial browser harness needed its explicit Keycloak public-certificate pin and form redirect CSP allowance. Later bounded diagnostics saw `/verified` while Playwright routing failed to intercept the redirected callback. A precise URL predicate did not fix that observation. The test now uses a deterministic latch in its own private HTTPS callback, confirmed by the coordinator, with bounded waiting and fixed phase-only errors. It does not intercept or modify provider credential operations. No further pattern retry or general browser-fix claim is made.

Public authentication routes and all omitted lifecycle/MFA/gate claims remain closed. Advisory security/quality scans run only on an explicit owner `/start` or `/task`; none was invoked here.
