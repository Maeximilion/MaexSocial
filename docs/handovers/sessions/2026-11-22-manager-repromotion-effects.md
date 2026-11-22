# Handover 2026-11-22 — #276

## Status

Local evidence completed at 22:32 UTC on the task branch
`dev-codex/276-manager-role-dispatch-export`, based on
`f8ebae76a7cd9507cf88b32fe0e543e117311c08`. The isolated runner used Node
24.22.2 and cached pinned images. The TypeScript build used host Node 26.13.0.
The empty migration up/down/up drill and its historical-data guard passed.
The four focused pilot suites passed all 33 inner tests. The task fixture
stopped with zero running containers.

At 22:49 UTC the same fixture was restarted on the released base
`f059c47145125ab94be181a5a6ad31e5bbbe1a12` after PR #278 merged. The build,
migration 012 up, and the four focused suites passed with 35 inner tests,
including the two private withdrawal tests from the new base. The Manager
role transition case still passed. The fixture stopped again with zero running
containers. Foundation checks passed on the rebased source.

The repository checker and all 20 foundation Node tests passed. The first Python
discovery run hit two Git errors on Windows. After preserving the inherited empty
Git configuration values in `GIT_CONFIG_PARAMETERS` for the test process, discovery
reported 133 tests, 32 skipped, and zero failures or errors.

## Artifacts

- [Issue #276](https://github.com/Maeximilion/MaexSocial/issues/276)
- [Accepted Task 4 matrix, line 52](https://github.com/Maeximilion/MaexSocial/blob/1e2f573fac3088320c65e3bbafded1a3a216b438/docs/superpowers/plans/2026-11-05-ms-009-local-text-pilot.md#L52)
- [Regression test](../../../tests/pilot/occurrence-export.test.ts)

From the task worktree root with locked dependencies and cached fixture images:

```text
npm run pilot:build
npm run pilot:up
npm run pilot:migrate -- up
npm run pilot:migrate -- down
npm run pilot:migrate -- up
node --test dist/pilot/tests/pilot/migration-empty.js
node --test --test-concurrency=1 dist/pilot/tests/pilot/occurrence-export.test.js dist/pilot/tests/pilot/management-role-change.test.js dist/pilot/tests/pilot/dispatch.test.js dist/pilot/tests/pilot/reconcile.test.js
npm run pilot:down
```

## Decisions

The test calls the existing private approval, management role change, dispatch,
export, and reconciliation operations. After demotion and re-promotion of the
same Manager, the two unclaimed occurrences have zero creates, attempts, text
releases, or occurrence audits. Their original approval rows remain unchanged.
Fresh approval with the current Manager session yields one fake create bound to
the exact approved revision and, on the occurrence without access, the exact text
and one export audit across repeated downloads. A third occurrence retains its
original approval and attempt and reaches confirmed by fake readback with its
single original create and no export. No runtime change was needed.

## Gate

This evidence covers one synthetic sequence in Task 4. [#165](https://github.com/Maeximilion/MaexSocial/issues/165)
retains integrated Task 4 acceptance. [#131](https://github.com/Maeximilion/MaexSocial/issues/131)
retains real identity and MFA. G3 remains open.

## Open

At this checkpoint, publication follows the preceding serial delivery. Hosted
candidate CI and the current-head/base Claude Messages API review are pending.
The coordinator owns integration and merge.

## Lessons

Check the old export with the current Manager session and an absent grant. This
isolates invalidated approval from stale caller authority or a grant denial.
