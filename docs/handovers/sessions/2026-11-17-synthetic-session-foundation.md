# Handover 2026-11-17 - MS-010 Task 2A1

## Status

Checkpoint (UTC): 2026-11-17T15:04:44Z. A1 implemented and locally tested; PR/CI/Claude API review pending full-input readiness. Codex implementation; model setting not independently reverified at this checkpoint. No reviewer substitute or new IdP credential probe ran.

At work head below: strict build passed; fresh migration up/down/up and unknown-object rollback guard passed; targeted session/HTTP/storage tests passed; full pilot suite 12/12 including the actual isolated keyboard browser and both switch/removal barrier subtests. Python foundation: 121 tests, one Windows colon-filename skip, with the configured Gitleaks executable. Node foundation: 20/20. Repository links/JSON/TOML/SVG and diff whitespace passed. These are synthetic subchecks, not integrated ACCESS acceptance.

## Artifacts

- Repository: [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial).
- Task: [#117](https://github.com/Maeximilion/MaexSocial/issues/117); branch `dev-codex/117-customer-activation`.
- Work head before handover commit: `be9ba201a3a013d337b77e4e7a5f7ac5606771d4`, pushed; integrated base `c7f19e4d02f64bafcc97e0fd6f80e714c711332b`.
- PR: not yet opened. Current complete diff exceeds the 120,000 escaped-byte review limit; root has the measurements and owns disposition. No paid/partial review attempted.
- Fresh fixture: `maex-pilot-a1d5ba468eb48a0f0339391c53676c16`; core services running, browser worker removed. Screenshot `work/portal-preview/dashboard.png` visually checked. Prior fixture/build archived under ignored `work/`; volumes preserved. Source checkpoint `work/task-2a2-checkpoint-20261117/source.zip` SHA-256 `2caecc2e31e5d2db643869914b564d95a52f09033ead051a065ad2c0b58e8c59` preserves pushed `02784466b2f74ff1dbedbcdcec26a51f823aec4a`.
- Shared API/ownership: [A1/A2/B/C plan](../../superpowers/plans/2026-11-06-task-2-deliveries.md), [evidence map](../../superpowers/plans/2026-11-05-ms-009-pilot-evidence-map.md), [request binding](../../../apps/web/src/server/request.ts), [session authority](../../../apps/web/src/server/session.ts), [fixture commands](../../../ops/local/README.md).
- Historical intermediate handovers, retained unchanged in pushed history and byte-verified against the private ZIP: [November 6 prerequisite](https://github.com/Maeximilion/MaexSocial/blob/02784466b2f74ff1dbedbcdcec26a51f823aec4a/docs/handovers/sessions/2026-11-06-customer-activation-prerequisite.md), [November 17 access checkpoint](https://github.com/Maeximilion/MaexSocial/blob/02784466b2f74ff1dbedbcdcec26a51f823aec4a/docs/handovers/sessions/2026-11-17-customer-access-checkpoint.md), [portal checkpoint](https://github.com/Maeximilion/MaexSocial/blob/02784466b2f74ff1dbedbcdcec26a51f823aec4a/docs/handovers/sessions/2026-11-17-portal-foundation-checkpoint.md). Root authorized consolidating these branch-only notes. The previously rejected combined cleanup command was not repeated: both the old fixture and compiled directory were moved into ignored archives, whose presence and retained prototypes were verified; no recursive deletion occurred.

## Decisions

Root narrowed #117 to synthetic session/tenant/CSRF/dashboard. Only test harnesses seed authority/sessions; public auth and fixture-token issuance remain unavailable. MFA/IdP inspection is a test double. Local logout revokes only the opaque app session. Removed executable lifecycle/completion/throttle prototypes and their unused dependencies; [#131](https://github.com/Maeximilion/MaexSocial/issues/131) retains all real auth, completion, recovery, MFA, fencing and throttling obligations. No stable generation/completion contract is claimed.

Caller-owned transaction and sorted identity -> sorted tenant -> membership -> session -> domain lock order remain mandatory. Revalidate preliminary bindings; use the resolved tenant for domain queries. Root decides downstream contract readiness and owns merges.

## Gate

[Owner G2/local acceptance](https://github.com/Maeximilion/MaexSocial/issues/15#issuecomment-6681723454) remains bounded. Task 2 requires #117 + #131 + #123 + #124 and integrated evidence; Task 3 waits. G3/G5 remain blocked; no deployment or real account authority.

## Open

Resolve complete review-input readiness with root; then create one normal PR closing #117, attach immediately, verify current-head integration CI and authentic complete Claude API review. Record results and report to root before handover/merge.

PowerShell start (from this worktree; preserve old fixture before renewal if expired):

```powershell
Set-Location 'C:/Users/Maxi/.codex/worktrees/117-customer-activation/MaexSocial'
$env:PATH='C:/Users/Maxi/.codex/worktrees/114-local-pilot-storage/MaexSocial/work/runtime/node-v24.22.2-win-x64;'+$env:PATH
git status --short --branch
git fetch origin --prune
npm.cmd run pilot:build
```

First message: Continue #117 A1 from this handover. Verify root's input-limit disposition, preserve #131 and the safety boundary, and deliver the complete candidate through its normal PR/API review. No merge authority.

## Lessons

The obsolete-schema exclusion test failed on the preserved old fixture and passed on the fresh final schema. The previous identity-invalidation second-order test needed its tenant version restored for a valid control; now it isolates identity invalidation. Compiler output was archived before rebuilding so deleted prototypes cannot remain in test discovery. Code Autopilot/Caveman remain enabled; no extra agent review. Do not repeat, rephrase or delegate the [blocked credential race](https://github.com/Maeximilion/MaexSocial/issues/117#issuecomment-6950555219).
