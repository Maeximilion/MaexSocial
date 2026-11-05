# Evaluation and gate evidence

Foundation CI validates repository artifacts and automation. It does not measure the future product's content quality or publishing reliability.

## Current repository checks

| Check | Covers | Limit |
|---|---|---|
| `foundation` (required) | Markdown links, JSON/TOML syntax, narrow repository SVG policy, Python hook/artwork regressions and executable Node metadata/maintenance tests | No deployed application, upload sanitizer or provider behavior |
| `metadata` (required) | Conventional Commit title and task reference; authenticated same-repository Dependabot PRs may be their own maintenance task | No code correctness claim |
| CodeQL default setup | Static analysis of Python tooling and GitHub Actions | Findings require triage; not login, isolation or penetration testing |
| Secret scanning + push protection | Supported secret patterns and supported pushes | Does not detect every credential or replace credential handling |
| Dependabot | Pinned Actions updates and vulnerability alerts | Updates still require compatibility review and green checks |
| Maintenance / Project reconciliation | Assignment, task metadata and board status | Green automation does not approve a product gate |

Run `python scripts/check_repo.py`, `python -m unittest discover -s tests` and `node --test tests/*.test.cjs`. The metadata tests execute the workflow's actual inline script. They cover trusted bots, humans, fork/deleted repositories, spoofed identity/actor, task links and invalid titles. No extra test framework or package installation is required.

Artwork tests accept the existing originals and reject hostile SVG fixtures without rendering them. Hook tests exercise bounded input, Stop-loop handling, checker failures/timeouts and configured command paths. Direct execution is not proof that a running Claude/Codex session loaded or trusted a hook; verify that separately using the [tooling guide](tooling/agent-workflow.md).

Maintenance tests exercise the actual API-only workflow against controlled GitHub responses, covering inherited metadata, preserved manual choices, dedicated dependency-task reuse and native Development linkage. Hosted verification must additionally establish the workflow token's real API permissions and Project reconciliation after generated changes.

The 2026-11-05 failure on dependency PRs was a missing body task reference, not a failed application test. Keep broad maintenance links when useful, but do not make a genuine first-party bot PR depend on a manually preserved body edit. The exception grants no token permissions or merge authorization.

## Application checks to implement with the approved first slice

| Area | Tests and required evidence |
|---|---|
| Registration, login, administration | [ACCESS-01–14](17_ACCESS_SECURITY.md): server-side negative authorization, two-tenant isolation, admin privilege/MFA, verification/recovery and session replay tests, plus browser journeys |
| Upload, processing and delivery | [UPLOAD-01–10](security/uploads.md): disguised/active formats, bounded decoding, quarantine, tenant isolation, delivery headers, processor authority, SSRF and lifecycle/recovery |
| Core rules | Fast unit tests for authorization policy, publication states, idempotency and budget calculations |
| API, data and jobs | Integration tests against an isolated test database; tenant tampering, concurrent writes, migrations and worker revocation |
| Provider boundaries | Contract tests and deterministic failure simulation; timeout, 429/retry, expired credentials and ambiguous publish reconciliation |
| UI | Few end-to-end registration/login/customer/admin/publication flows, keyboard/accessibility checks; visual checks for relevant UI changes |
| Release | Production build, type/lint checks where the chosen stack supports them, dependency/security analysis, deployment smoke checks and tested rollback |

Choose tools after G2 selects the stack. Avoid a nominal coverage percentage: require positive and negative cases for each permission boundary and business-critical state transition. Live provider tests use explicitly authorized test accounts and budgets and run separately from ordinary fork PRs.

## CD plan

There is no deployment pipeline or production application yet. MS-009 must define an isolated preview/staging environment with synthetic data, reproducible build artifacts, least-privilege deployment identity (prefer short-lived OIDC credentials where supported), migration checks and health probes. Promote the tested artifact to production only after the release authorization and protected-environment checks. Record the deployment SHA, rollback artifact/procedure and database restore/migration strategy. Verify rollback in staging before external customer access. Do not install placeholder deployments while hosting and the product design remain undecided.

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

At G2, accept and map the proposed MEDIA-01–04, PLAN-01–04 and ADS-01–04 cases in the [media-library proposal](18_MEDIA_LIBRARY.md) to executable tasks. They cover asset isolation, billable-job recovery, recurrence, approval/stop races and separate advertising authority. These cases are specifications only; no application/provider test has been run for them.

