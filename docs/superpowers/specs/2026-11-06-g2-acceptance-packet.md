# G2 accepted local design and implementation authority

**2026-11-06:** Maxi [accepted the local contracts, bounded G2 and separately the local start](https://github.com/Maeximilion/MaexSocial/issues/15#issuecomment-6681723454) against reviewed packet `56e345d6c6aca8fa38c902f7958882475c3a0399` and merged plan #112. Dispatch follows this decision-record merge. This chat delivers no product implementation, gate tag or issue closure.

## Accepted contracts and sources

The [complete reviewed packet](https://github.com/Maeximilion/MaexSocial/blob/56e345d6c6aca8fa38c902f7958882475c3a0399/docs/superpowers/specs/2026-11-06-g2-acceptance-packet.md) preserves every accepted requirement, numerical value, test, source and limit. All remain binding.

Use [ADR 0001](../../decisions/0001-application-language.md), [ADR 0002](../../decisions/0002-google-text-pilot.md), [ACCESS-01–17](../../17_ACCESS_SECURITY.md), the [local implementation plan](../plans/2026-11-05-ms-009-local-text-pilot.md) and [evidence map](../plans/2026-11-05-ms-009-pilot-evidence-map.md). The plan/evidence map in merged #112 at `b97e6cfd9f75cb545deef46c7afc2feea7b8361a` matched its reviewed content.

Keep the accepted isolated synthetic text scope, components and authority/state contracts. Pin maintained patches during implementation; no external egress. [#43's owner disposition](https://github.com/Maeximilion/MaexSocial/issues/43#issuecomment-6671306956) keeps media disabled for every role; #99 retains [UPLOAD-01–10](../../security/uploads.md) before future media release.

## Accepted local test values

The [full values checkpoint](https://github.com/Maeximilion/MaexSocial/issues/15#issuecomment-6681655978) and reviewed packet define these synthetic requirements; they grant no real-personal-data authority.

| Contract | Accepted value |
|---|---|
| Manager approval/Employee invitation/removal and sensitive DEV/Admin MFA | Enrolled proof at most **5 minutes**; admin phishing-resistant. Test exactly 5 minutes as fresh and greater ages as stale |
| Challenges and sessions | Invite/verify 24 h; reset 15 min; browser idle/absolute 30 min/8 h; admin 10 min/1 h; memory-only token 5 min; revocation overrides expiry |
| Abuse counters | Login 5/account + 30/source per 15 min; signup/recovery/resend each 3/account + 10/source per hour, including unknown identities |
| Own data and backups | Online purge within 7 days; grant unusable immediately/vault purge within 24 h; own minimized resolved intent/receipt facts and restricted audit 90 days; rolling backups 30 days, final copy expiry within 30 days after online purge |
| Google-returned content | Separate from own facts; on-demand readback, no long-lived payload logs/backups; any policy-permitted temporary cache at most 30 calendar days, including after restore |

Unknown intents remain restricted for named reconciliation. Recovery retains independent control/spare authentication, non-exportable keys, trusted higher-version rollback, independent deletion/revocation history and isolated app/IdP restore. Quarantine every historical occurrence until independent evidence excludes both send and export claims; missing history or empty readback cannot justify reopening.

## Execution and evidence

Use the six-task sequence: environment/storage → portal/activation/approval → Windows management → dispatch/export → recovery → whole-slice evidence. Task 3 consumes task 2. The coordinator dispatches #114 as task 1 under #10 after this record merges.

Every named evidence-map case remains required. No product command, migration, runtime/hardware journey or external test ran here. Fake LIVE/export cannot satisfy G3; real hardware/provider evidence remains required.

No external spending. ADR 0002's historical USD45/~49 estimate is neither a current quote nor a cap; total cost remains unknown.

## Carried gaps and native blockers

[Transfer evidence](https://github.com/Maeximilion/MaexSocial/issues/15#issuecomment-6681840518) records the owner-approved criteria in assigned open issues. Maxi owns decisions; coordinator-assigned delivery/assessment owners supply evidence.

- [#10](https://github.com/Maeximilion/MaexSocial/issues/10): operators/processors/regions/terms, payer and complete cost cap, eligible GBP account/project/grants/consent, field retention/correlation rights and actual publication/failure evidence.
- [#82](https://github.com/Maeximilion/MaexSocial/issues/82): real identity/device trust, patching/recovery/key/signing custody, update/lost-PC proof, privacy/deletion ownership and measured purge, safe restores meeting real accepted RPO/RTO, scoped assessment and fixes.
- [#88](https://github.com/Maeximilion/MaexSocial/issues/88): all five competitor/G1 gaps with independent evidence; product fixtures cannot close them.
- [#99](https://github.com/Maeximilion/MaexSocial/issues/99): concrete JPEG/media decision and revision-bound UPLOAD-01–10 evidence.

Native readback on 2026-11-06, before design closeout: **G3/#16 ← #10/#82; G5/#18 ← #88/#99/#10/#82; G4/#17 ← #99**. Keep each tracker open until its criteria have evidence. #88/#99 do not replace operating/assurance obligations.

## Recorded authorities and closeout

The owner separately recorded **local contract acceptance**, **bounded G2 acceptance** and **local synthetic implementation authority after merge** in the same explicit response. No repeated confirmation is needed. None permits real accounts, external tests, customer operation, deployment or external product spending.

The coordinator completes reviews/CI, merges #113, closes #8/#9/#30/#15 for the bounded scope and synchronizes Project/milestone state. Only then may the authorized owner create and verify annotated `gate-g2` on that exact main commit under the [gate procedure](../../../.claude/commands/gate.md). This record completes package H of the existing G2 work plan.
