# Claude input preflight

[Maintenance #115](https://github.com/Maeximilion/MaexSocial/issues/115) adds a read-only check using the same [input builder](../../scripts/claude_input.py) as the [advisory workflow](../../.github/workflows/claude-review.yml). It calls GitHub through the authenticated `gh` CLI, never Anthropic. Python's standard library is sufficient. No hook is installed.

## Run before updating a PR

Use an updated, trusted checkout. Read the exact revisions, then substitute the full lowercase 40-character SHAs in the second command:

```text
gh pr view 123 --repo Maeximilion/MaexSocial --json baseRefOid,headRefOid
python -I scripts/claude_input.py --repo Maeximilion/MaexSocial --pr 123 --base BASE_SHA --head HEAD_SHA
```

The comparison is GitHub's immutable `base...head` diff, matching the hosted review. Both commits must already be available to GitHub. Title, description, author and branch metadata are read from the PR at invocation time; changing them requires another check even if the commits stay the same. This command checks prepared input, not reviewer eligibility or code correctness. The workflow still performs its default-branch and protected-path checks separately.

Output is JSON with `status` (`complete` or `incomplete`), both SHAs, `diff_escaped_bytes`, `diff_limit` and `gaps`. Exit 0 means no known input gaps; exit 1 means incomplete/unavailable input; exit 2 means invalid arguments. It prints no diff, PR body or credential. `diff_escaped_bytes` measures the decoded text after unavailable binary sections are removed and invalid bytes replaced; those losses remain explicit gaps. It is null when the diff could not be fetched. Completeness does not prove GitHub supplied data it did not disclose as missing.

The existing limits remain: diff 50,000 escaped bytes, PR body/request 6,000 each, title 1,000, author/ref/repository names 300 each, and combined prompt 90,000. The builder uses its existing conservative ASCII JSON/HTML-safe escaping calculation, so Unicode, quotes, backslashes and HTML delimiters can cost more than one byte. Exactly 50,000 fits; 50,001 does not. Do not estimate using file size or a separate formula.

## Incomplete input

Automatic reviews with any known gap do not create an API input file or run the paid step. The publisher reports **Incomplete / not reviewed**, the exact head, gap reasons and the pinned preflight command. It never turns a skipped request or stale result into a completed zero-findings review. The advisory job retains its visible incomplete/failure status; required foundation/metadata CI is unchanged.

For clipping, remove redundant prose or arrange coherent, fully reviewable changes without dropping required review content; check again before pushing. For unavailable diffs, resolve GitHub availability first. Binary or undecodable content needs separately recorded review coverage and coordinator disposition. Do not raise limits, silently exclude files or retry a paid review to work around a gap. Explicit trusted mentions retain the existing bounded reply behavior and incomplete disclosure; the automatic review never triggers such a mention.

The workflow, input builder and API client protect themselves against review of their own changes, including renames. A protected self-skip is **not** Claude analysis. This delivery requires independent fresh GPT-6 Astra/high review and exact CI. The coordinator owns any disposition and post-merge verification on the next ordinary eligible PR; do not create a paid probe. Opus/high, standard speed, request/workspace budgets, tool-free operation, secret isolation and exact-head publication stay unchanged.

## Offline regression checks

```text
python -m unittest discover -s tests -p test_claude_review.py
python -m unittest discover -s tests -p test_claude_messages.py
```

Synthetic pinned base/head fixtures cover 49,999/50,000/50,001 escaped bytes with Unicode and escaping, binary/text mixtures, invalid/NUL bytes, unavailable or empty diffs, clipped metadata, protected paths/renames, local CLI parity and skipped-result publication. GitHub and Anthropic are mocked; no paid call is made.
