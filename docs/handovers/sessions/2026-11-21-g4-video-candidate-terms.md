# Handover 2026-11-21 — #191

## Status

Stopped at (UTC) — 2026-11-21T18:17:02Z for the pre-PR checkpoint. Codex completed the dated public-source comparison, decision link and local verification. `git diff --cached --check` and `python scripts/check_repo.py` passed. Python foundation initially failed because its temporary Git subprocess inherited `GIT_CONFIG_COUNT` without a matching value. `if (Test-Path Env:GIT_CONFIG_COUNT) { Remove-Item Env:GIT_CONFIG_COUNT }; python -m unittest discover -s tests` passed with 123 tests recorded, including 32 skips. `node --test tests/*.test.cjs` passed 20/20. A local Python decimal check verified the rates, calculated totals, Runway credit equivalent and decision link after fixing an assertion that expected the USD currency prefix twice in the same range. No product API was used.

Codex prepared the comparison. The repository's Claude API review and hosted CI are pending first PR publication. The configured review policy calls for Claude Opus 5.5, high effort, standard speed and `standard_only`; actual run, settings, reviewed head, base and result will be verified on the delivery PR.

## Artifacts

- Repository — [Maeximilion/MaexSocial](https://github.com/Maeximilion/MaexSocial)
- Task — [#191](https://github.com/Maeximilion/MaexSocial/issues/191)
- Branch — `dev-codex/191-media-candidate-terms`
- Work head before the handover commit — `69787ce30fcbd315f90c0a4ddcd9879b7c488381`
- PR — awaiting the coordinator's publication window.
- [Dated comparison](../../research/2026-11-21-g4-video-candidate-terms.md) and [media decision link](../../18_MEDIA_LIBRARY.md#decisions-for-later-media-and-operation).

## Decisions

Propose Runway Dev Gen-4.5 for one separately authorized operator-only trial with a five-second, 720p rights-cleared synthetic JPEG fixture and a proposed generation cap of 60 API credits (USD 0.60 at the observed list price). Runway documents inline JPEG, exact output dimensions and H.264 MP4. Higgsfield lists a lower price range, with the exact silent-job quote, output dimensions, access/revocation details and upstream data handling unresolved. Use the evidence as a decision input for #167.

## Gate

[#167](https://github.com/Maeximilion/MaexSocial/issues/167) authorizes the preparatory scope. [#16](https://github.com/Maeximilion/MaexSocial/issues/16) acceptance and a dated owner decision on permitted synthetic data, terms, budget and trial scope precede [#11](https://github.com/Maeximilion/MaexSocial/issues/11) execution. [#99](https://github.com/Maeximilion/MaexSocial/issues/99) retains formats and upload assurance. [#190](https://github.com/Maeximilion/MaexSocial/issues/190) supplies independent offline evaluation evidence. Account access, effective charges, rendering, retention and private capture behavior await the authorized trial.

## Open

Coordinate normal PR publication after the already queued #190 and #187 deliveries, or use a verified native stack when the coordinator determines that it is available and appropriate. After publication, attach the PR to its originating chat and capture actual current-head/base Claude API and integration CI evidence. The coordinator owns merge, canonical checkout synchronization and verified archival.

- Console — PowerShell in the assigned `dev-codex/191-media-candidate-terms` worktree. The native chat and private coordinator ledger identify its exact local folder.
- Start command — `git fetch origin --prune; git status --short --branch; git rev-parse HEAD; python scripts/check_repo.py` from that worktree.
- First message — Continue issue #191 from this handover. Verify the branch, current publication order and any open delivery PRs, then publish and verify review and CI in the agreed window.

## Lessons

Higgsfield's public list changed since G1. For both providers keep an expiring delivery URL, provider-side deletion, and approved private application storage distinct. Graphify indexed `4f36d6fad83c236640b8fdd62d7eb1d772900423` with 613 nodes and returned no Higgsfield match, so the comparison checked the local G1 documents at base `bf879e69193be6ea1f10fe27ede482d47e2904b2`. Code Autopilot and Caveman remain enabled. Advisory repository checks remain reserved for an explicit `/start` or `/task`.
