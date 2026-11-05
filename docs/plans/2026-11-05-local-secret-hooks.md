# Local secret prevention plan

Task: [issue #44](https://github.com/Maeximilion/MaexSocial/issues/44). Foundation maintenance; no product-gate change.

## Design and scope

Use Gitleaks with its default rules. Install the same small shell script as `pre-commit` and `pre-push` in the clone's common Git directory so all existing worktrees are covered before merge. Keep the executable path in local Git configuration. Commit checks scan the staged index; push checks scan all local history. Missing scanner or failed scanning blocks the operation. Redact findings and ignore only two verified historical prose fingerprints. Shared installed configuration prevents a worktree's scanner configuration from silently weakening the rules.

Extend shared ignore patterns for local credentials and browser captures; stage no raw research. Back up existing local hooks/configuration, preserve other sessions, and document rollback. Check native Codex hooks separately: activation, trust and synthetic model-router behavior. Keep incompatible legacy integrations disabled. Do not alter healthy global settings or introduce automatic model switching.

## Sequence and evidence

1. Inspect existing hooks, CLI, security state and repository rules; establish baseline checks.
2. Write temporary-repository tests; demonstrate missing protection before implementation.
3. Add the hook, scanner configuration, ignore patterns and setup documentation.
4. Verify index-only behavior, redacted rejection, missing-scanner failure and historical-secret push rejection with real Git/Gitleaks.
5. Back up and install locally; verify common-hook resolution in canonical and task/Claude worktrees.
6. Run repository checks, perform Astra high review, commit/push and open a PR; verify hosted checks and Project state.

## Boundaries

Local hooks can be bypassed and do not install themselves in other clones. Ignore rules do not untrack files or remove history. Pattern scanning is not a guarantee that every sensitive document or custom credential will be detected. Preserve GitHub secret scanning and push protection.
