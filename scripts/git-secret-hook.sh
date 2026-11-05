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
case "$(basename -- "$0")" in
    pre-commit) set -- --staged ;;
    # shortcut: scan every local ref; narrow to outgoing refs if repository size makes this slow.
    pre-push) set -- '--log-opts=--all --full-history' ;;
    *) echo "Secret scan blocked: unexpected hook name." >&2; exit 1 ;;
esac
exec "$scanner" git "$@" --config "$hook_dir/gitleaks.toml" \
    --gitleaks-ignore-path "$hook_dir/.gitleaksignore" \
    --ignore-gitleaks-allow --redact=100 --no-banner --no-color
