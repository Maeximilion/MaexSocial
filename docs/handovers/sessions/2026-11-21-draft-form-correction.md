# Handover 2026-11-21 — #179 draft form correction

## Status

Checkpoint (UTC) — 2026-11-21T17:02:54Z. The create and edit forms return a focused, accessible correction form on HTTP 400 when the text is the invalid field. This checkpoint precedes PR publication.

Implementation and review — Codex and the repository's Claude Messages API workflow. The documented review configuration is Opus 5.5, high effort, standard speed and `standard_only`. The delivery review and hosted candidate checks await publication.

| Local verification | Actual result |
| --- | --- |
| `npm ci --prefer-offline`, `npm run pilot:build` | Passed with Node 24.22.2 and npm 11.19.1. The strict build preceded pilot tests. |
| `npm run pilot:up`, `npm run pilot:migrate -- up`, `-- down`, `-- up`, `node --test dist/pilot/tests/pilot/migration-empty.js` | A fresh isolated fixture initialized. Empty migration up/down/up and the unknown-object rollback check passed. |
| `node --test dist/pilot/tests/pilot/portal-keyboard.test.js` before the fix | The existing submit route returned HTTP 400 with `text/plain`. The new browser assertion expected `text/html` and failed. |
| `node --test --test-concurrency=1 dist/pilot/tests/pilot/portal-keyboard.test.js dist/pilot/tests/pilot/drafts.test.js` after the fix | Both host entries passed. Chromium corrected both 1,501-code-point submissions on their response pages. All 11 nested PostgreSQL checks passed, including rollback and the stale edit conflict. |
| `npm run pilot:test`, `npm run pilot:down`, `npm run pilot:up`, `npm run pilot:test`, `npm run pilot:down` | 28/28 passed before and after the retained-volume restart. The fixture stopped with its database and mailbox volumes preserved. |
| `python -m unittest discover -s tests`, `node --test tests/*.test.cjs`, `python scripts/check_repo.py`, `git diff --check` | Python 122 passed and one Windows-inapplicable filename test skipped, with configured Gitleaks 8.30.1. Node 20/20, repository check and whitespace check passed. |

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial).
- Task — [#179](https://github.com/Maeximilion/MaexSocial/issues/179), a bounded child of [#124](https://github.com/Maeximilion/MaexSocial/issues/124).
- Branch — `dev-codex/179-draft-form-correction`.
- Work head before the handover commit — `7b089b1abf8fbc982c6183d326b88b373e7ca348`.
- PR — pending the coordinator's confirmed publication slot and base.
- Source and checks — [content routes](../../../apps/web/src/routes/content.ts), [customer app](../../../apps/web/src/server/customer.ts), [draft persistence](../../../tests/pilot/drafts.test.ts) and [keyboard journey](../../../tests/pilot/portal-keyboard.test.ts).

## Decisions

Render the correction under the authorization and object locks, then roll back before sending the HTML response. Check the edit revision before text validation. The form therefore retains the submitted revision when it is current, and a later competing save leads to the existing conflict response. The server supplies the location options and preserves the selected option from that list. Text stays within the existing 20 KiB form-body limit. The textarea preserves normalized line endings and encodes HTML metacharacters. Null characters in rejected text display as replacement characters.

## Gate

[G2 acceptance](https://github.com/Maeximilion/MaexSocial/issues/15#issuecomment-6681723454) covers local synthetic work. This delivery tests the existing draft forms with invented data. Integrated [#124](https://github.com/Maeximilion/MaexSocial/issues/124), [#131](https://github.com/Maeximilion/MaexSocial/issues/131) and [G3](https://github.com/Maeximilion/MaexSocial/issues/16) remain open.

## Open

Confirm the coordinator's publication base, then publish one normal PR with `Closes #179`. Attach and verify it in its creating chat. Record the actual Claude API run and complete result and check CI on the exact integration candidate. The coordinator owns the merge and archive. Verify private recovery of the original Git state and retained fixture before archival.

- Console — PowerShell with Node 24.22.2 and npm 11.19.1 on `PATH`.
- Folder — Dedicated worktree listed by `git worktree list` for `dev-codex/179-draft-form-correction`. The absolute path is in the authorized coordinator's private ledger.
- Start — From that root, `git status --short --branch; node --version; npm.cmd run pilot:build`.
- First message — Resume issue #179 from this checkpoint and reconcile the coordinator's publication authorization and current base.

## Lessons

Check the failed navigation's content type before waiting for field focus. This surfaces the original plain-text response directly. The browser verifies focus, error association and retained text on the submitted page. Independent SQL reads verify the invalid edit leaves saved revisions, domain records and session activity untouched. Code Autopilot and Caveman remain enabled under the repository workflow.
