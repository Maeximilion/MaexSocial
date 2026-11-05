#!/usr/bin/env bash
# Install this file as both pre-commit and pre-push in the shared Git hooks directory.
set -euo pipefail
hook_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
scanner=$(git config --path --get maexsocial.gitleaksPath) || {
    echo "Secret scan blocked: configure maexsocial.gitleaksPath (docs/19_LOCAL_SECURITY.md)." >&2
    exit 1
}
if [ ! -x "$scanner" ]; then
    echo "Secret scan blocked: configured Gitleaks executable is unavailable." >&2
    exit 1
fi
# Gitleaks also loads a scan-root ignore file even when an installed one is specified.
if [ -e .gitleaksignore ] || [ -L .gitleaksignore ]; then
    echo "Secret scan blocked: worktree .gitleaksignore is not allowed." >&2
    exit 1
fi
export GIT_NO_REPLACE_OBJECTS=1
# Gitleaks parses machine-readable patches; ANSI escapes hide additions.
# Append after any parent git -c options, whose precedence exceeds GIT_CONFIG_COUNT.
export GIT_CONFIG_PARAMETERS="${GIT_CONFIG_PARAMETERS:+$GIT_CONFIG_PARAMETERS }'color.diff=never'"
# Use a neutral attribute source so repository-controlled diff drivers cannot hide text.
GIT_ATTR_SOURCE=$(git hash-object -t tree --stdin </dev/null)
export GIT_ATTR_SOURCE
git --attr-source="$GIT_ATTR_SOURCE" rev-parse --git-dir >/dev/null || {
    echo "Secret scan requires Git with --attr-source support." >&2; exit 1;
}
# In 8.30.1 a failed Git subprocess can log an error but leave exit status zero.
# At error level successful scans are silent. Never echo captured diagnostics.
scan() {
    local diagnostics
    if ! diagnostics=$("$scanner" "$@" --config "$hook_dir/gitleaks.toml" \
        --gitleaks-ignore-path "$hook_dir/.gitleaksignore" --log-level error \
        --ignore-gitleaks-allow --redact=100 --no-banner --no-color 2>&1) || [ -n "$diagnostics" ]; then
        echo "Secret scan blocked: leaks found or scan failed." >&2
        return 1
    fi
}
case "$(basename -- "$0")" in
    pre-commit)
        scan git --staged
        # Git omits binary patches from --staged. Scan those exact indexed blobs too.
        git diff --cached --numstat -z --no-renames --no-ext-diff --no-textconv --no-color \
            --diff-filter=AMT -- | while IFS= read -r -d '' entry; do
            if [[ $entry == $'-\t-\t'* ]]; then
                path=${entry#$'-\t-\t'}
                blob=$(git rev-parse --verify ":0:$path")
                git cat-file blob "$blob" | scan stdin || {
                    echo "Staged blob scan failed: $blob" >&2; exit 1;
                }
            fi
        done ;;
    pre-push)
        shallow=$(git rev-parse --is-shallow-repository)
        [ "$shallow" = false ] || { echo "Secret scan requires full history." >&2; exit 1; }
        objects=(--all)
        while read -r local_ref oid remote_ref old_oid; do
            case "$oid" in
                ''|*[!0-9a-f]*) echo "Invalid pre-push object ID." >&2; exit 1 ;;
                *[1-9a-f]*)
                    commit=$(git rev-parse --verify "$oid^{commit}") || {
                        echo "Cannot scan a non-commit push target." >&2; exit 1;
                    }
                    objects+=("$commit")
                    # Annotated tags (including nested tags) carry their own message.
                    while [ "$oid" != "$commit" ]; do
                        git cat-file tag "$oid" | scan stdin
                        oid=$(git cat-file tag "$oid" | sed -n '1s/^object //p')
                    done ;;
                *) ;; # Ref deletion.
            esac
        done
        # Raw objects include mergetag headers and bypass presentation encodings.
        git rev-list "${objects[@]}" -- | git cat-file --batch | scan stdin || {
            echo "Commit metadata scan failed (see triage in docs/19_LOCAL_SECURITY.md)." >&2; exit 1;
        }
        # Imported commit messages may declare a non-UTF-8 encoding in the header.
        git log --format=%B --encoding=UTF-8 --no-color --no-patch --no-show-signature \
            "${objects[@]}" -- | scan stdin
        revisions="--full-history --diff-merges=first-parent --pretty=medium --encoding=UTF-8 --no-color --text --no-ext-diff --no-textconv"
        for commit in "${objects[@]}"; do revisions="$revisions $commit"; done
        scan git "--log-opts=$revisions" ;;
    *) echo "Secret scan blocked: unexpected hook name." >&2; exit 1 ;;
esac
