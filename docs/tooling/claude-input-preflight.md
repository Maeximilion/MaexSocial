# Claude input preflight

[Maintenance #115](https://github.com/Maeximilion/MaexSocial/issues/115) adds a read-only check using the same [input builder](../../scripts/claude_input.py) as the [advisory workflow](../../.github/workflows/claude-review.yml). It calls GitHub through the authenticated `gh` CLI, never Anthropic. Python's standard library is sufficient. No hook is installed.

## Run before updating a PR

Use an updated, trusted checkout. Read the exact revisions, then substitute the full lowercase 40-character SHAs in the second command:

```text
gh pr view 123 --repo Maeximilion/MaexSocial --json baseRefOid,headRefOid
python -I scripts/claude_input.py --repo Maeximilion/MaexSocial --pr 123 --base BASE_SHA --head HEAD_SHA
```

The comparison is GitHub's immutable `base...head` diff, matching the hosted review. Both commits must already be available to GitHub. Title, description, author and branch metadata are read from the PR at invocation time; changing them requires another check even if the commits stay the same. This command checks prepared input, not reviewer eligibility or code correctness. The workflow still performs its default-branch and protected-path checks separately.

Output is JSON with `status` (`complete` or `incomplete`), both SHAs, `diff_escaped_bytes`, `diff_limit`, `prompt_escaped_bytes`, `prompt_limit`, `request_bytes`, `request_limit` and `gaps`. Exit 0 means no known input gaps; exit 1 means incomplete/unavailable input; exit 2 means invalid arguments. It prints no diff, PR body or credential. `diff_escaped_bytes` measures the decoded text after unavailable binary sections are removed and invalid bytes replaced; those losses remain explicit gaps. It is null when the diff could not be fetched. Prompt/request sizes measure the prepared content, which can be clipped when gaps are reported. Completeness does not prove GitHub supplied data it did not disclose as missing.

## Complete request envelope

[Maintenance #119](https://github.com/Maeximilion/MaexSocial/issues/119#issuecomment-6682864492) approves these limits:

| Input | Limit | Measurement |
| --- | --- | --- |
| Complete diff | 120,000 | Conservative ASCII JSON/HTML-safe escaped bytes |
| System prompt plus framed data | 140,000 | Same conservative escaping, including metadata and instructions |
| Entire Messages request | 150,000 | Actual serialized ASCII JSON bytes, including model/configuration/schema |
| PR body / trusted mention | 6,000 each | Escaped bytes, unchanged |
| Title / author, ref and repository names | 1,000 / 300 each | Escaped bytes, unchanged |

Unicode, quotes, backslashes and HTML delimiters can cost more than one byte. Exactly 120,000 diff bytes fits; 120,001 is incomplete. Both the builder and API client use `request_body` in [the client](../../scripts/claude_messages.py); the client also rejects a request over 150,000 bytes before opening a connection. Isolated Python (`-I`) loads that client by its explicit trusted sibling path, without enabling `PYTHONPATH` or current-directory imports. The hosted checkout and protected-path checks remain unchanged.

The former 50,000 diff / 90,000 prompt limits came from [#58](https://github.com/Maeximilion/MaexSocial/pull/58), which passed the prompt through the old action's environment variable under Linux's per-string limit. [#105](https://github.com/Maeximilion/MaexSocial/pull/105) replaced that transport with file-built Messages JSON and a 100,000-byte client cap; [#116](https://github.com/Maeximilion/MaexSocial/pull/116) retained the earlier input limits. They were local transport/cost choices, not the model context limit. Prompts now travel through a file and an HTTP body.

Read-only reproduction on 2026-11-06: #118 at base `4e28499dc1f129d96a06faa8f410cf85a4ddbb3d` / head `2a67df7656c93db55674f842672092633b81535a` measured 90,142 escaped diff bytes, 94,713 escaped prompt bytes and 90,598 serialized request bytes with that day's metadata. The new envelope preserves the complete diff and reports no gaps. The earlier [incomplete receipt](https://github.com/Maeximilion/MaexSocial/pull/118#issuecomment-6682740988) correctly sent no API request. These measurements are not a provider review. Synthetic maximum ASCII fields measure 129,655/135,816 prompt bytes and 130,230/136,404 request bytes for review/mention respectively (repository `Maeximilion/MaexSocial`, PR 118, full SHAs); Unicode/HTML-heavy fields fit too. All caps are still checked rather than inferred from these examples.

### Cost planning, not billing enforcement

Official sources checked 2026-11-06: [Opus 5.5](https://platform.claude.com/docs/en/models/opus-5-5/overview) exposes model ID `claude-opus-5-5`, a 1M-token context and up to 128K output tokens. [Standard pricing](https://platform.claude.com/docs/en/about-claude/pricing) is USD4/20 per million input/output tokens across the full context. This client retains high effort, standard speed/tier and **8,192** output tokens including thinking; it requests no tools, cache writes or regional premium.

For conservative planning, treating all 150,000 serialized bytes as 150,000 input tokens gives `(150000 × 4 + 8192 × 20) / 1000000 = USD0.76384`. An assumed additional 10,000 input tokens for provider overhead gives USD0.80384, rounded to **USD0.85 per request**. Byte size is not a measured token count; that allowance is not a provider guarantee or an enforced dollar maximum. The single call may still fail or hit the output cap, and a timeout may incur cost. The owner's reported **USD75 monthly workspace limit** is separate, unchanged and not independently verified here. No token-count endpoint, paid diagnostic request or billing setting was used. Recheck official prices when changing the model or envelope.

## Incomplete input

Automatic reviews with any known gap do not create an API input file or run the paid step. The publisher reports **Incomplete / not reviewed**, the exact head, gap reasons and the pinned preflight command. It never turns a skipped request or stale result into a completed zero-findings review. The advisory job retains its visible incomplete/failure status; required foundation/metadata CI is unchanged.

For clipping, remove redundant prose or arrange coherent, fully reviewable changes without dropping required review content; check again before pushing. Never omit tests or lockfiles just to fit. For unavailable diffs, resolve GitHub availability first. Binary or undecodable content needs separately recorded review coverage and coordinator disposition. Further limit changes require another documented disposition; do not silently exclude files or retry a paid review to work around a gap. Explicit trusted mentions retain the existing bounded reply behavior and incomplete disclosure; prompt/request overflow prevents those calls too. The automatic review never triggers a mention.

The workflow, input builder and API client protect themselves against review of their own changes, including renames. A protected self-skip is **not** Claude analysis. This delivery requires independent fresh GPT-6 Astra/high review and exact CI. The coordinator owns disposition and post-merge verification on #118's next ordinary eligible current-head event; a same-head rerun against stale trusted code is not evidence of the fix. Do not create a paid probe. Model/effort, standard speed, output/workspace limits, tool-free operation, secret isolation and exact-head publication stay unchanged.

## Offline regression checks

```text
python -m unittest discover -s tests -p test_claude_review.py
python -m unittest discover -s tests -p test_claude_messages.py
```

Synthetic pinned base/head fixtures cover 119,999/120,000/120,001 escaped diff bytes, prompt/request boundaries, the observed 90,142-byte diff size with lockfile/test sections, maximum ASCII and Unicode/escaped metadata, review/mention serialization parity, isolated trusted imports, binary/text mixtures, invalid/NUL bytes, unavailable or empty diffs, clipped metadata, protected paths/renames, local CLI parity and skipped-result publication. GitHub and Anthropic are mocked; no paid call is made.
