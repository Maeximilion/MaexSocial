#!/usr/bin/env bash
# Install this file under the four shared Git hook names documented in docs/19_LOCAL_SECURITY.md.
set -euo pipefail
# Resolve executables in the invoking shell. Windows CreateProcess otherwise
# searches the worktree before PATH when Python launches an unqualified program.
trusted_path() {
    local path
    path=$(type -P "$1") || return 1
    [[ $path == /* && $path != "$(pwd -P)/"* ]] || return 1
    printf '%s\n' "$path"
}
case "$OSTYPE" in
    msys*|cygwin*) git_name=git.exe ;;
    *) git_name=git ;;
esac
git_binary=$(trusted_path "$git_name") || {
    echo "Secret scan requires Git on a trusted absolute PATH." >&2; exit 1;
}
git() { "$git_binary" "$@"; }
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
scan_text() {
    # Match the object checker's neutral first read for non-object inputs.
    { printf '!\n%*s\n' 99997 ''; cat; } | scan stdin
}
scan_objects() {
    local name python
    for name in python3 python; do
        python=$(trusted_path "$name") || continue
        if "$python" -I -B -c 'import sys; sys.exit(sys.version_info < (3, 8))' </dev/null >/dev/null 2>&1; then
            "$python" -I -B "$hook_dir/scan_objects.py" "$scanner" "$git_binary" "$@"
            return $?
        fi
    done
    echo "Secret scan requires a working Python 3.8+ interpreter." >&2; return 1
}
case "$(basename -- "$0")" in
    pre-commit|pre-applypatch|pre-merge-commit)
        scan git --staged
        tree=$(git write-tree)
        scan_objects "$tree" ;;
    pre-push)
        shallow=$(git rev-parse --is-shallow-repository)
        [ "$shallow" = false ] || { echo "Secret scan requires full history." >&2; exit 1; }
        objects=(--all)
        while read -r local_ref oid remote_ref old_oid; do
            case "$oid" in
                ''|*[!0-9a-f]*) echo "Invalid pre-push object ID." >&2; exit 1 ;;
                *[1-9a-f]*)
                    # Ref components are published too. Do not echo their contents.
                    printf '%s\n' "${remote_ref//\//$'\n'}" | scan_text
                    commit=$(git rev-parse --verify "$oid^{commit}") || {
                        echo "Cannot scan a non-commit push target." >&2; exit 1;
                    }
                    objects+=("$commit")
                    # Annotated tags (including nested tags) carry their own message.
                    while [ "$oid" != "$commit" ]; do
                        git cat-file tag "$oid" | scan_text
                        oid=$(git cat-file tag "$oid" | sed -n '1s/^object //p')
                    done ;;
                *) ;; # Ref deletion.
            esac
        done
        # Raw objects include mergetag headers and bypass presentation encodings.
        scan_objects "${objects[@]}"
        # Imported commit messages may declare a non-UTF-8 encoding in the header.
        git log --format=%an%n%ae%n%cn%n%ce%n%B --encoding=UTF-8 --no-color --no-patch --no-show-signature \
            "${objects[@]}" -- | scan_text
        revisions="--root --full-history --diff-merges=first-parent --pretty=medium --encoding=UTF-8 --no-color --text --no-ext-diff --no-textconv"
        for commit in "${objects[@]}"; do revisions="$revisions $commit"; done
        scan git "--log-opts=$revisions" ;;
    *) echo "Secret scan blocked: unexpected hook name." >&2; exit 1 ;;
esac
