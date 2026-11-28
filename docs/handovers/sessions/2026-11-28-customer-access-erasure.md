# Handover 2026-11-28 — MS-009 / #314

## Status

On-demand erasure of one authorized synthetic customer's AppDB access records was exercised on the integrated base `23fc46df1e4a2f26cf8c0244a8566c4a97f5ba0c`. The fixture's separate Keycloak account remains enabled. This evidence covers the local seven-day class. Issuer lifecycle, unattributable mailbox records, historical linkage and operational acceptance remain open.

## Artifacts

- [#314](https://github.com/Maeximilion/MaexSocial/issues/314), [Task 5 / #166](https://github.com/Maeximilion/MaexSocial/issues/166), G3 MVP.
- [Tested implementation](https://github.com/Maeximilion/MaexSocial/commit/a94bae5f18b929ffaf17af297c5763f62f9a01bc), branch `dev-codex/314-customer-access-record-erasure`.
- [On-demand procedure](../../../ops/local/README.md#bound-customer-access-erasure-314), [source transaction](../../../ops/local/source-customer-erasure.ts), [offline replay](../../../ops/local/restore-history.ts), [physical drill](../../../tests/pilot/customer-erasure-drill.ts).

## Decisions

The owner-only instruction binds a marked disposable source, pilot issuer, local identity, exact issuer subject, authority version, authorization time, journal sequence and digest. Source and continued-pair replay accept a later journal extension only if its original authorized prefix still matches. Replay verifies the entire requested interval against its independent digest.

| Data and readers | Measured disposition |
| --- | --- |
| Identity and memberships | The original issuer subject and verification were removed. One unreferenced membership was deleted. A historical membership retains tenant, membership and identity keys, role, inactive state and incremented version. Its identity shell retains the local key, random replacement subject, false verification and incremented version. Historical grant versions remain in their original receipts. |
| Sessions and verification | Two sessions were deleted with their token/CSRF hashes, scope, factor and activity fields. Both the original token and its concurrently committed successor were denied. One exact identity-bound challenge lost its row, including mailbox, purpose, hash and timestamps. The invitation writer created no verification/reset row. The drill seeded challenge rows through the owner schema. |
| Invitations and mailbox overlap | The departing issuer's outstanding invitation retained its intended recipient, role, grant, token hash, issuer binding and timestamps with a new revocation time. Another issuer's invitation and one unbound challenge retain the matching mailbox. Neither records an immutable recipient identity. Mailbox cleanup needs an independent attribution decision. |
| Tenant content and approvals | Draft revisions and immutable approval rows were preserved. On the source the old unclaimed approval stopped authorizing a claim, and another Manager in that tenant could obtain a fresh proposal. The already-claimed occurrence retained its approval link and once-only attempt. Approval rows keep membership/version, tenant, draft/revision, occurrence, location/provider, due time and timezone, tenant version, MFA and creation times, grant version and grant-active snapshot. Withdrawal, claim and export use these bindings. The four fields eligible under a separately authorized whole-draft erasure in #312 remain subject to that distinct instruction. |
| Restricted audit and other access material | The held claim audit and original actor/occurrence keys, event time, action, outcome and reason remain under the incident disposition. These keys remain linkable. Pre-login OIDC state has browser/configuration bindings. Throttle buckets retain time-limited keyed account/source values. The whole-subject instruction does not identify an entire browser, mailbox or network source. |
| Maintenance evidence | The independent journal and owner-only receipt retain identity key, binding digest, version and scope for replay. Their keys remain correlatable. The application role was denied access to the receipt. |

The synthetic realm had registration and password reset disabled, zero enabled self-deletion actions and an enabled target. Its status client has `view-users` and could still read the target after AppDB cleanup. Admin deletion requires a separately authorized writer. Self-service requires the enabled Delete Account action and the account delete-account role. The customer instruction grants neither. The same issuer could be bound to a new authorized local identity in a future enrollment. Existing tokens and membership bindings cannot regain access through the old shell. [Fixture configuration](../../../ops/local/stack.ts), [Keycloak 26.8.2 Admin REST](https://www.keycloak.org/docs-api/26.8.2/rest-api/index.html), [Keycloak account self-deletion](https://www.keycloak.org/docs/latest/server_admin/index.html#enabling-account-deletion-by-users), [#131](https://github.com/Maeximilion/MaexSocial/issues/131), [#82](https://github.com/Maeximilion/MaexSocial/issues/82).

## Gate

The source database sampled authorization at 14:41:48.698 and confirmed committed cleanup at 14:42:23.416 on 2026-11-28 UTC. The conservative upper bound, including millisecond truncation, was 34.719 seconds. The source restarted successfully. Whole-row checks across all pilot tables counted one original issuer-subject match before erasure and zero after. Mailbox matches fell from three to the two independently retained records. The same-tenant and independent-tenant controls retained their access and application rows.

Three physical imports covered the original encrypted pair, a continued pair with a pending instruction, and one with an applied receipt. Each verified both encrypted databases under the original lineage cutoff. Restored service access stayed locked and six occurrences stayed quarantined per import. Each target rejected invalid histories without applying the later grant event. The valid extension replayed both events, survived database restart and replayed again with zero new events. The pending and applied pairs both rejected earlier entries altered by identity, authority version or an extra field. An injected deferred commit failure left the source unchanged. A retry detected a newly inserted conflicting challenge.

## Verification

Node 24.22.2, `npm run pilot:build`, `node --test tests/*.test.cjs` (20 passed), cold-backup and paired-restore format tests (six passed), `python scripts/check_repo.py` and `git diff --check` passed. `python -m unittest discover -s tests -v` with the configured scanner ran 134 tests with one Windows-inapplicable filename test skipped and zero failures. The earlier provisional-base migration failure was resolved by integrating migrations 016 and 017 before 018.

`node dist/pilot/tests/pilot/customer-erasure-drill.js` passed on the linked commit. The first development run had an early connection close and a later run needed explicit HTTPS readiness after restart. Both were corrected before the recorded drill.

On code revision `a94bae5f18b929ffaf17af297c5763f62f9a01bc`, `npm run pilot:up`, `npm run pilot:migrate -- up/down/up` (three invocations), `node --test dist/pilot/tests/pilot/migration-empty.js`, `npm run pilot:test` (63/63) and `npm run pilot:down` passed.

## Open

Main owns the expected-head merge after automatic Claude API review and candidate CI. Current evidence belongs on the PR and in the dated parent receipt. Task 5, issuer lifecycle, production scheduling, physical media sanitization and G3 acceptance require separate evidence or owner decisions.

## Lessons

A surviving tenant draft needs a new proposal after its approver departs. Customer erasure now uses the ordinary membership invalidation logic for unclaimed approval links. The immutable approval evidence and claimed/quarantined bindings serve independent purposes. Code Autopilot and Caveman are enabled. The implementation used Codex GPT-6.2 Astra High.
