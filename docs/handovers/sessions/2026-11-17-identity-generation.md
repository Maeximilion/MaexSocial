# Identity generation source-evidence handover

Date: 2026-11-17. Task: [#149](https://github.com/Maeximilion/MaexSocial/issues/149), child of [#131](https://github.com/Maeximilion/MaexSocial/issues/131). One documentation delivery; no implementation or product-gate completion.

## Result and scope

The [evidence report](../../security/identity-generation-evidence.md) found no complete supported enrollment/recovery-generation contract in its bounded official-source investigation. It records the real internal credential-row version, the narrower public credential/status interfaces, mutation-path coverage, event/transaction semantics and explicit unknowns. The missing assurance binds a provider-authoritative lifecycle state to the actual factor event and defines validity at App session binding and Manager authorization. A local counter or independent reads cannot supply the missing provider ordering.

Root owns the next step: record the exact missing-assurance checklist in #131 and hold implementation until new version-specific primary evidence covers all relevant mutations, factor-event binding and effective invalidation through authorization. Do not start a second identical source round. No external inquiry was sent. #131, the affected #123/#124 Manager actions, Task 2 and G3/G5 remain blocked. The source result is not a universal impossibility claim and does not relax accepted recovery postconditions.

## Revisions and method

- Admission base: `006843217f775a6bdb26b41687f0b6ec90e90eed`; delivery base: `5f87a7ba48a1e2385776486545a5e8d9c4e42a6f`, after actual #148 merge. Task branch: `dev-codex/149-identity-generation`, isolated worktree; canonical main was not edited.
- Keycloak 26.8.2 tag resolved to `e514445f9dcdabc5bdcf67cab56c1e49655de067`. Exact source paths and ranges are linked in the report. #131's source-only spec/plan was read at `9af6e21307c01755364ed1d69f54dabecdf1c599`.
- Canonical Code Autopilot/Caveman, bounded Superpowers planning and worktree guidance; smallest complete Ponytail documentation scope. No extra planning/reviewer agent or duplicate review round. Actual runtime metadata: `gpt-6-astra`, effort `high`, no service-tier override (`null`), not a claimed model switch.
- Read public official sources as text. Local ignored `work/149-sources/` holds public source copies and the source path listing, with no credentials or provider captures. No installation, product code, schema, fixture, workflow or orchestration edits.
- The excluded private probe was not read, reconstructed, run, rephrased or delegated. No provider runtime/credential/lifecycle requests or customer data. GitHub issue/source reads and delivery metadata are repository operations.

## Verification and delivery

- Baseline `python scripts/check_repo.py`: passed after integrating #148; links, JSON/TOML and repository artwork only.
- `python -m unittest discover -s tests`: 122 discovered, 90 passed, 32 skipped (Gitleaks was not on PATH); the focused rerun `python -m unittest discover -s tests -p test_secret_hooks.py` with the existing scanner selected by `MAEXSOCIAL_TEST_GITLEAKS` passed 31/32, with one Windows-inapplicable filename case skipped. Mocked review API outputs are not actual Claude execution. `node --test tests/*.test.cjs`: 20 passed. `python scripts/check_repo.py` and `git diff --check`: passed after authoring. A source-link assertion verified all 29 pinned Keycloak paths/ranges after correcting one end-line reference. A scratch text-edit command initially failed on the Windows default encoding before writing; explicit UTF-8 corrected it. No authentication, browser, lifecycle, concurrency or provider test was run for this source assignment. Earlier #136/#139/#143/#148 evidence is attributed, not rerun.
- Required current-candidate CI and actual complete Claude API head/base review remain delivery checks. A green workflow without actual API execution/complete publication is insufficient. The PR records the final evidence; Root alone decides merge and archive.
- Before archival, Root must preserve and verify the final Git state, source-only scratch files and completed chat transcript outside the attached worktree. No runtime volume was created by this task. No successor assignment or second PR belongs in this chat.
