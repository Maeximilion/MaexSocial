# Handover 2026-11-22 — #255 matched-build rollback

## Status

The matched-build restore reached verified offline readiness in **19.352 seconds** against a
300-second synthetic drill budget. It retained both snapshot markers and excluded both recorded
post-snapshot changes. The 009 build refused the unmodified 010 pair before creating a target.

## Artifacts

- Repository and task — [Maeximilion/MaexSocial #255](https://github.com/Maeximilion/MaexSocial/issues/255).
- Delivery branch — `dev-codex/255-pilot-build-rollback`. The issue links the delivery PR and review.
- Work head before the final handover — `0e5f7b03f6098549701b3b55da79fde143bc0dfc`.
- Implementation — Codex Sol 6.2, high effort. The Claude Messages API review runs on the delivery PR.
- Earlier build — [7fb856db885c58b005360f979f9ba743172e6834](https://github.com/Maeximilion/MaexSocial/commit/7fb856db885c58b005360f979f9ba743172e6834).
  It includes migration 009, [#248](https://github.com/Maeximilion/MaexSocial/issues/248)'s capture-history anchor
  and [#250](https://github.com/Maeximilion/MaexSocial/issues/250)'s 30-day expiry guard.
- Newer build — [e2e3c8e2d03629e1732e9c188245121dcfad1e4a](https://github.com/Maeximilion/MaexSocial/commit/e2e3c8e2d03629e1732e9c188245121dcfad1e4a).
  [PR #256](https://github.com/Maeximilion/MaexSocial/pull/256) adds the nullable boolean
  `pilot.approvals.grant_active_at_approval` in migration 010. It was present on the live newer fixture
  and absent from the 009 restore. Both 009 membership-audit columns were present after restore.

| SHA-256 prefix | Build 009 | Build 010 |
| --- | --- | --- |
| AppDB migration inputs | `469a2678606fecf7` | `3ae9f21ff752c8dd` |
| Applied AppDB schema | `93a86143bc20604c` | `19f8762351fa53c2` |
| IdP changelog | `ce701dbd5a5f4344` | Same digest |
| AppDB archive | `587f395281285203` | `57d38458136f8e0d` |
| IdP archive | `827a9de4fe1af528` | `b608b73d86f7ebcb` |

The IdP configuration and stack fingerprints matched. Both builds used the same
[Compose image digests](../../../ops/local/compose.yaml), with PostgreSQL `17.11-bookworm` for both
databases, Keycloak `26.8.2`, Mailpit `v1.33.0` and the Node `24.22.2-bookworm-slim` runner. Restore
checked the captured schema fingerprints and history anchor before making the databases available.
A separate query confirmed the IdP changelog digest after restore. Both pairs' original archive
and manifest hashes were unchanged after testing.

## Decisions

At `19:04:34.227 UTC` on 2026-11-22, before capture, the drill set a 300-second budget from requesting
a stop of 010 through rebuilding 009, importing the pair and verifying offline readiness. Both
snapshot markers had to survive. One later change per source database was expected to be absent.

| UTC on 2026-11-22 | Event and observation |
| --- | --- |
| `19:05:13.168` | 009 recovery point. AppDB held the `Cold Backup Orchard` tenant. IdP held the disabled capture user without a first-name marker. The pair bound history sequence 1. |
| `19:06:11.629` | Inserted and verified a second tenant in the same AppDB source, 58.461 seconds after capture. |
| `19:06:11.798` | Added and verified a first-name marker on the same disabled IdP user, 58.630 seconds after capture. |
| `19:11:59.242` | Captured and verified the independent 010 pair. The newer fixture ran with the 010 column and passed its export test. |
| `19:14:36.806` | Requested stop of 010. The 009 snapshot was 563.638 seconds old, including the wait for #252 integration and fixture preparation. |
| `19:14:56.161` | Verified the 009 restore at 19.352 seconds on a monotonic clock. Both original markers were present and both later changes were absent. |

The negative control returned exit 1 with the incompatible build/schema/configuration error before
`work/pilot` or a readiness record existed. The matched 009 restore verified both databases in
fresh volumes. All three historical occurrences were quarantined with prior state `draft`.
Dispatch was stopped, app and Keycloak database logins were disabled, and only the two PostgreSQL
containers ran on two internal networks with zero published host ports. Repeating quarantine
changed zero rows. All fixtures used in the drill were stopped afterwards.

## Gate

This run measures the two changes made on the 009 source timeline. The 010 build ran in its own
synthetic fixture. Integrated recovery across dispatch and export remains under
[#166](https://github.com/Maeximilion/MaexSocial/issues/166). Operating targets, custody and
staging remain under [#82](https://github.com/Maeximilion/MaexSocial/issues/82).

## Open

Main owns merge and verifies the current candidate CI and complete Claude API review against the
delivery PR. To reproduce from PowerShell, use Node 24.22.2, npm 11.19.1, the cached pinned images,
fresh linked checkouts at the two recorded revisions and a third fresh 009 checkout for restoration.
Install locked dependencies with `npm ci --offline --no-audit --no-fund` in each.

1. In 009, run `npm run pilot:backup -- capture --disposable` and `npm run pilot:backup -- verify`.
   Record the two archive hashes and manifest hash. To measure loss, start only the source's
   `postgres` and `identity-db` services with Compose. Confirm the capture markers, insert
   a second AppDB tenant and set a first-name marker on the disabled IdP user. Record the UTC
   change observations and read back both changes. Stop the source with `npm run pilot:down`.
2. In 010, capture and verify an independent pair, then run `npm run pilot:up`. Check the migration
   column in `information_schema.columns` and run
   `node --test dist/pilot/tests/pilot/occurrence-export.test.js`. Eight tests passed inside its runner.
3. From the fresh 009 checkout, run `npm run pilot:restore -- <010-fixture-directory>`. Require the
   compatibility error, exit 1 and no `work/pilot`. Check the original source hashes.
4. Start the clock when requesting `npm run pilot:down` for 010. In the 009 restore checkout, run
   `npm run pilot:restore -- <009-fixture-directory>`, which rebuilds 009 before import. Verify the
   database markers, schemas and offline state above before stopping the clock. Run
   `npm run pilot:restore-quarantine` to check zero further changes, then `npm run pilot:down` and
   recheck both pairs' hashes.

## Lessons

The first matched import reported readiness. An added IdP check failed because both joined tables
had an `enabled` column. The target was stopped. The successful timing uses the qualified query,
a fresh 009 target and a new cutover from the same 010 fixture. Both original pairs remained fresh
under the 30-day rule. The focused cold-backup and paired-restore tests passed 3/3 on build 009.
