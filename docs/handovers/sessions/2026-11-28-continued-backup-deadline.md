# Handover 2026-11-28 — MS-009 / #307

## Status

At 12:50 UTC the integrated physical drill and independent control restore passed on work head
`09a1ebaa39431bcf89a7bca4c2682c12fe3fb15a`. The [task](https://github.com/Maeximilion/MaexSocial/issues/307)
branch is `dev-codex/307-continued-backup-deadline`, based on integrated
`dd17b43292160d73d417ce7204f7af03f1df6954`. Initial work used the corrected #308 evidence
branch before #305 integrated. The shipping tree includes #305's migration and IdP compatibility entries.
Codex GPT-6.2 Astra High implemented the change. At this pre-publication checkpoint the PR,
Claude API result and candidate CI were pending. The delivery PR carries their revision-specific evidence.

## Artifacts

The [drill](../../../ops/local/README.md#restore-before-dispatch-and-terminal-export-258) seeded
two A revisions and two B controls. The first offline import exposed 2/2 before replay.
The continued source and the later offline import returned 0/2 after committed source erasure.
Both B rows compared equal to the original controls. The original and first continued AppDB
archives contained the unique synthetic A marker. Both corresponding IdP archives were negative.
Each offline target held dispatch, denied application login and used two internal networks with
zero published ports.

Both PostgreSQL system identifiers matched across all three pairs and differed between databases.
The following are SHA-256 prefixes of the authenticated ciphertexts. Capture times are UTC on November 28.

| Pair | Format | Actual capture | AppDB | IdP |
| --- | --- | --- | --- | --- |
| Fresh disposable | 3 | 12:46:27.382 | `8f0473df3b25` | `a5697b67bff7` |
| First continued | 4 | 12:47:27.047 | `30f0ff2db4bc` | `9e867b5c8c67` |
| Second continued | 4 | 12:47:30.599 | `ee1207a7e95a` | `7d3bbf3286d4` |

The host bracketed the purge commit between **12:47:06.624 and 12:47:08.656 UTC**.
All three manifests identified the original capture as their retention start. The cutoff was
**2026-12-28T12:46:27.382Z**, between 39,242 and 41,274 ms before purge + 30 days.
The child processes used controlled times for admission and expiry. The host clock stayed intact.

| Controlled instant | Observed result |
| --- | --- |
| Cutoff − 1 ms | All three pairs verified and refused explicit expiry. |
| Cutoff, cutoff + 1 ms and both purge-window endpoints + 30 days | All three pairs refused verification and restore before creating a target directory. |
| Cutoff reached after writing the pending manifest | The attempted recapture refused publication and cleaned its pending directory. |
| Explicit expiry at cutoff | Each owned pair went from two ciphertext files to zero. The manifest and its authentication tag remained byte-identical. |
| Repeat at cutoff + 1 ms | No further files removed. The format-4 unit case also retried successfully with one archive already absent. |

The exact reader built at `dd17b432` verified the fresh pair and refused the intact format-4
pair during format validation. A new independent fixture captured at 12:50:01.946 UTC had a
different fixture ID and two different PostgreSQL system identifiers. At the latest possible
purge deadline, 2026-12-28T12:47:08.656Z, it verified, refused premature expiry and restored
both databases offline with three quarantined occurrences. All five successful-run source and
target projects were brought down.

## Decisions

Fresh format-3 disposable captures authenticate their own timestamp as the retention start.
Continued captures use format 4 so old readers cannot accept them with a fresh 30-day lifetime.
The writer verifies the parent, original journal and both cluster identities before publishing.
Verification, restore admission, publication and explicit expiry share the deadline calculation.
Existing formats 1/2/3 retain their documented read behavior. Older format-3 archives without
the new lineage evidence cannot seed a recapture. Existing artifacts were never rewritten.

## Gate

The bounded disposable path corrects the [measured #302 gap](2026-11-28-last-copy-expiry.md).
Refusal takes effect in the reader. Physical file removal requires executing the expiry command.
Production custody, historical and protected copies, provider vaults and an operating expiry
schedule remain open under [#166](https://github.com/Maeximilion/MaexSocial/issues/166)
and [#82](https://github.com/Maeximilion/MaexSocial/issues/82). G3 remains open.

## Open

Main owns the expected-head merge after the current API result, candidate CI, review threads
and metadata have been verified. Resume in PowerShell with
`Set-Location "$env:USERPROFILE/.codex/worktrees/issue-307-continued-backup-deadline/MaexSocial"; git status --short --branch`.
First instruction: verify the PR head, base, checks and handover before integration.

## Lessons

Node 24.22.2 / npm 11.19.1 built the three checkouts from the offline cache. The six targeted
cold-backup and paired-restore tests passed. Foundation validation passed (repository checker,
20 Node tests and 134 Python tests with 32 skips). The first unit run still used format 4
as its unknown-format input. It failed as expected for a now-supported format and passed with
format 5 as the unknown case.

On the initial integrated physical attempt, creation of the third simultaneous fixture failed.
A repeat using only the three owned projects confirmed Docker's default subnet pools were
exhausted. The drill now releases its source networks after the last capture. The fresh
end-to-end run above succeeded without host configuration changes or operations on other projects.
