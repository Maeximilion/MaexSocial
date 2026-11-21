# Evaluation and gate evidence

Foundation CI validates repository artifacts and automation. It does not measure the future product's content quality or publishing reliability.

## Current repository checks

| Check | Covers | Limit |
|---|---|---|
| `foundation` (required) | Markdown links, JSON/TOML syntax, narrow repository SVG policy, Python hook/artwork regressions and executable Node metadata/maintenance tests | No deployed application, upload sanitizer or provider behavior |
| `metadata` (required) | Conventional Commit title and task reference; authenticated same-repository Dependabot PRs may be their own maintenance task | No code correctness claim |
| CodeQL default setup | Static analysis of JavaScript/TypeScript, Python and GitHub Actions | Findings require triage; not login, isolation or penetration testing |
| Secret scanning + push protection | Supported secret patterns and supported pushes | Does not detect every credential or replace credential handling |
| Dependabot | Pinned Actions updates and vulnerability alerts | Updates still require compatibility review and green checks |
| Maintenance / Project reconciliation | Assignment, task metadata and board status | Green automation does not approve a product gate |

Run `python scripts/check_repo.py`, `python -m unittest discover -s tests` and `node --test tests/*.test.cjs`. The metadata tests execute the workflow's actual inline script. They cover trusted bots, humans, fork/deleted repositories, spoofed identity/actor, task links and invalid titles. No extra test framework or package installation is required.

