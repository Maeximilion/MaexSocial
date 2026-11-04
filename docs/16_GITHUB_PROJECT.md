# GitHub project and maintenance

Repository — https://github.com/Maeximilion/MaexSocial

Single Project — https://github.com/users/Maeximilion/projects/5

Use views of this Project for backlog, board and roadmap. Task IDs MS-001 through MS-013 link repository plans, issues and PRs. Milestones represent G0 through G5. Labels describe task type, priority, area and blocking state. The provisioned names and field IDs are verified by the setup script or live Project inspection.

## Status mapping

| Fact | Intended Project status |
|---|---|
| Open issue without active implementation | Todo |
| Open issue with an active linked PR | In progress |
| Open PR | In review |
| Open item explicitly blocked | Blocked |
| Closed completed issue or merged PR | Done |

A PR closed without merge must not be treated as delivered. A closed issue marked not planned should retain that reason. Reopening work updates its state. Gate completion still requires the charter evidence.

## Iteration and metadata

Keep iteration, start and target dates as explicit planning or observed facts. Preserve manually selected values. Milestones and task IDs must match the work-package table. PRs use Conventional Commit titles and closing keywords only when they complete the referenced issue. Partial work uses a reference and leaves the issue open. Issue and PR templates require acceptance evidence and actual verification results.

The provisioned Iteration field uses 14-day periods, beginning with I1 on 2026-11-04, I2 on 2026-11-18 and I3 on 2026-12-02. Later periods require explicit extension or verified maintenance. Their existence does not assign a task automatically or imply a delivery commitment.

The metadata validator permits authenticated `dependabot[bot]` PRs with Bot identity, this repository as the source and a `dependabot/` branch to be standalone maintenance work items. The actor triggering a run is not enough. Human/fork PRs still require an explicit task reference; all PRs require valid titles, tests and review. Preserve `Refs #25` on the initial dependency queue when editing it, but a bot-generated description must not be the sole tracking mechanism.

Small fixes normally use a regular push to the existing PR. Only a necessary rewrite of an owned task branch uses `--force-with-lease=<branch>:<expected-remote-SHA>`, after fetching and checking that all remote work is accounted for. Main protection remains active; a small diff does not authorize bypassing it. Re-run checks and obtain applicable review for the new head.

## Repository security baseline

On 2026-11-05 secret scanning and secret-scanning push protection were changed from disabled to enabled. Dependabot security updates, vulnerability alerts and private vulnerability reporting were already enabled. CodeQL default setup was enabled for `actions` and `python` with the default query suite and standard GitHub runners. This uses GitHub's managed configuration rather than adding a second workflow. See [setup run](https://github.com/Maeximilion/MaexSocial/actions/runs/41933171109) for actual execution evidence.

The enforced checks remain `foundation` and `metadata`; CodeQL runs and alerts are additional security evidence, not currently a separate required merge rule. Existing SHA pins, minimal permissions and the prohibition on executing PR code with privileged `pull_request_target` credentials remain in effect. No production CD or login implementation exists. [Evaluation strategy](08_EVALS.md) records the next test and release requirements.

For an intentional rollback, read the current settings first and preserve later changes. Secret-scanning flags are individually configurable under `security_and_analysis` with `PATCH /repos/Maeximilion/MaexSocial`; CodeQL can be disabled using `PATCH /repos/Maeximilion/MaexSocial/code-scanning/default-setup` with `state=not-configured`. Disabling protection is a separate owner decision, not an automatic response to a failed scan. Historical alerts/artifacts are not erased by a settings rollback.

References: [GitHub default setup](https://docs.github.com/en/code-security/how-tos/find-and-fix-code-vulnerabilities/configure-code-scanning/configure-code-scanning), [repository security settings](https://docs.github.com/en/enterprise-cloud@latest/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-security-and-analysis-settings-for-your-repository) and [supported secret patterns](https://docs.github.com/en/code-security/reference/secret-security/supported-secret-scanning-patterns), consulted 2026-11-05. Scanning has coverage limits and does not prove application security.

## Automation state

Repository Actions may maintain issue/PR metadata with the scoped built-in token. Account Project synchronization requires dedicated Project access. `PROJECT_TOKEN` is configured and `PROJECT_SYNC_ENABLED=true`. Hosted activation passed in run [41929472537](https://github.com/Maeximilion/MaexSocial/actions/runs/41929472537). The coordinator can synchronize locally with existing authorized access and report what changed.

Before enabling automation, configure the Project number and a dedicated token with the account Project read/write permissions and repository read permissions required to read its items. Never write a token to a file committed to Git. Test synchronization manually, inspect the resulting fields and run it again to verify no duplicates. Then enable scheduled/event execution and verify its Actions run.

## Maintenance contract

Discover existing items by repository URL before adding them. Preserve assignments, labels and planning fields unless a documented fact warrants an update. Report ambiguous states. Scheduled jobs must have minimal permissions, bounded execution and visible failures. Fork PR code must never execute with a Project secret. Repository protection requires only CI jobs that actually exist and run on the relevant event.

## Set up the Project credential from PowerShell

Create a dedicated classic token in GitHub Settings > Developer settings > Personal access tokens. Use `project` and `public_repo`, an explicit expiration and a descriptive name. This token can access personal projects and public repositories, so keep it dedicated and rotate it before expiration.

```powershell
gh secret set PROJECT_TOKEN --repo Maeximilion/MaexSocial
gh secret list --repo Maeximilion/MaexSocial
```

Paste the token only into the hidden prompt, never into the command line, a file, chat or issue. Once the workflow is merged and the secret exists, enable and test it.

```powershell
gh variable set PROJECT_SYNC_ENABLED --repo Maeximilion/MaexSocial --body true
gh workflow run project-sync.yml --repo Maeximilion/MaexSocial --ref main
gh run list --repo Maeximilion/MaexSocial --workflow project-sync.yml --limit 5
```

Inspect the triggered run before claiming automation works. Hosted setup was verified on 2026-11-04. Direct, narrowly scoped GraphQL queries are used for Project access because generic `gh project` queries request unrelated organization/discussion scopes. The main ruleset requires the `foundation` and `metadata` checks, blocks deletion and force-push, and requires PRs. GitHub approval count is zero for this single-owner repository, so the required Astra review is a documented agent process rather than a second-account approval requirement.



Verification on 2026-11-04 also passed a [second hosted run](https://github.com/Maeximilion/MaexSocial/actions/runs/41929539432). Project item count stayed 25 with 25 unique IDs, and all existing Iteration assignments remained unchanged. Both checks preceded the documentation closeout PR and subsequent maintenance events.
