# Local secret prevention and Codex hooks

Task: [issue #44](https://github.com/Maeximilion/MaexSocial/issues/44). These are repository maintenance controls, not implemented application security.

## Git protection

The shared `.gitignore` excludes common local credentials, private keys, agent worktrees/settings and browser captures. Store raw authenticated research under ignored `work/`. Ignore rules neither remove tracked files nor clean history. Never force-add confidential files.

The [hook source](../scripts/git-secret-hook.sh) is installed twice, as `pre-commit` and `pre-push`, in the clone's common Git hooks directory. That location covers its linked worktrees independently of their branch contents. It does not activate automatically in a new clone.

- Commit: scan staged additions and the complete tree produced from the actual index. The tree includes file names and blob contents, including unchanged indexed files.
- Push: scan all local refs plus the commit histories sent by Git, including root and first-parent merge diffs, raw reachable objects, decoded commit identities and messages, outgoing annotated tags and secrets deleted by later commits. Shallow clones and outgoing objects that do not resolve to a commit are rejected. An unrelated local branch can therefore block a push; narrow the scan only if repository growth justifies a separately tested change.
- Scanner missing or scan failure: block the Git operation.
- Findings: redact secret values. Do not paste raw captures into issue or PR bodies.

Use the installed [configuration](../scripts/secret-hooks/gitleaks.toml), which extends Gitleaks defaults, and [ignore file](../scripts/secret-hooks/.gitleaksignore). Six exact fingerprints cover the same verified historical documentation sentence, including four appearances in merge patches. The supplemental raw-object scan omits exactly two immutable, separately checked documentation blob IDs (`08851459ccc813a5b5993aff0601e99543b04c51`, `f96e246f16dd3107ce7a56465d90e00081c3d486`). Each contains that prose line; the remaining contents were checked with Gitleaks, and both still receive the patch scan. Editing either blob gives it a different ID and restores the full raw scan. A scan-root .gitleaksignore blocks scanning because Gitleaks loads it alongside the installed file. Inline `gitleaks:allow` comments are ignored. Repository-local or environment-provided scanner configurations cannot replace the explicitly supplied installed configuration.

## Install in another Windows clone

Use Gitleaks 8.30.1 from its [official release](https://github.com/gitleaks/gitleaks/releases/tag/v8.30.1); verify the downloaded archive against that release's checksums before extracting. Keep the binary outside tracked source. No downloader runs from the hook.

Inspect `git config --show-origin --get core.hooksPath`, `git config --get maexsocial.gitleaksPath`, and existing hooks first. If a custom hook path or active hooks already exist, preserve and integrate them deliberately. Back up the common Git config, hooks and `info/exclude` before installation. For a clone without custom or active hooks, run from the reviewed checkout:

```powershell
$ErrorActionPreference = 'Stop'
foreach ($key in @('core.hooksPath', 'maexsocial.gitleaksPath')) {
    git config --get $key | Out-Null
    if ($LASTEXITCODE -ne 1) { throw "Inspect existing config or lookup error: $key" }
}
$gitCommon = git rev-parse --path-format=absolute --git-common-dir
if ($LASTEXITCODE -ne 0) { throw 'Cannot locate common Git directory' }
$hookDirectory = Join-Path $gitCommon 'hooks'
# Replace this with the absolute path to your verified executable.
$gitleaksExecutable = 'C:/Tools/gitleaks/gitleaks.exe'
if (!(Test-Path -LiteralPath $gitleaksExecutable)) { throw 'Gitleaks is missing' }
foreach ($name in @('pre-commit', 'pre-push', 'gitleaks.toml', '.gitleaksignore')) {
    if (Test-Path -LiteralPath (Join-Path $hookDirectory $name)) {
        throw "Preserve and review existing file: $name"
    }
}
# Record a rollback manifest before copying anything, including for an interrupted install.
$backup = New-Item -ItemType Directory (Join-Path $gitCommon ("hook-backup-" + [guid]::NewGuid()))
Copy-Item -LiteralPath (Join-Path $gitCommon 'config') -Destination $backup.FullName
if (Test-Path (Join-Path $gitCommon 'info/exclude')) {
    Copy-Item -LiteralPath (Join-Path $gitCommon 'info/exclude') -Destination $backup.FullName
}
if (Test-Path $hookDirectory) { Copy-Item $hookDirectory $backup.FullName -Recurse }
$files = foreach ($name in @('pre-commit', 'pre-push', 'gitleaks.toml', '.gitleaksignore')) {
    $source = if ($name -like 'pre-*') { 'scripts/git-secret-hook.sh' } else { "scripts/secret-hooks/$name" }
    @{ path = (Join-Path $hookDirectory $name); sha256 = (Get-FileHash -LiteralPath $source).Hash }
}
@{ files = $files; previousLocalScanner = $null; scanner = $gitleaksExecutable } |
    ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $backup.FullName 'installation.json')
New-Item -ItemType Directory -Force $hookDirectory | Out-Null
Copy-Item scripts/git-secret-hook.sh (Join-Path $hookDirectory 'pre-commit')
Copy-Item scripts/git-secret-hook.sh (Join-Path $hookDirectory 'pre-push')
Copy-Item scripts/secret-hooks/gitleaks.toml $hookDirectory
Copy-Item scripts/secret-hooks/.gitleaksignore $hookDirectory
git config --local maexsocial.gitleaksPath $gitleaksExecutable
if ($LASTEXITCODE -ne 0) { throw "Failed: git verification or setup" }
$env:MAEXSOCIAL_TEST_GITLEAKS = $gitleaksExecutable
python -m unittest discover -s tests -p test_secret_hooks.py -v
if ($LASTEXITCODE -ne 0) { throw "Failed: python verification or setup" }
git hook run pre-commit
if ($LASTEXITCODE -ne 0) { throw "Failed: git verification or setup" }
git hook run pre-push
if ($LASTEXITCODE -ne 0) { throw "Failed: git verification or setup" }
```

Use Git with `--attr-source` support and Bash (included in Git for Windows). The hook selects an empty attribute source to prevent repository diff attributes from hiding text. On Unix, mark both installed hook files executable and set the local scanner path to the verified platform executable. The behavioral suite uses temporary repositories and a local bare remote; no test credential is sent to GitHub. Tests are explicitly skipped when Gitleaks is unavailable; install it and set the test variable for security verification. Foundation CI does not currently install Gitleaks.

Run triage from the repository root. For a blocked staged scan, the following PowerShell example lists only file, line, rule and commit. Error diagnostics remain in memory and are never printed. An empty report covers only the selected scan. Push checks also cover commit and outgoing tag messages.

```powershell
$gitleaksExecutable = git config --path --get maexsocial.gitleaksPath
if ($LASTEXITCODE -ne 0) { throw 'Scanner path unavailable' }
$gitCommon = git rev-parse --path-format=absolute --git-common-dir
if ($LASTEXITCODE -ne 0) { throw 'Common Git directory unavailable' }
$hookDirectory = Join-Path $gitCommon 'hooks'
if (Test-Path -LiteralPath .gitleaksignore) { throw 'Remove the scan-root ignore override' }
$priorAttrs = $env:GIT_ATTR_SOURCE
$priorErrorAction = $ErrorActionPreference
$priorGitParams = $env:GIT_CONFIG_PARAMETERS
$priorReplace = $env:GIT_NO_REPLACE_OBJECTS
try {
    $ErrorActionPreference = 'Continue'
    $env:GIT_NO_REPLACE_OBJECTS = '1'
    $env:GIT_CONFIG_PARAMETERS = ("$priorGitParams 'color.diff=never'").Trim()
    $nullDevice = if ($env:OS -eq 'Windows_NT') { 'NUL' } else { '/dev/null' }
    $env:GIT_ATTR_SOURCE = git hash-object -t tree -- $nullDevice
    if ($LASTEXITCODE -ne 0) { throw 'Cannot resolve empty tree' }
    $records = @(& $gitleaksExecutable git --staged --config "$hookDirectory/gitleaks.toml" --gitleaks-ignore-path "$hookDirectory/.gitleaksignore" --ignore-gitleaks-allow --redact=100 --log-level error --no-banner --report-format json --report-path - 2>&1)
    $code = $LASTEXITCODE
    if ($code -notin @(0,1) -or @($records | Where-Object { $_ -is [Management.Automation.ErrorRecord] }).Count) { throw 'Scanner error' }
    $hits = ($records -join [Environment]::NewLine) | ConvertFrom-Json -ErrorAction Stop
    if ($code -eq 1 -and !$hits) { throw 'Scan failed without findings' }
    $hits | Select-Object File, StartLine, RuleID, Commit
} finally {
    $env:GIT_ATTR_SOURCE = $priorAttrs
    $env:GIT_CONFIG_PARAMETERS = $priorGitParams
    $env:GIT_NO_REPLACE_OBJECTS = $priorReplace
    $ErrorActionPreference = $priorErrorAction
}
```

For historical patch triage, use the same block with `--staged` replaced by `'--log-opts=--all --root --full-history --diff-merges=first-parent --pretty=medium --encoding=UTF-8 --no-color --text --no-ext-diff --no-textconv'`. Append any unreferenced outgoing commit IDs inside that option. To locate a raw-object finding, list staged IDs with `git ls-files --stage` or enumerate reachable IDs with `git --no-replace-objects rev-list --objects --no-object-names --all <outgoing-commit>`. Scanning raw tree objects also covers names. A clean patch report alone does not clear a raw-object rejection. Disable replacements when enumerating or reading candidate IDs (`GIT_NO_REPLACE_OBJECTS=1`). For a metadata rejection, enumerate candidate IDs with `git --no-replace-objects rev-list --all <outgoing-commit>` and include outgoing annotated tag IDs. In Git Bash, test a candidate without displaying its contents, using the installed configuration and ignore list. Exit zero with no error diagnostics means that candidate passed. A nonzero exit or error diagnostics requires investigation.

```bash
set -o pipefail
export GIT_NO_REPLACE_OBJECTS=1
scanner=$(git config --path --get maexsocial.gitleaksPath)
hooks=$(git rev-parse --path-format=absolute --git-common-dir)/hooks
# Set oid to the candidate ID first. Keep raw bytes in the pipe.
git cat-file "$(git cat-file -t "$oid")" "$oid" | "$scanner" stdin --config "$hooks/gitleaks.toml" --gitleaks-ignore-path "$hooks/.gitleaksignore" --redact=100 --ignore-gitleaks-allow --no-banner --log-level error
# For a commit, also check its decoded message.
git log -1 --format=%an%n%ae%n%cn%n%ce%n%B --encoding=UTF-8 --no-color --no-patch --no-show-signature "$oid" -- | "$scanner" stdin --config "$hooks/gitleaks.toml" --gitleaks-ignore-path "$hooks/.gitleaksignore" --redact=100 --ignore-gitleaks-allow --no-banner --log-level error
```

Update installed copies after reviewed hook changes; changing source files alone does not update other clones. Before rollback, back up the current state again. Remove only installed files whose hashes still match the installation manifest; preserve later modifications. Unset `maexsocial.gitleaksPath` only if it still equals the installed value (or restore its recorded previous value). Do not overwrite the entire Git config with an old backup.

## Verified local setup, 2026-11-05

Gitleaks 8.30.1 is checksum-verified. The canonical MaexSocial clone uses its common Git hooks directory; linked worktrees share that directory. The local rollback register records the installation, backup location and hashes. The new ignore block is also applied to local `info/exclude` so pre-merge worktrees receive the same protection immediately.

The preceding bounded audit found no confirmed secret leak in the inspected history, public issue/PR material and sampled workflow log. GitHub secret scanning and push protection were enabled. This does not prove absence of all sensitive data. Local hooks can be bypassed; platform protection and review remain necessary. If a real credential was ever published, revoke/rotate it before considering history cleanup.

## Native Codex hooks and terminal

Codex CLI 0.166.0-alpha.6 is installed and logged in through ChatGPT on the inspected machine. This app-bundled executable reports an incomplete local package when started with the daemon; `codex --no-daemon` successfully starts its terminal interface. Work in a task worktree; for a fresh isolated session use `codex --no-daemon --worktree -C <canonical-checkout>`. For a review select `gpt-6-astra` and reasoning `high`; these are separate settings.

The CLI app-server `hooks/list` inspection reports the user's model-router hooks for SessionStart, UserPromptSubmit and PreToolUse as enabled and trusted. The Ponytail session and prompt hooks are also enabled/trusted. Legacy Claude-specific title/sync hooks remain disabled. These existing definitions and model settings were unchanged. The router supplies guidance and a pause guard; it does not switch the running model itself. Six synthetic router checks passed using isolated state, not a real session's pending work.

After concurrent PR #46 introduced the project Stop check, its canonical-checkout registration was inspected and trusted individually through the normal CLI `/hooks` interface. The CLI then displayed Stop as active and trusted. The config backup and rollback record contain the exact new trust entry; no trust-all or trust-bypass option was used. New worktree paths or changed definitions can still require their own trust review. Active/trusted registration and direct script tests do not alone prove a callback in every desktop/CLI session.

Inspect `/hooks` in the CLI or Settings > Hooks in the desktop app. Changed definitions can require renewed trust; do not bypass the trust check. The desktop and terminal are separate surfaces, and simultaneous agents must not edit the same task worktree. [Official hooks documentation](https://learn.chatgpt.com/docs/hooks), [CLI documentation](https://learn.chatgpt.com/docs/cli), consulted 2026-11-05.

The owner's later workflow-hook preference makes the shared repository Stop check advisory: failures, startup errors and timeouts produce a warning without an automatic corrective turn. Its updated script and both registered command paths were tested with controlled failures. The previously observed live CLI callback used the older script; live warning display for this revision has not been observed. The model-routing decision pause and installed Git secret guards are unchanged.

## Advisory security and dependency check

Owner decision revised on 2026-11-05: this check only reminds us of work that needs attention. It replaces the earlier mandatory pause and automatic remediation-chat policy. Run it only when the user explicitly invokes `/start` or `/task`, including their named source-command skill equivalents. Do not run it implicitly on session start, task changes, resumption, notifications or a timer. Query the current GitHub state, paginate all results and record the check time. Never interpret a permission/network error as an empty result; report the uncertainty and continue the requested task.

Check open PRs for an authenticated Dependabot bot identity and `priority:p1` (also `priority:p0`). Human P1 research PRs and routine Dependabot P2 updates do not trigger this particular rule. Separately check open Dependabot vulnerability, secret-scanning and code-scanning alerts, including non-security quality findings; failed current security/quality checks on main; and unresolved concrete security/quality review-bot findings on open PRs. Use safe metadata and links only, never secret values. If another quality provider is added, include it rather than assuming CodeQL covers it.

For each new or materially changed finding, briefly report its safe identifier/link, type, severity, check time and the need to address it. Continue the user's requested work. Neither a finding nor an unavailable check may abort, pause or block current or new tasks; no clearance or prior remediation is required. Do not automatically create remediation chats or agents, send stop instructions to other chats, or wait for remediation chats. Start remediation only on a separate user request. Avoid repeated unchanged notices. Do not merge automatically, weaken checks, downgrade priorities or dismiss alerts. Actual Git secret guards, required CI and product acceptance gates remain unchanged; this advisory policy concerns task scheduling only.

The previous local Codex automation `maexsocial-security-und-p1-vorrang` is paused under the owner's revised request. Its configuration is retained for rollback, but there is no periodic security/dependency polling. The paused status was read back after updating it. `/start` and `/task` remain manual advisory workflows, not automatic session hooks. This change does not disable GitHub CI, secret protection or checks required to verify the current implementation.
