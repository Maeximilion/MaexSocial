# Handover 2026-11-06 — Maintenance #119

## Status

Checkpoint UTC: 2026-11-06T10:44:00Z. The complete-input envelope is implemented and the work head below is pushed. Independent review is running; PR publication, hosted checks and coordinator disposition remain pending at this checkpoint. The issue and eventual delivery PR carry subsequent exact-head evidence. No product files or billing settings changed.

Implementation/review — Codex → Claude review, with required independent GPT-6 Astra/high. Implementer and fresh independent reviewer both have verified `gpt-6-astra` / `high` session settings with no Fast override. The reviewer has no inherited conversation context; its final verdict is not yet available. This reviewer-maintenance change touches protected files, so an authentic hosted self-skip is expected and must never be called completed Claude analysis.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial)
- Task — [Maintenance #119](https://github.com/Maeximilion/MaexSocial/issues/119)
- Branch — `dev-codex/119-claude-envelope`
- Work head before the handover commit — `bcfe6125d45f44d818f573b4cfee6c48d7c42c62`
- Base — `4e28499dc1f129d96a06faa8f410cf85a4ddbb3d`
- PR — not yet opened at this checkpoint; create exactly one normal delivery PR in this work chat
- Decision — [coordinator disposition](https://github.com/Maeximilion/MaexSocial/issues/119#issuecomment-6682864492)
- Limits, sources, cost assumptions and reproduction — [preflight guide](../../tooling/claude-input-preflight.md)

Checks on the work head: `python scripts/check_repo.py` passed; `python -m unittest discover -s tests` with `MAEXSOCIAL_TEST_GITLEAKS` set to the configured installed scanner ran 96 tests (95 passed, one expected Windows filename skip); `node --test tests/*.test.cjs` passed 20 tests. Before enabling that scanner in the test environment, the unchanged baseline ran 92 tests with 32 skips. An initial new fixture counted its trailing newline as one escaped byte instead of two; correcting the fixture made all four affected cases pass. No production guard was weakened to fix a test.

The actual read-only pinned #118 preflight passed under isolated Python: 90,142 escaped diff bytes, 94,713 escaped prompt bytes, 90,598 actual serialized request bytes, no gaps. Base/head and metadata caveat are in the guide. HTTPS was mocked for transport tests; no Anthropic request was made. The previous live incomplete receipt remains valid historical evidence, not a failed model verdict.

## Decisions

Use the approved 120,000 diff / 140,000 prompt / 150,000 complete JSON-byte limits. The builder and transport share the same pure serializer, and the transport retains its final size guard. Unknown, unavailable or oversized automatic input stays visibly incomplete and unreviewed. Existing trusted mention semantics are preserved within the envelope. Preserve Opus 5.5/high/standard, 8,192 output tokens, one tool-free request, no retries, protected self-skip, default-branch execution, fork/secret isolation and exact SHA binding. USD0.85 is a conservative planning assumption, not a guaranteed per-request charge; the owner-reported USD75 monthly limit is unchanged and not independently verified.

## Gate

Maintenance only, no product gate or deployment approval. The coordinator alone merges, dispositions the protected self-skip and verifies the merged workflow on #118's next ordinary eligible current-head event. #114/#118 owns product code and Linux runtime checks. No extra paid probe, self-triggered bot fallback, second delivery PR or independent merge is authorized.

## Open

Finish the current independent review, address concrete findings, create and attach the normal PR, then record final head/candidate CI and genuine protected self-skip evidence on the PR and #119. Send the complete checkpoint to the authorized coordinator. The coordinator handles merge ordering, post-merge #118 coverage and archival only after full recovery verification. Pause new implementation, pushes and PRs by 2026-11-06 11:30 UTC (12:30 Europe/Berlin), unless the owner supersedes that deadline.

- Console — PowerShell
- Folder/worktree — `C:/Users/Maxi/.codex/worktrees/119-claude-envelope/MaexSocial`
- Full start command — `Set-Location 'C:/Users/Maxi/.codex/worktrees/119-claude-envelope/MaexSocial'; git status --short; git fetch origin --prune; gh issue view 119 --comments; gh pr list --head dev-codex/119-claude-envelope --json number,url,headRefOid,state`
- First message — Resume only Maintenance #119 using this handover and the latest issue/PR checkpoint. Respect the owner pause, preserve the approved limits and product ownership, and reconcile final independent review, hosted CI and self-skip evidence without a paid probe or merge.

## Lessons

The old limits protected a retired environment-variable transport. Escaped source text and actual serialized JSON are distinct measurements, both different from billable tokens. Measure the complete request including schema and metadata; retain all lockfile and test content. Code Autopilot and Caveman remain enabled, with Ponytail for this bounded maintenance fix. Only explicit `/start` or `/task` invokes advisory alert checks.
