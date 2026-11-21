# Handover 2026-11-21 — #190

## Status

Stopped at (UTC) — 2026-11-21T18:09:47Z for the pre-PR checkpoint. The local CLI recorded six fictional observations for five jobs. Two jobs were complete, two were incomplete, and one failed on conflicting rights evidence. Changing the source or revision, withholding rights or capture evidence, and duplicating a job were exercised in five focused tests.

On Windows with Python 3.14.7, `python scripts/check_repo.py` and `python -m unittest discover -s tests -p test_media_evaluation.py -v` passed. `node --test tests/*.test.cjs` passed 20 tests with Node 26.13.0. The combined Python suite hit an inherited Git environment error in the existing temporary-repository hook test. A fresh `python -m unittest discover -s tests -p <module>.py` process per test module passed 96 tests and skipped 32 that require unavailable Gitleaks.

Codex implemented the change. Hosted CI and the repository's automatic Claude API review are pending on the first delivery PR. The configured Claude Opus 5.5, high effort, standard speed and `standard_only` settings remain the expected route. Actual execution and reviewed revisions are established from the published run.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial)
- Task — [#190](https://github.com/Maeximilion/MaexSocial/issues/190)
- Branch — `dev-codex/190-offline-media-evaluation`
- Work head before the handover commit — `608fb29fc440241cd516789558ba2eb397fad298`
- PR — pending first publication
- [Evaluator](../../../scripts/media_evaluation.py), [fixture](../../../tests/fixtures/media-evaluation-v1.json), [tests](../../../tests/test_media_evaluation.py) and [local receipt](../../08_EVALS.md#offline-media-trial-records)

## Decisions

Use one reconciled snapshot per fictional job. Exact repeats count once and conflicting snapshots cannot contribute a trusted measurement. Compare rights with the supplied source and revision. Keep capture, cancellation and charge evidence independent. Quality, latency and other absent measurements stay explicit. The evaluator recognizes no approved thresholds.

## Gate

[#190](https://github.com/Maeximilion/MaexSocial/issues/190) is independently authorized offline G4 preparation. [#167](https://github.com/Maeximilion/MaexSocial/issues/167) owns the candidate, scope, rubric and thresholds. [#11](https://github.com/Maeximilion/MaexSocial/issues/11) owns the later authorized spike, provider decision and implementation evidence. [#99](https://github.com/Maeximilion/MaexSocial/issues/99) retains format and release evidence. G4 acceptance remains open.

## Open

Publish the normal PR in the coordinator's delivery order, attach it to the originating chat, and verify the current hosted CI and complete Claude review. The coordinator owns the serial merge and archival.

- Console — PowerShell with Python 3.12 or later.
- Folder — registered worktree for `dev-codex/190-offline-media-evaluation`. The coordinator's private assignment contains the exact path.
- Start command — from that worktree, run `python scripts/media_evaluation.py tests/fixtures/media-evaluation-v1.json`.
- First message — Continue #190 in its assigned worktree. Read this handover and check the live PR and reviewed candidate before reporting merge readiness.

## Lessons

The combined Windows test process loses empty inherited Git config values after the environment is cleared and restored by an existing test. Fresh processes avoid that interaction. All evidence needed to replay the fictional assessment is tracked in the branch. No provider, credential or media artifact is needed to reproduce the receipt.
