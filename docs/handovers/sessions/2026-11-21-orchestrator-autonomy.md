# Handover 2026-11-21 — maintenance #201

## Status

Checkpoint (UTC) — 2026-11-21T23:11:15Z. Implementation is pushed in open PR #202; the latest review findings are being resolved in this same maintenance session. Product orchestration remains cancelled by the owner's newer instruction; this delivery does not restart it.

Codex implemented the personal skill and repository adapter. The separate fresh-context Ponytail reviewer used `gpt-6-astra` / High. Its initial combined review found missing stop propagation in both the personal skill and adapter (fixed), and redundant routine planning in the repository skill-role table (fixed). Its subsequent review of the full personal body and UI metadata found zero defects. The final targeted recheck of explicit invocation and UI policy also returned Ship, with zero findings at the exact personal hashes below. Main did not supply these independent reviews.

Local checks passed after each correction: `python scripts/check_repo.py`, `python -m unittest tests.test_foundation` (12 tests), and `git diff --check`. The exact personal two-file inventory and both hashes passed a local assertion. A fresh evaluator exercised nine instruction cases plus a missing-acknowledgment pause case before later Claude corrections; these were hypothetical decisions, not native execution. Earlier broad local results (129 Python tests, one platform skip; 20 Node tests) predate this final documentation change. Final candidate CI must provide current coverage.

Claude API executed on work head `ce2c9755dc1e2624182fc80608fc5ef3379a964a` against base `adbcb9c264e207bed7b5a98a269f0c5951ec44b4`: [run](https://github.com/Maeximilion/MaexSocial/actions/runs/44960250028), [result](https://github.com/Maeximilion/MaexSocial/pull/202#issuecomment-7070674455). Its ownership/entry findings are addressed by this update. The recorded parent is a historical checkpoint, not the resume target; always use the live PR head and matching review/CI. A review for the new head is pending. The unchanged client requests `claude-opus-5-5`, effort `high`, speed `standard`, `service_tier=standard_only` and validates the returned model. No Claude configuration or reviewer client changed.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial).
- Task and issue — [maintenance #201](https://github.com/Maeximilion/MaexSocial/issues/201).
- Branch — `dev-codex/201-orchestrator-autonomy`.
- Work head immediately before this handover update (historical parent, not resume target) — `ce2c9755dc1e2624182fc80608fc5ef3379a964a`.
- PR — [#202](https://github.com/Maeximilion/MaexSocial/pull/202), open; use its actual final head/review/CI before integration.
- Entry and adapter — [START](../../../.codex/orchestration/START.md), [MaexSocial adapter](../../../.agents/skills/coordinate-project-chats/SKILL.md).
- Personal edition — installed outside the repository, not distributed by this PR or reviewed by its Claude workflow. Historical review hashes: `orchestrator/SKILL.md` SHA-256 `80b821ca4f97a0801f213a975ec70e341b990f4106ecd91dbd5d303ab93ae22e`; `orchestrator/agents/openai.yaml` SHA-256 `835543744a0ab20e9eb2ce7e3e98f509ba8e49641421cb7bd94b9b4b58eb8db8`. The adapter's current table is the sole authoritative pin.

## Decisions

Use Superpowers for planning, one Main for decisions, at most five workers and at least 600 seconds between actual starts. Prefer authorized `send_message_to_thread` both ways; bounded readback is fallback. Workers verify incoming coordinator identity, assignment and latest owner control. Preserve stop propagation, acknowledgment tracking, live resume reconciliation, the standing 7%/unknown-reading intake hold, product gates and serial stacked integration.

Start MaexSocial with its repository entry. Verify the personal two-file inventory and both hashes before loading its body; implicit personal invocation is disabled. Changed editions require independent actual-content review evidence and a merged maintenance pin-update PR, not Main self-review or a private-ledger edit. This is procedural verification, not technical enforcement of the desktop loader.

The owner explicitly requested unrestricted normal native chats on 2026-11-21. This changes the desired access recommendation, not configuration files; the adapter records the security tradeoff. External content stays untrusted, and Graphify use authorizes no private-data upload or paid rebuild. Ponytail runs before PR creation; existing Claude API PR review remains mandatory. After verified merge, remote delivery and handover, close the owned worktree and archive its work chat, checking both outcomes and preserving only genuinely needed unpublished work. No routine backup packages.

## Gate

Maintenance only; no product gate acceptance, deployment, real customer operation or new provider service is authorized. Current [CURRENT](../../../.codex/orchestration/CURRENT.md) entries remain dated recovery evidence. The owner deleted the replacement product coordinator and its work chats; future product ownership must be reconciled against a fresh owner instruction. Required final-head Claude coverage and current candidate CI remain outstanding at this checkpoint.

## Open

Complete the actual final-head Claude review and candidate CI for PR #202, resolve confirmed findings, then merge within the existing maintenance authority, synchronize clean canonical main and close out the owned worktree. Preserve the original Main and the requested test chat as such; do not start product tasks.

- Console — PowerShell.
- Folder/worktree — `Join-Path $env:USERPROFILE '.codex/worktrees/201-orchestrator-autonomy/MaexSocial'`; the resolved machine-specific path is retained in the private coordinator record.
- Full start command — `Set-Location (Join-Path $env:USERPROFILE '.codex/worktrees/201-orchestrator-autonomy/MaexSocial'); git status --short; git branch --show-current; git rev-parse HEAD`.
- First message — "Continue maintenance #201 from docs/handovers/sessions/2026-11-21-orchestrator-autonomy.md and live PR #202. Verify actual head/base, complete unchanged Claude API and candidate CI, then integrate and close out only this maintenance delivery. Preserve latest owner controls and do not resume product orchestration."

## Lessons

The new normal local test chat exposed `gpt-6.2-astra` / High, `danger-full-access` / `never`; `Get-Location` exited 0 and real messages were delivered in both directions without a dialog. It also checked the personal hash, explicit-only metadata and documented adapter-first order. These observations do not prove every future chat, the host's actual loading sequence or worktree archival. The earlier messaging-permission popup's cause remains unknown; historical calls used the same MCP transport.

Code Autopilot and Caveman remain enabled. Superpowers plans; Ponytail reviews before PR creation. Keep the personal and repository review scopes distinct. No access configuration, product code or dependency was changed. Private paths, chat identities and live queue details stay in the private coordinator record; GitHub delivery evidence is sufficient for routine closeout.
