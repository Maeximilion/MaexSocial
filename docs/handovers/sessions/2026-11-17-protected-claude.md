# Handover 2026-11-17 — Maintenance #127

## Status

Checkpoint (UTC) — 2026-11-17T14:14:32Z.

Implementation and offline regression checks complete; ordinary bootstrap API review, current-candidate CI and coordinator merge remain pending at this pre-PR checkpoint. No manual protected dispatch or paid probe was run.

Implementation/review — Codex implementer, verified `gpt-6-astra` / `high` → ordinary Claude Messages API review pending. Provider settings remain Opus 5.5/high/standard. Local turn metadata did not expose a service tier; no Fast setting was enabled here.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial).
- Task — [Maintenance #127](https://github.com/Maeximilion/MaexSocial/issues/127).
- Branch — `dev-codex/127-protected-claude`.
- Work head before the handover commit — `959b248612eeb0b80a4b392160e23826fb0d7bc9` (bootstrap implementation staged after this baseline).
- PR — not yet opened at this checkpoint; next action is one normal PR, attached to its originating chat. The issue's Development link identifies it afterward.
- [Design](../../superpowers/specs/2026-11-17-protected-claude-design.md), [execution plan](../../superpowers/plans/2026-11-17-protected-claude.md), [operations and limits](../../tooling/claude-protected-review.md).
- Local checks: all 49 Claude tests including 18 new lifecycle/workflow tests; repository link/JSON/TOML/SVG validation; 20 Node tests; `git diff --check`; original three reviewer files have no diff. Full Python results and the exact final revision are recorded in the PR because scanner availability affects platform skips.

## Decisions

The coordinator approved the concrete design before implementation, including rerun rejection, schema-only result revalidation, protection of all new executable paths and rechecks before each publication. No original guard or API client changes. Execute trusted default-branch code only; never execute the task branch through dispatch. The unchanged ordinary route must independently review this bootstrap before merge. Later manual-route live proof belongs to the first genuine protected PR.

## Gate

Maintenance only; no product gate, deployment, new account/secret/recipient/budget or host setting. Root alone merges and archives. Require authentic successful API execution, complete exact head/base coverage, disposition of findings and current CI. The GET/POST publication race remains a documented merge-time check.

## Open

Create the normal PR, attach it immediately, verify maintenance/Project metadata and report its ordinary Claude run and exact integration candidate to the coordinator. Address confirmed findings within that PR; no substitute reviewer or duplicate paid trigger.

- Console — PowerShell.
- Folder/worktree — `C:/Users/Maxi/.codex/worktrees/127-protected-claude/MaexSocial`.
- Full start command — `Set-Location 'C:/Users/Maxi/.codex/worktrees/127-protected-claude/MaexSocial'; git status --short --branch; git fetch origin --prune; python -m unittest discover -s tests -p 'test_claude*.py' -q`.
- First message — “Continue only issue #127 from this handover. Read the current coordinator handover and live PR state, preserve the original three reviewer files, verify actual ordinary API review/CI and report to the authorized coordinator. Do not dispatch the new route before its trusted merge, merge or archive.”

## Lessons

The existing publisher is inline YAML, so minimal reuse of its REST payload avoids executable-source extraction and a second provider client. A synthetic envelope passed to `result_from` verifies schema only; successful execution of the unchanged API step is indispensable completion evidence. A review can become stale between its inline write and summary, so each write needs its own revision check.
