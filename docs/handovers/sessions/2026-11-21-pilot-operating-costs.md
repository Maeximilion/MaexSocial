# Handover 2026-11-21 — #178 pilot operating cost evidence

## Status

Stopped at (UTC) — 2026-11-21T16:57:13Z. The cost evidence and ADR link are committed. Codex prepared the evidence. The existing Claude API review is pending PR publication. Its configured route is `claude-opus-5-5`, high effort, standard speed and standard-only service tier. No runtime review settings or outcome have been observed for this task. [Review policy](../../tooling/agent-workflow.md#pr-review-policy)

- Public vendor pages, five dated AWS region price lists (16 rates) and the Certum one-year SKU were checked with unauthenticated reads. Python Decimal assertions checked six exact and seven rounded amounts against the evidence.
- `python scripts/check_repo.py` passed. `node --test tests/*.test.cjs` passed all 20 tests. `python -m unittest discover -s tests` initially hit a Windows Git subprocess error on an inherited empty config value. Rerunning with `$env:GIT_CONFIG_COUNT = '0'` in the test command's process only passed 91 tests, with 32 skipped. Repository and system settings were not edited.
- No pilot runtime, restore rehearsal, purchase, account opening, product API use or provider contact was part of the checks.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial)
- Task — [#178](https://github.com/Maeximilion/MaexSocial/issues/178), cost inputs for [#10](https://github.com/Maeximilion/MaexSocial/issues/10)
- Branch — `dev-codex/178-pilot-operating-costs`
- Work head before the handover commit — `c952dc62e3c5ccc585fdb56d11e75688eacc3223`
- PR — pending at this checkpoint
- Evidence — [dated costs](../../decisions/2026-11-21-pilot-operating-costs.md) and [historical ADR scenario](../../decisions/0002-google-text-pilot.md#what-would-one-pilot-month-cost)

## Decisions

Use the existing one-month Frankfurt workload. Separate recurring charges, usage, the domain's annual cash charge, the one-time restore and hardware, and conditional signing. New volume and operator-hour assumptions are illustrative. Prices, regions, eligibility and tax apply as stated in the evidence, subject to confirmation for the payer and selected vendors.

## Gate

[G2 local synthetic acceptance](https://github.com/Maeximilion/MaexSocial/issues/15#issuecomment-6681723454) remains the scope. The evidence prepares the paid-envelope decision only. Maxi owns the payer, period, currencies, cap, stop authority, operators, vendor and processing choices. [#10](https://github.com/Maeximilion/MaexSocial/issues/10) retains approval, tested spend and stop controls, integration and external release evidence.

## Open

Open the normal PR with `Closes #178` after confirming the coordinator's publication slot and intended base. On a native stack, verify the parent and child-only comparison before publishing. Attach the PR in the originating chat and verify complete Claude API and CI evidence for its current revisions. The coordinator owns merge and archive.

- Console — PowerShell in the existing worktree for `dev-codex/178-pilot-operating-costs`. The originating chat records the absolute path privately.
- Full start command — `Set-Location (git rev-parse --show-toplevel); git status --short --branch; git fetch origin --prune; gh pr list --repo Maeximilion/MaexSocial --state all --head dev-codex/178-pilot-operating-costs`
- First message — Continue #178 from this handover. Verify the latest coordinator assignment, intended target, PR and review evidence before advancing the delivery.

## Lessons

Read regional price-list meters where global price examples differ. For Windows, confirm both publisher eligibility and available signing regions before including a public tariff in an approved budget. The historical ADR amount remains a planning record. Code Autopilot and Caveman remain enabled for the evidence workflow and concise communication. The advisory scan runs only on explicit `/start` or `/task`.