The [protected Claude route](tooling/claude-protected-review.md) has offline trust, exact-revision, lifecycle, completeness and publication regressions. [PR #130's API run](https://github.com/Maeximilion/MaexSocial/actions/runs/44105408195) and [published result](https://github.com/Maeximilion/MaexSocial/pull/130#issuecomment-6951209268) established its first complete live execution. Each protected PR still needs review evidence for its own input.

The [local pilot workflow](../.github/workflows/pilot.yml) builds the TypeScript pilot, drills migrations on a disposable fixture, runs the pilot suite and repeats it after restarting with retained volumes. The [fixture commands](../ops/local/README.md) and [pilot evidence map](superpowers/plans/2026-11-05-ms-009-pilot-evidence-map.md) distinguish completed component checks from whole-slice, staging and provider evidence.

Artwork tests accept the existing originals and reject hostile SVG fixtures without rendering them. Hook tests exercise bounded input, Stop-loop handling, checker failures/timeouts and configured command paths. Direct execution is not proof that a running Claude/Codex session loaded or trusted a hook; verify that separately using the [tooling guide](tooling/agent-workflow.md).

Maintenance tests exercise the actual API-only workflow against controlled GitHub responses, covering inherited metadata, preserved manual choices, dedicated dependency-task reuse and native Development linkage. Hosted verification must additionally establish the workflow token's real API permissions and Project reconciliation after generated changes.

The 2026-11-05 failure on dependency PRs was a missing body task reference, not a failed application test. Keep broad maintenance links when useful, but do not make a genuine first-party bot PR depend on a manually preserved body edit. The exception grants no token permissions or merge authorization.

## Application checks to implement with the approved first slice

| Area | Tests and required evidence |
|---|---|
| Registration, login, administration | [ACCESS-01–17](17_ACCESS_SECURITY.md): server-side negative authorization, two-tenant isolation, admin privilege/MFA, verification/recovery and session replay tests, plus browser journeys |
| Upload, processing and delivery | [UPLOAD-01–10](security/uploads.md): disguised/active formats, bounded decoding, quarantine, tenant isolation, delivery headers, processor authority, SSRF and lifecycle/recovery |
| Core rules | Fast unit tests for authorization policy, publication states, idempotency and budget calculations |
| API, data and jobs | Integration tests against an isolated test database; tenant tampering, concurrent writes, migrations and worker revocation |
| Provider boundaries | Contract tests and deterministic failure simulation; timeout, 429/retry, expired credentials and ambiguous publish reconciliation |
| UI | Few end-to-end registration/login/customer/admin/publication flows, keyboard/accessibility checks; visual checks for relevant UI changes |
| Release | Production build, type/lint checks where the chosen stack supports them, dependency/security analysis, deployment smoke checks and tested rollback |

Use the [accepted G2 stack and test values](superpowers/specs/2026-11-06-g2-acceptance-packet.md) for the isolated synthetic pilot. Require positive and negative cases for each permission boundary and business-critical state transition. Live provider tests use explicitly authorized test accounts and budgets and run separately from ordinary fork PRs.

## CD plan

The [G2 decision record](superpowers/specs/2026-11-06-g2-acceptance-packet.md) records the owner's acceptance of MS-009 and separate authorization for isolated local synthetic implementation after the record merged. [#82](https://github.com/Maeximilion/MaexSocial/issues/82) retains staging access/security and recovery evidence, and [#163](https://github.com/Maeximilion/MaexSocial/issues/163) owns the staging entry. A separately authorized staging run requires synthetic data, reproducible build artifacts, least-privilege deployment identity, migration checks and health probes. Record the deployment SHA, rollback artifact and procedure, and database restore/migration strategy. Verify rollback in staging before external customer access. Production promotion requires release authorization and protected-environment checks.

## Gate mapping

| Gate | Required checks |
|---|---|
| G0 | Documentation links, required files, task/gate references, workflow validation and live GitHub verification |
| G1 | Source traceability, distinct evidence classes, reproducible REA steps, complete limitation statements and cross-report consistency |
| G2 | Approved acceptance criteria, tests mapped to risks, provider/access feasibility and budget decisions |
| G3 | One full workflow, tenant isolation, revoked credentials, duplicate request, ambiguous timeout, retries and stop behavior |
| G4 | Asset provenance, render failures, output suitability, cancellation behavior and cost reservation/release |
| G5 | Policy enforcement under concurrency, stop/revocation races, supervised quality measurements and audit completeness |

## Test data

Apply PLAN-01/03/04 and the ADS-01 disabled-path control under the [accepted text-only pilot evidence map](superpowers/plans/2026-11-05-ms-009-pilot-evidence-map.md). For separately approved media, recurrence or advertising, map applicable MEDIA-01–04, PLAN-02 and ADS-02–04 cases from the [media-library proposal](18_MEDIA_LIBRARY.md) to executable tasks. Use dated case-specific receipts to distinguish completed local checks from planned provider or release evidence.

Use synthetic businesses, accounts and content. Authorized test-account identifiers stay out of public fixtures. Provider fakes test deterministic behavior. Live provider tests must be labeled with environment, date and permission scope. A fake success does not establish live API availability.

## Report format

Record commit SHA, command or scenario, environment, expected result, observed result, pass/fail, artifact path and limitations. For model evaluations also record model/provider version, prompt revision, sample size, quality rubric, cost and human review method. Set measurable thresholds before interpreting the applicable pilot as passing.

A failed gate remains open. Fixes add regression coverage for the failing scenario. The [MaexSocial PR review policy](tooling/agent-workflow.md#pr-review-policy) requires actual Claude API execution, an authentic complete result for the current head and reviewed base/diff, and the applicable integration checks.

## Advisory PR reviews

The [ordinary workflow](../.github/workflows/claude-review.yml) checks out only the default branch. Automatic reviews use `pull_request_target` for same-repository PRs. Trusted collaborators can ask questions with `@claude` in the main PR conversation. The workflow checks the pinned base/head changed paths, including both sides of renames. Changes to the workflow, [input builder](../scripts/claude_input.py) or [API client](../scripts/claude_messages.py), unverifiable paths at the compare limit, or a mismatch with the trusted workflow blob cause a self-skip. The [review policy](tooling/agent-workflow.md#pr-review-policy) governs the independent protected route. PR code never executes. Metadata, diff and mention text travel as nonce-framed user data, separately from system instructions. Binary content, undecodable bytes, clipped data and unavailable input produce coverage gaps. Automatic review skips the API call when input has known gaps. A trusted step posts inline findings at the reviewed commit and one top-level result, skip or failure notice.

The review client makes **one** HTTPS POST to the fixed Anthropic Messages endpoint using the Actions `ANTHROPIC_API_KEY` (Dependabot's separate secret store where applicable). No Claude Code, tools, redirects, SDK retries, token-count request or fallback. The request uses `claude-opus-5-5`, high effort, standard speed, `standard_only` service tier and [structured JSON output](https://platform.claude.com/docs/en/build-with-claude/structured-outputs). The client validates text lengths, line numbers and finding count and publishes only a validated end-of-turn result. After a valid response envelope, logs contain only validated scalar token counts or a fixed unavailable marker, including on provider stops. The prompt, thinking and response body stay out of logs.

Automatic reviews return each finding once. The publisher builds the main comment from the validated findings, including path, line, side and body, or reports zero findings. Manual PR questions also receive a written answer. Both modes report up to ten findings and require a boolean `overflow` flag. Omitted findings, missing or clipped input and failed inline placement are marked incomplete. A failed response produces no findings or clean verdict.

**Cost target:** the [approved input/output envelope and dated cost calculation](tooling/claude-input-preflight.md#cost-planning-not-billing-enforcement) cap serialized requests at 210,000 bytes and output at 32,768 tokens including thinking. At the published USD4/20 per million input/output tokens, treating those bytes as input tokens plus an assumed 10,000-token overhead allowance gives USD1.53536, rounded to USD1.54 for planning. This is neither measured usage nor a guaranteed billing cap. The response remains bounded to 1 MiB; the 960-second socket timeout is separate from the unchanged 20-minute job limit. No fast mode, cache writes, regional premium or extra paid turn is requested. Recheck rates when changing model, budgets or pricing. The owner manages the reported USD75 workspace monthly limit; this change does not verify or alter it.

**Failed review:** use the run link in the main PR comment. A missing/invalid local credential means no request was sent. For [HTTP errors](https://platform.claude.com/docs/en/api/errors), 401 means authentication rejected, 402 billing, 403 permission, 404 resource unavailable, 429 rate or spend limit. For 400 check the fixed request/schema; it does not by itself prove a billing or model-access issue. Other HTTP statuses, transport failures and local client failures are distinct; they do not prove why an account was rejected. Refusal, output truncation, invalid envelope/schema or usage, and oversized/short responses never publish a clean result. A timeout may already have incurred cost. Never dump headers, bodies, keys or enable debug logging. Do not retry automatically.

The client distinguishes `output_token_limit` from `context_window_limit`, and invalid result JSON from invalid fields, findings, overflow or a manual answer. Older `output_truncated` and `invalid_schema` notices remain ambiguous. The [#106 offline reproduction](https://github.com/Maeximilion/MaexSocial/issues/109#issuecomment-6673074291) checks transport of all 49,210 escaped diff bytes. A synthetic response cannot establish a provider verdict.

The [original diagnostic run](https://github.com/Maeximilion/MaexSocial/actions/runs/42129500055) failed with no structured output, no usage and $0 reported. Maxi confirmed credit. The credit type and failure cause remain unverified. [#102](https://github.com/Maeximilion/MaexSocial/issues/102) preserves that history. For current work, use the [read-only input preflight](tooling/claude-input-preflight.md) and the existing authorized Claude API route.
