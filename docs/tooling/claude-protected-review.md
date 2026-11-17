# Trusted protected-change Claude review

[Maintenance #127](https://github.com/Maeximilion/MaexSocial/issues/127) adds the [manual workflow](../../.github/workflows/claude-protected-review.yml) and [helper](../../scripts/claude_protected_review.py). This is the independent route for PRs that change or rename `.github/workflows/claude-review.yml`, `scripts/claude_input.py` or `scripts/claude_messages.py`. The ordinary workflow's guards remain unchanged.

## Availability and authorization

The bootstrap must receive a complete ordinary Claude API review and current required CI before merging. Only the independently reviewed version on the default branch may run this route. Do not dispatch the bootstrap from its task branch, create a synthetic PR or pay for a diagnostic run. Its first future genuine protected-change PR supplies the live verification; offline tests do not establish live API permissions or provider success.

The coordinator explicitly authorizes each dispatch and verifies the selected default revision was reviewed. Repository write/maintain/admin permissions are also checked for both the original and triggering actor. GitHub repository permissions alone do not document the coordinator's operational approval. This workflow does not grant merge authority. Never execute an unreviewed workflow version via a task-branch dispatch.

## Dispatch an exact real PR

After authorization, read the open PR's head, base tip and target and the current default-branch tip. Use full lowercase 40-character SHAs, replacing the uppercase placeholders below:

```text
gh pr view PR_NUMBER --repo Maeximilion/MaexSocial --json state,headRefOid,baseRefOid,baseRefName,isCrossRepository,mergeable
gh api repos/Maeximilion/MaexSocial/git/ref/heads/main --jq .object.sha
gh workflow run claude-protected-review.yml --repo Maeximilion/MaexSocial --ref main -f pr=PR_NUMBER -f expected_head=HEAD_SHA -f expected_base=BASE_SHA -f expected_target=TARGET_BRANCH -f trusted_sha=DEFAULT_SHA
```

The example uses the current default `main`; check it before invoking. The workflow selects only the default branch, then requires the checkout, running workflow, dispatch commit and current default tip to equal `trusted_sha`. Every executable dependency comes from that checkout. PR contents are fetched as data, never checked out or executed. The helper checks the actual target tip, merge base and test merge commit's two parents against the expected base/head. Unknown mergeability or conflicts fail without a request. Existing CI remains bound to its actual candidate; the coordinator compares that candidate and the receipt before merge.

GitHub documents [dispatch ref semantics](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch), the [test merge commit](https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request) and [comparison pagination limits](https://docs.github.com/en/rest/commits/commits#compare-two-commits). The route refuses 300 or more paths and file-count mismatches, rather than trusting a potentially incomplete list. It uses the existing builder's complete bounded diff and metadata; binary, unavailable, clipped or malformed input is not submitted.

## Evidence and failure handling

One API step runs the unchanged Messages client: Opus 5.5/high/standard, `standard_only`, 32,768 output tokens, existing input caps, 960-second transport and a 20-minute job. No retries. Only that step receives the existing Anthropic key; only preparation/publication receive the GitHub token. No raw response, thinking, API error payload or key is logged. Existing fixed usage counters and fixed failure categories remain available.

The publisher requires successful preparation, saved exact evidence and a successful actual API step before accepting the client's result file. `result_from` only rechecks its schema; the locally reconstructed schema envelope is not proof of provider completion. Preparation removes prior result/input/evidence files. A skipped/failed/cancelled API step cannot publish a stale zero-findings receipt. Reruns (`GITHUB_RUN_ATTEMPT != 1`) are rejected; diagnose the original safe failure evidence before considering another explicitly authorized dispatch.

Each overview identifies the Actions run, head, base tip, target, merge base, test merge candidate and trusted reviewer revision. Findings use a review with `commit_id=head` and the returned path/line/side. Overflow or rejected inline placement is incomplete; rejected findings remain visible in an incomplete overview. Preparation failures are not reviews. Invalid trust/identity prevents publication entirely, leaving a failed Actions run with a fixed diagnostic.

Immediately before inline review and overview writes, recheck revisions, PR metadata and open same-repository state. Drift after the inline write suppresses the completion overview; the already-published review still carries its original commit ID. GitHub does not offer an atomic compare-and-publish operation: a small final GET/POST race remains. A receipt is historical evidence, not a guarantee the PR cannot move afterward. The coordinator must recheck current state and coverage before merge.

## Self-protection and recovery

Changes or renames involving either new executable route file are rejected as `self_change_not_reviewed`. Tests and documentation are data, not executable dependencies of the hosted route. A change to the new route alone uses the ordinary reviewer; a change to the original route uses this manual route. Split coherent changes touching both routes so an unchanged independent reviewer remains available. Never relax a guard to make a review look complete.

Cancel a mistaken run through Actions; a request already sent may still incur cost. Do not retry blindly, rerun closed PRs or substitute a different reviewer. Preserve the failed run, exact revisions and fixed category, then report the next decision to the coordinator. This delivery does not change accounts, secret source, recipient, budget, host settings or product gates.

## Offline verification

```text
python -m unittest discover -s tests -p 'test_claude*.py' -q
python scripts/check_repo.py
python -m unittest discover -s tests
node --test tests/*.test.cjs
```

Synthetic tests cover dispatch/actor trust, forks/closed/retargeted/moved PRs, candidate parents, self-renames, path/input bounds, stale files, actual client entrypoint with mocked provider completion/exhaustion, failed inline placement, stale publication, isolated imports and workflow credential boundaries. No live protected dispatch has been run for this bootstrap.
