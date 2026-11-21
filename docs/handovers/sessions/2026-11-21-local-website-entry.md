# Handover 2026-11-21 — #183

## Status

Stopped at (UTC) — 2026-11-21T17:20:37Z. The responsive local customer entry is implemented. The HTTPS entry and the established logout contract were exercised on the integrated work head. The build and all 29 pilot tests passed with Node 24.22.2/npm 11.19.1 on this work head. The link and artwork check passed. Foundation Python ran 123 tests with 32 skips after clearing an inherited Git setting in that test process. All 20 foundation JavaScript tests passed. The earlier direct Python invocation failed in a temporary Git repository before the isolated retry.

Codex implemented the change. The repository's automatic Claude API review and hosted CI are pending on the first delivery PR. The approved reviewer configuration remains Claude Opus 5.5, high effort, standard speed and `standard_only`. Actual execution is verified after publication.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial)
- Task — [#183](https://github.com/Maeximilion/MaexSocial/issues/183)
- Branch — `dev-codex/183-local-website-entry`
- Work head before the handover commit — `49d9d0ba7da933d2ec386823bb47e5dd77d5280c`
- PR — pending publication in the coordinator's serial window
- [Entry view](../../../apps/web/src/routes/entry.ts), [HTTPS browser test](../../../tests/pilot/entry-browser.test.ts) and [customer journey](../../06_GUI.md)
- Local visual evidence — `work/portal-preview/entry-desktop.png` and `work/portal-preview/entry-mobile.png`. Both show the example open and focused. The coordinator holds a verified local copy with an interactive offline export.

## Decisions

Keep `GET /` and the signed-out confirmation. The preview uses a native disclosure and a fictional bicycle-shop post. It presents a location, channel and review state. The entry view owns the English copy, approved color variables, system fonts, layout, and example values. It can be edited independently of protected draft rendering. Customer sign-in is unavailable in the local preview.

## Gate

The [G2 acceptance](https://github.com/Maeximilion/MaexSocial/issues/15#issuecomment-6681723454) authorizes local synthetic work. [#163](https://github.com/Maeximilion/MaexSocial/issues/163) retains the staging entry and integrated customer journey. Approved public notices, actual account lifecycle, domain and hosting decisions, and G3 acceptance remain open.

## Open

Publish the first normal PR in the coordinator's approved window. Verify its attached PR, current-head/base Claude API result and integration CI. The coordinator owns merge and archival.

- Console — PowerShell with Node 24.22.2/npm 11.19.1 and Docker available.
- Folder — the registered `dev-codex/183-local-website-entry` worktree. Its exact local path is in the private recovery handover.
- Start command — `npm ci; npm run pilot:build; npm run pilot:up; npm run pilot:migrate -- up; node --test dist/pilot/tests/pilot/entry-browser.test.js` from that worktree. The last command starts the isolated HTTPS customer origin for the browser test.
- First message — Continue #183 in its assigned worktree. Verify the live PR and current candidate before changing the entry or its status.

## Lessons

Native HTML handled pointer and keyboard disclosure within the current content security policy. The draft example runs without external requests, database access, identity lookups or session cookies. Code Autopilot and Caveman remain enabled under the repository workflow. The security advisory check remains reserved for an explicit `/start` or `/task`.
