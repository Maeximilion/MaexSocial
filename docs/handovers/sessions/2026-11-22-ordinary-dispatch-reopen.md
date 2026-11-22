# Handover 2026-11-22 — #266 ordinary local dispatch reopen

## Status

Stopped at (UTC) — 2026-11-22T21:42:57Z.

The Windows synthetic dispatch drill completed before PR publication. Its application,
database and browser runners used the pinned images. The host CLI used Node 26.13.0
with cached dependencies. Codex implemented the change on GPT-6.2 Sol with high effort.
The repository's Claude Messages API review and hosted candidate checks are pending
at this checkpoint.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial).
- Task — [#266](https://github.com/Maeximilion/MaexSocial/issues/266), under [#166](https://github.com/Maeximilion/MaexSocial/issues/166).
- Branch — `dev-codex/266-ordinary-dispatch-reopen`.
- Work head before the handover commit — `3c36dfeca3cf743e758630ce19e5efac37d45c27`.
- PR — pending at this checkpoint.
- [Operator commands and drill](../../../ops/local/README.md#explicit-reopen-266).
- `node dist/pilot/tests/pilot/dispatch-recovery.js` verified five database refusal cases,
  an unavailable mailbox and identity DB, a committed claim A before stop, one fake create
  and confirmed readback for A, zero creates for B and zero exports. The retained restart
  kept dispatch stopped. After explicit reopen, a new approved control created once.
- `node --test --test-concurrency=1 dist/pilot/tests/pilot/dispatch-stop.test.js dist/pilot/tests/pilot/dispatch.test.js`
  passed 3/3 outer tests, including the host manifest refusals.
- Empty migrations up/down/up and `migration-empty.js` passed. Repository check, Python
  foundation (133 total, 32 skipped) and Node foundation (20/20) passed. The Python test
  process excluded unrelated Sites Git configuration that lost empty values in Git grandchildren.
- An earlier retained Windows suite recorded 55/56. The host manifest test attempted to
  create a temporary directory inside the read-only runner. The targeted rerun passed after
  limiting that case to the host. The draft-edit and shared-source throttle cases passed
  during the retained run. This is a single routine observation for #233 and #238.
- The same-revision `restore-before-effects.js` drill passed. The source recorded one fake
  create and one terminal export. The paired target quarantined five occurrences, refused
  reopen and denied all four application logins across the first and repeated checks.
  Repeating quarantine changed zero rows. The target exposed no host ports.
- A pair captured on the preceding main revision verified and restored using this branch.
  Both databases restored offline, three historical occurrences went into quarantine,
  explicit reopen was refused and repeated quarantine changed zero rows. The temporary
  address-pool failure resolved after taking down only owned test projects.

## Decisions

The manifest and the AppDB fixture identity must both name ordinary provenance.
Legacy manifests remain usable for their supported controls. Reopen is an explicit
stop-row transition following topology, PostgreSQL readiness, TLS, application login,
fixture identity and migration checks. The existing private worker, quarantine,
historical attempts and paired-restore isolation keep their own authorities.
The backup verifier accepts explicitly listed compatibility across differing identity bootstrap hashes while
requiring the existing schema, stack, image and archive checks.

## Gate

This is bounded local evidence for [#166](https://github.com/Maeximilion/MaexSocial/issues/166).
[The G3 gate](https://github.com/Maeximilion/MaexSocial/issues/16) remains open.
The evidence covers synthetic local operation.

## Open

Verify and publish the ordinary GitHub PR against main. Record the linked Claude API
execution and complete current-head/base review, the tested integration candidate and
the hosted checks on the PR. The coordinator owns merge.

From PowerShell in the dedicated task worktree, build with `npm run pilot:build` and
run `node dist/pilot/tests/pilot/dispatch-recovery.js` against a running, migrated,
stopped ordinary fixture. A receiving session first verifies the current PR head,
base, review and candidate receipts.

## Lessons

A ready TLS service can recover before its Docker health status updates. The drill
observes each readiness predicate after releasing the simulated outage. Host-only
test scratch paths are checked on the host. Code Autopilot, Caveman and Ponytail
guided implementation and the pre-PR check.
