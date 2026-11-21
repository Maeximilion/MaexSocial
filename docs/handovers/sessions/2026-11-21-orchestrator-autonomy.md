# Handover 2026-11-21 — maintenance #201

## Result and scope

[Issue #201](https://github.com/Maeximilion/MaexSocial/issues/201) replaces duplicated repository orchestration procedures with the personal `$orchestrator` skill and a small [MaexSocial adapter](../../../.agents/skills/coordinate-project-chats/SKILL.md). The [start prompt](../../../.codex/orchestration/START.md) loads both. The personal skill and its UI metadata are installed in the owner's Codex skills directory; they are not distributed by this repository or reviewed by its PR workflow.

The latest owner direction cancelled the replacement product coordinator and its work chats. This maintenance chat handles this delivery only. No product task is resumed. The historical [CURRENT](../../../.codex/orchestration/CURRENT.md) remains recovery evidence and now explicitly defers to current owner control and live state.

## Operating decisions

- Superpowers plans bounded work. Main decides routine technical questions autonomously. At most five worker slots are occupied; actual new starts are at least 600 seconds apart, with no accumulated missed intervals or predecessor-PR admission tokens.
- Prefer authorized `send_message_to_thread` in both directions for concise questions, decisions, milestones and completion reports. If sending is unavailable, blocked or uncertain, preserve the report in its own chat and use bounded status/readback. A receipt, actual delivery and acknowledgment are distinct.
- Normal local chats request High/Standard. Effective runtime rights and messaging-tool approval are separate observations; prompts and global settings cannot guarantee either. Do not invent permission parameters or bypass native approvals.
- The owner explicitly requested unrestricted native chats on 2026-11-21. This changes the recommended operating profile, not configuration files; the adapter documents the reduced command/filesystem protection when full access is effective. External content remains untrusted evidence. The standing 7% intake cutoff and unknown-reading hold remain until an explicit owner change.
- Ponytail reviews before PR creation under the latest owner instruction. The existing Claude API review still covers each repository PR afterwards. Claude settings, workflow/client, budgets, access configuration and product gates are unchanged.
- After verified serial merge, remote revision and handover, close the owned task worktree and archive its chat automatically. Verify both outcomes separately. Preserve needed unpublished material selectively; create no routine recovery packages, transcript copies or fixture backups.

## Verification evidence

A new normal local desktop test chat recognized the personal skill and reported `danger-full-access` with `never`. Main read a technical question, decided it, and sent the answer. The worker executed `Get-Location` successfully with exit code 0. A subsequent single direct worker-to-Main message was received in Main; the worker reported no permission dialog. These observations cover that test chat, not every future chat or worktree archival.

Historical read-only evidence confirms earlier workers used the same native creation and MCP messaging tools. The reason an earlier test chat requested a messaging permission remains unknown; it is not evidence of a changed transport or an automatic rights-inheritance guarantee.

The final simplification passed `python scripts/check_repo.py`, `python -m unittest tests.test_foundation` (12 tests), and `git diff --check`. A fresh evaluator exercised nine instruction cases plus the missing-acknowledgment pause case; these are hypothetical decisions, not native execution. The requested Ponytail pre-PR review used `gpt-6-astra` with High effort. Its two findings were fixed and the targeted recheck returned Ship: restore stop propagation/acknowledgment tracking and remove redundant planning from routine coordination.

The prior narrow revision also passed 129 Python tests with one platform skip and 20 Node tests. Those broad results predate the final documentation simplification; final candidate CI must supply current coverage. The Python test child excluded only verified host-injected credential/url/http Git overrides and retained configured Gitleaks. Subsequent Claude API/candidate-CI evidence belongs with the actual delivery revision in the PR. No access configuration, product code or dependency changed.

## Delivery and continuation

- Branch: `dev-codex/201-orchestrator-autonomy`.
- Superseded published revision: `518962c398e58543b0bd781a22ecad4e331bc24e`; use the PR's final head and evidence, not this old checkpoint.
- Remaining at this checkpoint: normal PR, unchanged Claude API review and required candidate CI, then serial merge and closeout within the owner's maintenance authorization.
- Private machine paths, chat identifiers and live queue observations stay in the private coordinator record. No product dispatch, new provider cost or deployment is authorized by this handover.

To continue, read issue #201, this handover and the live PR. Reconcile the actual head/base, review and checks, complete only this maintenance delivery, and preserve the owner's latest controls. The next product coordinator starts only under its actual owner authorization.
