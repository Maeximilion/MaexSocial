# Handover 2026-11-21 — Maintenance #192

## Status

Publication checkpoint (UTC) — 2026-11-21T18:57:27Z. The three coordinator source commits were cherry-picked in order onto the verified main at `1daddca907772b4cce720b39e353624cc6059450`. After [#195](https://github.com/Maeximilion/MaexSocial/pull/195) merged, `git range-diff` verified that the patches replayed unchanged onto `72ebb5552829bca3968c0b19a290f3494bc737be`. A focused follow-up aligned START and the dispatch skill with the High default and clarified how to bound downloads and release scanned bytes.

- Implementer — Codex in a separate MaexSocial worktree. The coordinator records High and no manual command prompts on the replacement #187 and #190 turns, High on #191, and High selected in the native coordinator chat.
- Project configuration — Installed Codex `0.171.0-alpha.13` app-server `config/read` resolved `auto_review` and `high` from the candidate project layer. Clean canonical main resolved no explicit reviewer and inherited `ultra`. The approval policy, sandbox and permission options matched. The observed policy was `never`, so this comparison verifies config resolution. Confirm actual reviewer selection on a later real Desktop turn with an eligible approval context.
- Verification — `python scripts/check_repo.py` and `git diff --check` passed. `node --test tests/*.test.cjs` passed 20/20. The default `python -m unittest discover -s tests` run failed in the nested Git hook fixture with `GIT_CONFIG_VALUE_0` missing. The 11 hook tests passed in isolation. A discovery run of all 129 cases with `test_repository_hook` first passed with 32 platform/fixture skips. Earlier tests mock and restore the Windows process environment, which can drop empty Git config values.
- Reviewer — Existing Claude Messages API workflow, configured for `claude-opus-5-5`, High reasoning, Standard speed and `standard_only`. API execution, published result and remote CI are pending publication.

## Artifacts

- Repository and task — [Maeximilion/MaexSocial · Maintenance #192](https://github.com/Maeximilion/MaexSocial/issues/192).
- Branch — `dev-codex/192-project-workflow-defaults`.
- Work head before the handover commit — `ece88a1993e4558b1bc31c45d615be63eba12ec1`.
- PR — Pending verified publication window and base. See the [assigned source commits](https://github.com/Maeximilion/MaexSocial/issues/192#issuecomment-7067493109).
- Scope — [project config](../../../.codex/config.toml), [coordinator agreement](../../../.codex/orchestration/README.md), [START](../../../.codex/orchestration/START.md) and [coordination skill](../../../.agents/skills/coordinate-project-chats/SKILL.md).

## Decisions

Project settings select the reviewer for eligible approval requests and set High reasoning. The coordination agreement requires Standard speed unless the owner requests Fast for the task. Keep the checkout's existing sandbox, network and approval policy. The Desktop can select its own permission mode for a chat. See [Codex permissions](https://learn.chatgpt.com/docs/permission-modes).

Carry the owner's routine work authorization into assignments. Ask before large external downloads, using a provisional combined 100 MiB cap, and release only bytes that pass a complete isolated scan. Use the verified GitHub commits and normal handover for archival. Preserve genuinely needed unpublished originals through handoff and use selective copies for a specific rollback need.

## Gate

Repository maintenance under #192. Product acceptance and restore evidence remain governed by the [project gates](../../00_PCF.md#gates). The coordinator owns publication sequencing and merge decisions.

## Open

Recheck the confirmed publication window and verified main tip after #191. Reconcile open PRs, then open a normal PR with `Closes #192` and attach it to the owning chat. Verify CI and the actual Claude API run and result against the live head and base. Record the receipts on the PR.

- Console — PowerShell in any local MaexSocial checkout.
- Folder/worktree — Repository root of the registered worktree for `dev-codex/192-project-workflow-defaults`. Resolve its local path from Git.
- Full start command — Run the following in order.

  ```powershell
  $taskWorktree = (git worktree list --porcelain | Select-String -SimpleMatch 'branch refs/heads/dev-codex/192-project-workflow-defaults' -Context 2,0).Context.PreContext[0].Substring(9)
  Set-Location -LiteralPath $taskWorktree
  git fetch origin --prune
  git status --short --branch
  ```

- First message — Resume MaexSocial #192 from this handover. Check live coordinator authority and the actual PR queue, then verify the permitted publication base and window. Keep the source layer and its verification separate from coordinator status history.

## Lessons

Graphify's `4f36d6fad83c236640b8fdd62d7eb1d772900423` index returned the protected review publisher and no file matches for the four edited source paths. Directly read the current instructions, config and diffs. A config read proves recognition of keys. Native turn settings and actual automatic decisions require their own evidence. No new download or host approval probe was needed. Code Autopilot and Caveman remain enabled. Advisory repository scans run only when explicitly requested with `/start` or `/task`.