Use synthetic businesses, accounts and content. Authorized test-account identifiers stay out of public fixtures. Provider fakes test deterministic behavior. Live provider tests must be labeled with environment, date and permission scope. A fake success does not establish live API availability.

## Report format

Record commit SHA, command or scenario, environment, expected result, observed result, pass/fail, artifact path and limitations. For model evaluations also record model/provider version, prompt revision, sample size, quality rubric, cost and human review method. Set measurable thresholds at G2 before interpreting a pilot as passing.

A failed gate remains open. Fixes add regression coverage for the failing scenario. Code review uses `gpt-6-astra` with reasoning `high`, on the actual reviewed commit. Any later commit requires the relevant checks and review to apply to that new head.

## Advisory PR reviews

The [workflow](../.github/workflows/claude-review.yml) checks out only the default branch. Automatic reviews use `pull_request_target` for same-repository PRs; trusted collaborators can request a review with `@claude` in the main PR conversation. Inline mentions do not trigger the client because their event can select PR-controlled workflow YAML. Findings are still published inline. Before contacting Anthropic, compare the pinned base/head changed paths (both sides of renames). Skip changes to the workflow or [API client](../scripts/claude_messages.py), and skip if the 300-file compare limit prevents verification. A different workflow blob at the checked-out default-branch revision also skips. Never run PR code. Metadata, diff and mention text travel as nonce-framed user data, separately from the system instructions. Cut or unavailable data is marked incomplete. Automatic reviews with no usable diff post the incomplete notice without an Anthropic call. A trusted step posts inline findings at the reviewed commit and one top-level result, skip or failure notice.

Our application makes **one** HTTPS POST to the fixed Anthropic Messages endpoint using the Actions `ANTHROPIC_API_KEY` (Dependabot's separate secret store where applicable). No Claude Code, tools, redirects, SDK retries, token-count request or fallback. The API receives `claude-opus-5-5`, high effort, standard speed and [structured JSON output](https://platform.claude.com/docs/en/build-with-claude/structured-outputs). The provider schema specifies the shape; the client validates text lengths, line numbers and finding count. Only an end-of-turn response with a validated result can be published. Logs contain sanitized token counts on success, not the prompt, thinking or response body.

**Cost target:** under the [published standard rates](https://platform.claude.com/docs/en/models/opus-5-5/overview) of $4/$20 per million input/output tokens, sizing 100,000 serialized request bytes conservatively as 100,000 input tokens and 8,192 output tokens including thinking gives $0.564 before provider overhead. The remaining margin accommodates message/schema overhead. This is a planning bound under those prices, not a provider billing cap. No fast mode, cache writes, regional premium or extra paid turn is requested. Recheck rates when changing model, budgets or pricing. The owner manages the reported $75 workspace monthly limit.

**Failed review:** use the run link in the main PR comment. A missing/invalid local credential means no request was sent. For [HTTP errors](https://platform.claude.com/docs/en/api/errors), 401 means authentication rejected, 402 billing, 403 permission, 404 resource unavailable, 429 rate or spend limit. For 400 check the fixed request/schema; it does not by itself prove a billing or model-access issue. Other HTTP statuses, transport failures and local client failures are distinct; they do not prove why an account was rejected. Refusal, output truncation, invalid envelope/schema or usage, and oversized/short responses never publish a clean result. A timeout may already have incurred cost. Never dump headers, bodies, keys or enable debug logging. Do not retry automatically.

The [original run](https://github.com/Maeximilion/MaexSocial/actions/runs/42129500055) failed with no structured output, no usage and $0 reported. Maxi confirmed credit; its type and the failure's cause are unverified. The [credit FAQ](https://support.claude.com/en/articles/17154008-monthly-api-credits-for-max-ultra-and-team-plans) distinguishes custom API apps from the Claude Code GitHub Action. Only the coordinator activates the workflow and tests [#60](https://github.com/Maeximilion/MaexSocial/pull/60) once. Record the exact historical SHA, Actions URL, genuine inline finding and main comment on [#102](https://github.com/Maeximilion/MaexSocial/issues/102). Keep the product pause and exact-head Codex fallback until a real receipt is verified; Claude supplements the required independent Astra/high review.
