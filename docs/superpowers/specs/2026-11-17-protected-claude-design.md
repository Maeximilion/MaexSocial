# Protected Claude review route

Maintenance [#127](https://github.com/Maeximilion/MaexSocial/issues/127). The authorized coordinator accepted this design on 2026-11-17 before implementation.

## Intent and approach

Add one explicitly dispatched workflow and one Python helper to review real PRs that change the existing reviewer. Keep `.github/workflows/claude-review.yml`, `scripts/claude_input.py` and `scripts/claude_messages.py` byte-identical in this bootstrap. The ordinary reviewer must review this bootstrap before merge. The new route becomes usable only from the reviewed default branch.

Use the existing input builder and Messages client unchanged. Editing the ordinary guard would prevent independent bootstrap review. Extracting executable publisher source from YAML is unnecessarily fragile; instead reuse its small REST payload shape in the new helper. No provider abstraction or new dependency.

## Contract

- Require explicit coordinator-authorized dispatch, open same-repository PR, exact expected head/base/target and trusted default-branch revision. Reject reruns, untrusted dispatch/checkout/workflow revisions and actors without write/maintain/admin permission.
- Execute only the trusted default-branch checkout with isolated Python. PR content is data. Deny changes/renames to either new executable path. Require a change to an original protected path and a complete bounded diff.
- Record merge base and GitHub test merge candidate, validating its parents. Recheck PR identity, review metadata and default revision before API execution and each publication write.
- Keep the existing key source, recipient, GitHub permission scope, Opus 5.5/high/standard, 32,768 output tokens, all input caps, 960-second transport, 20-minute job, one request and no retries.
- Separate API and GitHub credentials. Only fixed local failure categories enter logs. The unchanged API client alone establishes provider completion. Reusing `result_from` on the result file revalidates its schema; it is not provider evidence.
- Publish findings with `commit_id=head`, exact path/line/side, plus an overview identifying the run, head/base/target, merge base, candidate and trusted revision. Overflow, failed inline placement, stale state or failed API execution never mean complete coverage. Recheck after inline publication before the overview; stale inline reviews remain explicitly bound to their old head.

## Limits and proof

GitHub has no atomic compare-and-publish transaction. A final GET/POST race remains; merge-time coordinator checks are still required. Reject comparisons at 300 paths, incomplete/binary/clipped input, conflicts and unknown mergeability. A PR changing both routes needs separate coherent changes, not removal of guards. Offline tests mock GitHub and Anthropic. No paid probe or synthetic PR; the first future genuine protected PR supplies live evidence.
