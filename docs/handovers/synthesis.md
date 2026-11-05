# Handover 2026-11-05 — MS-007, research synthesis

Status — G0 complete, G1 ongoing. Codex's bounded static report exists. Claude's independent report, full API feasibility and remaining discovery work are pending.

Artifacts — [Issue #7](https://github.com/Maeximilion/MaexSocial/issues/7), repository `Maeximilion/MaexSocial`, canonical checkout `C:/Users/Maxi/Documents/GitHub/MaexSocial`, `docs/research/`, [work packages](../07_WORKPACKAGES.md), [charter](../00_PCF.md) and [status](../01_STATUS.md).

Decisions — MaexSocial is the product name. SocialEdge supplies a comparison baseline. Intended capabilities include local visibility, account care, publication, media editing and image-to-ad creation. [ADR 0001](../decisions/0001-application-language.md) chooses TypeScript strict under Maxi's delegated technology choice. Frameworks, hosting and paid providers remain G2 decisions.

Gate — G1 closes with reconciled evidence and explicitly accepted coverage limits. G2 requires Maxi's product design approval.

Open — Verify actual completion of MS-002–006 before claiming a complete synthesis.

Lessons — Source claims, static observations and runtime behavior establish different facts. Claude contributes its own observations before comparing Codex's report. Code-autopilot and caveman remain disabled, with code-autopilot's GPT/Codex compatibility unverified.

## Working directory and inputs

Keep the canonical folder on clean `main`. Use branch `docs/MS-007-synthesis` in a separate worktree following [playbooks](../12_CLAUDE_CODE_PLAYBOOKS.md). Fetch with pruning at session start and after PR updates. After merge, pull only the clean canonical checkout with `--ff-only`.

Read `docs/research/codex-rea.md`, `docs/research/evidence-codex.json`, the independent Claude report and manifest when delivered, and completed public-inventory/API/demo research. A missing input remains an explicit dependency. Preserve both REA reports and their evidence identifiers.

## Synthesis procedure

Treat the [owner-requested media-library/calendar/advertising proposal](../18_MEDIA_LIBRARY.md) as a separate MaexSocial requirement. Compare its feasibility with official provider evidence without converting the user's description of SocialEdge's library into an independently observed claim. Preserve both REA reports; provider selection and paid operating scope remain G2 decisions.

1. Reuse stable `SE-NNN` claim IDs from Claude's comparison. Add atomic claims with new IDs when necessary. Keep a matrix with exact claim, Codex evidence, independent Claude evidence, result, source dates/scope and unknowns/next check. Results are `confirm`, `contradict`, `extend` or `unverifiable` as defined in [Claude's brief](claude-rea.md).
2. Check whether conflicts arise from target version, date, account tier or scenario coverage. Resolve a contradiction only with new evidence or a documented scope distinction. Preserve unresolved disagreements.
3. Map capabilities to official API/MCP feasibility, permissions, app review, human work, costs and restrictions. Separate actual source observations from proposed MaexSocial behavior.
4. Summarize video-demo candidates and identification confidence. The original video may remain unidentified without establishing a provider choice.
5. Recommend one complete first slice, follow-on stages and concrete G2 decisions. Reimplement from the resulting requirements with original code and design. Do not import proprietary bundles, wholesale UI designs or assets.
6. Write `docs/research/synthesis.md` with the capability matrix, disagreement ledger, evidence gaps and a separate product proposal. Update status, work packages and issue #7, then open a focused PR.

If a material gap needs authenticated runtime access or an action outside the established scope, stop that check and ask Maxi for precise access and action permission. Keep the gap visible while completing other authorized work. MS-008–012 become implementation-ready only after their detailed design and planning gates are met.

## Start prompt for the new chat

Work on MaexSocial MS-007 using docs/handovers/synthesis.md. Verify that both independent REA reports and required G1 inputs exist, then reconcile them with their manifests and official API sources. Preserve both lanes and use claim IDs with confirm/contradict/extend/unverifiable outcomes, source dates, scope and unknowns. Produce the evidence matrix and disagreement ledger separately from a proposed MaexSocial first slice. Keep missing access explicit and prepare G2 decisions with Superpowers before product implementation.
