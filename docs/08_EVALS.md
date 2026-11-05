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

A failed gate remains open. Fixes add regression coverage for the failing scenario. Code review uses `gpt-6-astra` with reasoning `high`, on the actual reviewed commit. Any later commit requires the relevant checks and review to apply to that new head. The Claude review workflow (`.github/workflows/claude-review.yml`) is advisory and supplementary: its comments may surface findings, but it never replaces or satisfies the required `gpt-6-astra` high review. The model receives PR data only as bounded, framed prompt text from the GitHub API and has no file, shell, web, edit, commit or push tools; only the default branch is checked out. Line findings are published by a trusted workflow step as one review pinned to the reviewed head SHA. Automatic reviews and inline review-comment mentions of a PR that changes that workflow file, such as a Dependabot bump of a pinned action, get a documented skip when the run's workflow differs from the default branch. A queued run can also encounter that mismatch after the default branch advances. PR conversation mentions use the default-branch workflow. Any other missing result fails the job visibly.

Automatic reviews and mentions use the Actions secret `ANTHROPIC_API_KEY` (Dependabot events use its separate secret store), with no subscription fallback. The [pinned action](https://github.com/anthropics/claude-code-action/blob/c0949c50a78c1ec8ce2647db36629b870e715d0c/base-action/src/parse-sdk-options.ts) takes `--model claude-opus-5-5 --effort high --max-budget-usd 1.00`. The [CLI budget](https://code.claude.com/docs/en/cli-reference) checks estimated spend between turns; a turn can exceed $1. A budget abort is a failed review, never a clean verdict. Maxi manages the dedicated workspace's reported $75 monthly limit. For [#102](https://github.com/Maeximilion/MaexSocial/issues/102), verify the configured flags at the workflow revision and link the historical PR's exact head, run and published result; never dump inputs or credentials.
