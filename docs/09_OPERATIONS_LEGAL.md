# Research handling and operating decisions

## Public repository

MaexSocial is public by Maxi's explicit choice. Store sanitized conclusions and reproducible instructions. Keep authentication cookies, tokens, raw account captures, customer records, private business data and personal identifiers outside Git. Redact screenshots and network evidence before sharing. Do not infer permission to redistribute proprietary frontend code from access to a browser page.

## REA boundary

Inspect public resources and workflows available through an authorized account. Record target URL, date, access level and tools. Live write actions, paid generation, subscription changes and publishing need scope explicitly covering those effects. A research task may observe supported functionality without performing every irreversible action. Authentication barriers are reported as access gaps.

## Before an operating pilot

At G2 record account ownership, permitted channels, content/media rights, processor and hosting decisions, retention/deletion rules, budget and escalation owner. Verify current provider terms and applicable requirements from primary sources. This document records decisions and evidence rather than offering a legal approval.

## Operational acceptance

The first deployment needs secret storage, rotation/revocation, backups with restore verification where persistent data exists, monitoring, durable job recovery and a stop control. Scope these to the selected stack. Log identifiers and outcomes without secret values. Publishing credentials must be isolated by workspace and provider scope.

## GitHub automation credential

`GITHUB_TOKEN` handles authorized repository metadata. Account Project automation requires separately configured Project access. `PROJECT_TOKEN` is configured and hosted synchronization has been verified. The workflow uses targeted Project API queries with project/public_repo scopes. Never print credentials or silently copy a broad personal token into Actions. Document the minimum permissions and verification result in [GitHub project](16_GITHUB_PROJECT.md).
