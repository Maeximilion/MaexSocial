# Local secret prevention and Codex hooks

Task: [issue #44](https://github.com/Maeximilion/MaexSocial/issues/44). These are repository maintenance controls, not implemented application security.

## Git protection

The shared `.gitignore` excludes common local credentials, private keys, agent worktrees/settings and browser captures. Store raw authenticated research under ignored `work/`. Ignore rules neither remove tracked files nor clean history. Never force-add confidential files.

The [hook source](../scripts/git-secret-hook.sh) is installed twice, as `pre-commit` and `pre-push`, in the clone's common Git hooks directory. That location covers its linked worktrees independently of their branch contents. It does not activate automatically in a new clone.

- Commit: scan the staged index, including a staged secret whose working copy was subsequently cleaned.
- Push: scan all local refs and their full history, including secrets deleted by later commits. An unrelated local branch can therefore block a push; narrow the scan only if repository growth justifies a separately tested change.
- Scanner missing or scan failure: block the Git operation.
- Findings: redact secret values. Do not paste raw captures into issue or PR bodies.

Use the installed [configuration](../scripts/secret-hooks/gitleaks.toml), which extends Gitleaks defaults, and [ignore file](../scripts/secret-hooks/.gitleaksignore). Only two exact historical documentation fingerprints are excluded. Inline `gitleaks:allow` comments are ignored. Repository-local or environment-provided scanner configurations cannot replace the explicitly supplied installed configuration.

## Install in another Windows clone

Use Gitleaks 8.30.1 from its [official release](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1); verify the downloaded archive against that release's checksums before extracting. Keep the binary outside tracked source. No downloader runs from the hook.

Inspect `git config --show-origin --get core.hooksPath`, `git config --get maexsocial.gitleaksPath`, and existing hooks first. If a custom hook path or active hooks already exist, preserve and integrate them deliberately. Back up the common Git config, hooks and `info/exclude` before installation. For a clone without custom or active hooks, run from the reviewed checkout:

```powershell
$gitCommon = git rev-parse --path-format=absolute --git-common-dir
$hookDirectory = Join-Path $gitCommon 'hooks'
# Replace this with the absolute path to your verified executable.
$gitleaksExecutable = 'C:/Tools/gitleaks/gitleaks.exe'
if (!(Test-Path -LiteralPath $gitleaksExecutable)) { throw 'Gitleaks is missing' }
foreach ($name in @('pre-commit', 'pre-push', 'gitleaks.toml', '.gitleaksignore')) {
    if (Test-Path -LiteralPath (Join-Path $hookDirectory $name)) {
        throw "Preserve and review existing file: $name"
    }
}
Copy-Item scripts/git-secret-hook.sh (Join-Path $hookDirectory 'pre-commit')
Copy-Item scripts/git-secret-hook.sh (Join-Path $hookDirectory 'pre-push')
Copy-Item scripts/secret-hooks/gitleaks.toml $hookDirectory
Copy-Item scripts/secret-hooks/.gitleaksignore $hookDirectory
git config --local maexsocial.gitleaksPath $gitleaksExecutable
$env:MAEXSOCIAL_TEST_GITLEAKS = $gitleaksExecutable
python -m unittest discover -s tests -p test_secret_hooks.py -v
git hook run pre-commit
git hook run pre-push
```

Git for Windows supplies the shell used by these hooks. On Unix, mark both installed hook files executable and set the local scanner path to the verified platform executable. The behavioral suite uses temporary repositories and a local bare remote; no test credential is sent to GitHub. Tests are explicitly skipped when Gitleaks is unavailable; install it and set the test variable for security verification. Foundation CI does not currently install Gitleaks.

Update installed copies after reviewed hook changes; changing source files alone does not update other clones. Before rollback, back up the current state again. Remove only installed files whose hashes still match the installation manifest; preserve later modifications. Unset `maexsocial.gitleaksPath` only if it still equals the installed value (or restore its recorded previous value). Do not overwrite the entire Git config with an old backup.

## Verified local setup, 2026-11-05

Gitleaks 8.30.1 is checksum-verified. The canonical MaexSocial clone uses its common Git hooks directory; linked worktrees share that directory. The local rollback register records the installation, backup location and hashes. The new ignore block is also applied to local `info/exclude` so pre-merge worktrees receive the same protection immediately.

The preceding bounded audit found no confirmed secret leak in the inspected history, public issue/PR material and sampled workflow log. GitHub secret scanning and push protection were enabled. This does not prove absence of all sensitive data. Local hooks can be bypassed; platform protection and review remain necessary. If a real credential was ever published, revoke/rotate it before considering history cleanup.

## Native Codex hooks and terminal

Codex CLI 0.166.0-alpha.6 is installed and logged in through ChatGPT on the inspected machine. `codex` starts the terminal client. Work in a task worktree; for a fresh isolated session use `codex --worktree -C <canonical-checkout>`. For a review select `gpt-6-astra` and reasoning `high`; these are separate settings.

The CLI app-server `hooks/list` inspection reports the user's model-router hooks for SessionStart, UserPromptSubmit and PreToolUse as enabled and trusted. The Ponytail session and prompt hooks are also enabled/trusted. Legacy Claude-specific title/sync hooks remain disabled. No global hook or model settings were changed: the existing setup was already active. The router supplies guidance and a pause guard; it does not switch the running model itself. Synthetic router tests use isolated state, not a real session's pending work.

Inspect `/hooks` in the CLI or Settings > Hooks in the desktop app. Changed definitions can require renewed trust; do not bypass the trust check. The desktop and terminal are separate surfaces, and simultaneous agents must not edit the same task worktree. [Official hooks documentation](https://learn.chatgpt.com/docs/hooks), [CLI documentation](https://learn.chatgpt.com/docs/cli), consulted 2026-11-05.
