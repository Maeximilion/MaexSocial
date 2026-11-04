# Evaluation and gate evidence

Foundation CI validates repository artifacts and automation. It does not measure the future product's content quality or publishing reliability.

| Gate | Required checks |
|---|---|
| G0 | Documentation links, required files, task/gate references, workflow validation and live GitHub verification |
| G1 | Source traceability, distinct evidence classes, reproducible REA steps, complete limitation statements and cross-report consistency |
| G2 | Approved acceptance criteria, tests mapped to risks, provider/access feasibility and budget decisions |
| G3 | One full workflow, tenant isolation, revoked credentials, duplicate request, ambiguous timeout, retries and stop behavior |
| G4 | Asset provenance, render failures, output suitability, cancellation behavior and cost reservation/release |
| G5 | Policy enforcement under concurrency, stop/revocation races, supervised quality measurements and audit completeness |

## Test data

Use synthetic businesses, accounts and content. Authorized test-account identifiers stay out of public fixtures. Provider fakes test deterministic behavior. Live provider tests must be labeled with environment, date and permission scope. A fake success does not establish live API availability.

## Report format

Record commit SHA, command or scenario, environment, expected result, observed result, pass/fail, artifact path and limitations. For model evaluations also record model/provider version, prompt revision, sample size, quality rubric, cost and human review method. Set measurable thresholds at G2 before interpreting a pilot as passing.

A failed gate remains open. Fixes add regression coverage for the failing scenario. Code review uses `gpt-6-astra` with reasoning `high`, on the actual reviewed commit. Any later commit requires the relevant checks and review to apply to that new head.
