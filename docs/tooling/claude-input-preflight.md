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

Official sources checked 2026-11-06: [Opus 5.5](https://platform.claude.com/docs/en/models/opus-5-5/overview) exposes model ID `claude-opus-5-5`, a 1M-token context and up to 128K output tokens. [Standard pricing](https://platform.claude.com/docs/en/about-claude/pricing) is USD4/20 per million input/output tokens across the full context. This client retains high effort, standard speed/tier and **32,768** output tokens including thinking; it requests no tools, cache writes or regional premium.

For conservative planning, treating all 150,000 serialized bytes as 150,000 input tokens and assuming another 10,000 tokens of provider overhead gives the following comparison at USD4/20 per million input/output tokens:

| Output allowance | Output-only maximum at this rate | Total planning assumption |
| --- | --- | --- |
| 8,192 (previous) | USD0.16384 | USD0.80384 |
| 16,384 (considered) | USD0.32768 | USD0.96768 |
| 32,768 (selected) | USD0.65536 | USD1.29536 |

The selected allowance adds at most USD0.49152 in output charges at these rates, with a rounded **USD1.30 per-request planning figure**. Byte size is not a measured token count; the input/overhead assumption is not a provider guarantee or an enforced dollar maximum. A timeout may incur cost. The owner's reported **USD75 monthly workspace limit** is separate, unchanged and not independently verified here. No token-count endpoint, paid diagnostic request or billing setting was used. Recheck official prices when changing the model or envelope.

### Output exhaustion and bounded transport

[Maintenance #121 disposition](https://github.com/Maeximilion/MaexSocial/issues/121#issuecomment-6683416099) selects 32,768 output tokens, the unchanged 1,048,576-byte response limit and a 960-second socket timeout. The actual client uses `http.client.HTTPSConnection`, not an SDK. The existing 20-minute workflow job remains the separate outer time limit. A socket timeout limits blocking operations, not total request duration. The response reader requests at most the byte limit plus one and rejects overflow before JSON parsing; this is independent of tokens and is not a guaranteed token-to-byte conversion.

The [official effort guidance](https://platform.claude.com/docs/en/build-with-claude/effort) says Opus 5.5 always thinks and `max_tokens` includes thinking plus response text. Four times the former allowance gives bounded headroom without lowering high effort. It does not guarantee review completion. The [official SDK timeout heuristic](https://platform.claude.com/docs/en/cli-sdks-libraries/sdks/typescript#timeouts) scales large non-streaming requests as `max(600, 3600 * max_tokens / 128000)` seconds: 921.6 seconds here, rounded to 960 rather than the former 180. This is sizing evidence, not a measured latency promise or a new SDK dependency. [Long-request guidance](https://platform.claude.com/docs/en/api/errors#long-requests) recommends streaming or batches especially beyond ten minutes and warns of idle connection drops; the SDK's ten-minute precheck is not a documented API rejection of this token setting. Provider/network timeouts remain possible. Keep one request, no retries and no streaming machinery; reassess transport only if a real eligible review supplies new failure evidence.

Observed on 2026-11-06: #118 head `33e3ee7df5b27217277147e89a6a2fb3b2ba5125`, base `234db0d4e1034ff30420a6d5b7f93171a1f57d31`, passed complete input preparation (106,345 escaped diff bytes) in [run 42206058276](https://github.com/Maeximilion/MaexSocial/actions/runs/42206058276). Its executed API step reported `output_token_limit`; the [receipt](https://github.com/Maeximilion/MaexSocial/pull/118#issuecomment-6683180629) correctly published no partial findings or clean verdict. This maps the provider's `max_tokens` stop and is distinct from incomplete input, a context-window stop and invalid structured-result JSON/schema. The old client checked the stop before logging usage, so those logs establish neither charged tokens/cost nor the thinking/answer split. Earlier successful smaller reviews do not prove this larger review can complete within the same allowance.

After a valid message envelope, the client now logs only validated `input_tokens` and `output_tokens` integers in 0..1,000,000, before checking the stop/result. Unknown fields and all response/thinking content stay unlogged. Missing or malformed usage is `Usage: unavailable`, never fabricated zero. An explicit provider stop retains its error category even with unavailable usage; an otherwise complete result still fails `invalid_usage`. These counters are provider-reported diagnostics, not a bill or reasoning allocation. HTTP failures, oversized responses and invalid envelopes remain fixed-category-only failures.

## Incomplete input

Automatic reviews with any known gap do not create an API input file or run the paid step. The publisher reports **Incomplete / not reviewed**, the exact head, gap reasons and the pinned preflight command. It never turns a skipped request or stale result into a completed zero-findings review. The advisory job retains its visible incomplete/failure status; required foundation/metadata CI is unchanged.

For clipping, remove redundant prose or arrange coherent, fully reviewable changes without dropping required review content; check again before pushing. Never omit tests or lockfiles just to fit. For unavailable diffs, resolve GitHub availability first. Binary or undecodable content needs separately recorded review coverage and coordinator disposition. Further limit changes require another documented disposition; do not silently exclude files or retry a paid review to work around a gap. Explicit trusted mentions retain the existing bounded reply behavior and incomplete disclosure; prompt/request overflow prevents those calls too. The automatic review never triggers a mention.

The workflow, input builder and API client protect themselves against review of their own changes, including renames. A protected self-skip is **not** Claude analysis. This delivery requires independent fresh GPT-6 Astra/high review and exact CI. The coordinator selects the next real open eligible PR for post-merge verification; a same-head rerun against stale trusted code is not evidence of the fix. Do not create a paid probe. Model/effort, standard speed, input/workspace limits, tool-free operation, secret isolation and exact-head publication stay unchanged. Do not rerun a closed PR for a receipt.

## Offline regression checks

```text
python -m unittest discover -s tests -p test_claude_review.py
python -m unittest discover -s tests -p test_claude_messages.py
```

Synthetic pinned base/head fixtures cover 119,999/120,000/120,001 escaped diff bytes, prompt/request boundaries, the observed 90,142-byte diff size with lockfile/test sections, maximum ASCII and Unicode/escaped metadata, review/mention serialization parity, isolated trusted imports, binary/text mixtures, invalid/NUL bytes, unavailable or empty diffs, clipped metadata, protected paths/renames, local CLI parity and skipped-result publication. Output regressions also cover successful complete responses, token/context stops with no publication, absent/malformed/hostile usage, valid zero counters, invalid envelopes, response bytes immediately below/at/above 1 MiB and a single request. GitHub and Anthropic are mocked; no paid call is made.
