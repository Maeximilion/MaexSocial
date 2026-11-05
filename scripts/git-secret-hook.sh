#!/bin/sh
# Install this file as both pre-commit and pre-push in the shared Git hooks directory.
set -eu
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
case "$(basename -- "$0")" in
    pre-commit) set -- --staged ;;
    pre-push)
        shallow=$(git rev-parse --is-shallow-repository)
        [ "$shallow" = false ] || { echo "Secret scan requires full history." >&2; exit 1; }
        revisions="--all --full-history --diff-merges=first-parent"
        while read -r local_ref oid remote_ref old_oid; do
            case "$oid" in
                ''|*[!0-9a-f]*) echo "Invalid pre-push object ID." >&2; exit 1 ;;
                *[1-9a-f]*)
                    commit=$(git rev-parse --verify "$oid^{commit}") || {
                        echo "Cannot scan a non-commit push target." >&2; exit 1;
                    }
                    revisions="$revisions $commit" ;;
                *) ;; # Ref deletion.
            esac
        done
        set -- "--log-opts=$revisions" ;;
    *) echo "Secret scan blocked: unexpected hook name." >&2; exit 1 ;;
esac
# In 8.30.1 a failed Git subprocess can log an error but leave exit status zero.
# At error level successful scans are silent. Never echo captured diagnostics.
if ! diagnostics=$("$scanner" git "$@" --config "$hook_dir/gitleaks.toml" \
    --gitleaks-ignore-path "$hook_dir/.gitleaksignore" --log-level error \
    --ignore-gitleaks-allow --redact=100 --no-banner --no-color 2>&1) || [ -n "$diagnostics" ]; then
    echo "Secret scan blocked: leaks found or scan failed." >&2
    exit 1
fi
