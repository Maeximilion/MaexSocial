# Handover 2026-11-28 — MS-009 / #314

## Status

Local checkpoint at 2026-11-28 13:28 UTC on base `a808939f97e10b86b7347df2add3ad9d4ab49635`. The scoped AppDB operation and the isolated physical-pair drill are implemented. The synthetic Keycloak account remains active. The work is waiting for Main's confirmed serial base after #312. A regular PR, automatic Claude API review, candidate CI and merge remain pending. Implementer used Codex GPT-6.2 Astra High.

## Artifacts

- [MaexSocial #314](https://github.com/Maeximilion/MaexSocial/issues/314), parent [Task 5 / #166](https://github.com/Maeximilion/MaexSocial/issues/166), G3 MVP.
- Branch `dev-codex/314-customer-access-record-erasure`. Work head before the handover commit and physical drill revision `5227dfdbb1ef79c88141f461ad0f9634ac22d4b0`.
- [On-demand procedure](../../../ops/local/README.md#bound-customer-access-erasure-314), [source transaction](../../../ops/local/source-customer-erasure.ts), [offline replay](../../../ops/local/restore-history.ts), [controlled drill](../../../tests/pilot/customer-erasure-drill.ts).

## Decisions

The customer instruction binds one marked disposable source, the pilot issuer, an exact local identity, its existing issuer subject, authority version and independently committed authorization. The owner-only instruction pins the sequence and journal digest. The fixture exports counts and times. A changed subject, fixture, version, identity or digest cannot authorize another customer. A tenant removal, mailbox or management identity is outside this operation.

| Local class | Observed disposition |
| --- | --- |
| Identity and memberships | Original issuer subject and verification removed. One unreferenced membership deleted. One inactive historical membership keeps tenant, membership and identity keys, former role and version. The identity shell contains its original local key, a random replacement string, false verification and a new version. |
| Sessions and verification | Both the original and concurrently rotated session were deleted, including token and CSRF hashes, scope, activity and factor references. Both tokens failed. One exact identity-bound verification fixture row was deleted with its email, token hash and timestamps. The shipping private invitation writer did not create a reset or verification row. The challenge was seeded at schema level. |
| Invitations and mailbox overlap | One invitation from the target retained its recipient, token hash, role, grant and issuer binding with revocation recorded. Another issuer's invitation and one unbound verification row retain the matching mailbox. Neither row records an immutable recipient identity. Genuine bound challenges and the two controls have distinct ownership. |
| Business content, approval, claim and audit | Revisions, approvals, attempt and audit rows matched pre-erasure control evidence. A newly attempted claim using the original outstanding approval failed. The already-claimed occurrence retained its once-only attempt and held audit evidence. The membership and actor keys remain linkable through these independent records. Source-held audit remains under its incident disposition. |
| Other access stores | OIDC attempts hold pre-login browser, state and configuration bindings without a customer subject or mailbox. The throttle stores time-bounded keyed account/source buckets. Neither accepts the whole-subject instruction as a basis for mailbox or source-wide deletion. |
| Private maintenance evidence | The fixture-scoped journal and owner-only receipt retain the local identity key, subject-binding digest, version and scope. They remain correlatable. No product route, scheduler, identity privilege, or media-sanitization operation was introduced. |

The actual synthetic realm had registration and password reset disabled, zero enabled self-deletion actions and an enabled target. Its status client has the realm-management `view-users` role. It could still read the account after AppDB erasure. The admin deletion endpoint requires separate authority. Self-service requires the enabled Delete Account action and the account delete-account role. No issuer operation was performed. The issuer, mailbox-only attribution and historical personal linkage remain explicit boundaries in [#131](https://github.com/Maeximilion/MaexSocial/issues/131) and [#82](https://github.com/Maeximilion/MaexSocial/issues/82). [Keycloak 26.8.2 Admin REST](https://www.keycloak.org/docs-api/26.8.2/rest-api/index.html), [Keycloak account self-deletion](https://www.keycloak.org/docs/latest/server_admin/index.html#enabling-account-deletion-by-users).

## Gate

This is synthetic local evidence for the seven-day AppDB class. It does not establish production scheduling, physical media sanitization, whole-account deletion or gate acceptance. The retained controls proved independent read access and stable access/content rows. Logical cleanup persisted across source restart and physical restore with independently retained history. Quarantine kept the restored service roles locked and the six historical occurrences held. The original authenticated encrypted pair remained valid under its original capture deadline.

## Open

Main confirms the serial base after #312. Integrate the actual 016/017 migrations, redo affected checks and drill, run Ponytail before publishing a normal PR with `Closes #314`, attach the PR in its creating chat, and verify automatic Claude input, outcome, candidate CI, comments and threads. Main owns the expected-head merge.

PowerShell in the attached task checkout:

    Set-Location "$env:USERPROFILE/.codex/worktrees/issue-314-customer-access-record-erasure/MaexSocial"
    git status --short --branch

First request: verify the current owner control and Main's base signal, then finish #314 against that base.

## Lessons

On the pinned physical-drill revision, the database sampled authorization at 13:26:25.300Z and confirmed the committed cleanup at 13:26:25.526Z on 2026-11-28. The recorded difference was 226 ms. Allowing for millisecond timestamp truncation, the commit-to-commit interval was under 227 ms. One injected deferred commit failure preserved the source. An established rotation held the subject lock first. Its committed successor token and the original session were both unusable after cleanup. A retry detected an owner-seeded conflicting challenge instead of reporting the stale receipt as current. Whole-row marker checks across every AppDB pilot table found one issuer-subject match before erasure and zero afterward. Rows containing the target mailbox fell from three to two, exactly the independent invitation and unbound challenge. Both retained legitimate controls matched through source restart, three invalid restore histories, replay, repeat and target restart. On the paired target the Keycloak database service role could not log in and the synthetic account was still present.

`npm ci --offline --no-audit --no-fund` and `npm run pilot:build` passed with Node 24.22.2. Six backup/restore format tests, 20 Node foundation tests, repository validation and whitespace checks passed. The pre-integration ordinary fixture passed migration up/down/up, the empty migration guard, and the full 63-test local pilot suite. That suite started at `2c0b17d` and overlapped subsequent drill-only work and a rebuild. Python foundation ran 134 tests with the configured scanner. One Windows-inapplicable test skipped and one candidate test failed because the provisional base lacks migrations 016 and 017. The initial run without the scanner skipped 32. Consecutive migrations must be verified on the shipping base. The first drill setup closed its test connection early; the next needed explicit Keycloak HTTPS readiness after restart. Both were corrected before the successful pinned drill.

Code Autopilot and Caveman are enabled. Advisory scans require an explicit `/start` or `/task`. No gate or issuer decision was made.
