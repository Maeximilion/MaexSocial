# Handover 2026-11-04 — MS-008 to MS-010, product design and first build

Status — Future session. The [research synthesis](../research/synthesis.md) is complete. [Maxi’s G1 decision](https://github.com/Maeximilion/MaexSocial/issues/14#issuecomment-6661937363) authorizes G2 planning with Superpowers. The five open items in [#88](https://github.com/Maeximilion/MaexSocial/issues/88) block G5 and must be verified earlier where a decision relies on them. Product implementation requires approved G2 design and the MS-009 plan.

Artifacts — Repository `Maeximilion/MaexSocial`, [synthesis handover](synthesis.md), [charter](../00_PCF.md), [architecture questions](../02_ARCHITECTURE.md), [work packages](../07_WORKPACKAGES.md). Create a task branch after checking current main and open work.

Decisions — Reuse the established repository process and [TypeScript strict language baseline](../decisions/0001-application-language.md). Choose frameworks, runtime validation, storage and deployment from the first approved slice. Existing Python maintenance tooling stays. All code reviews use `gpt-6-astra` with reasoning `high`, verified in the actual review session.

Gate — MS-008 approves design, MS-009 supplies a concrete implementation plan, MS-010 implements and proves G3.

Visual direction — Use Maxi's selected [Deep Tech dark palette](../15_README_STRATEGY.md): primary `#00E5FF`, accent `#FF5E5B`, base `#0B0F19`, surface `#161F30`, text `#F8FAFC`. Follow its contrast rules, including Midnight text on filled accents. The palette is settled; component layout, interaction states and accessibility tests remain G2/G3 work.

Access prerequisite — Include MS-013 and [registration/customer/admin security requirements](../17_ACCESS_SECURITY.md) in G2. Map accepted ACCESS-01–14 cases into the executable plan, alongside [CI/CD and release checks](../08_EVALS.md). A foundation CI pass does not authorize externally accessible customer operation.

Upload prerequisite — Include [MS-014 / #43](https://github.com/Maeximilion/MaexSocial/issues/43) and [UPLOAD-01–10](../security/uploads.md). The initial proposal rejects customer SVG/SVGZ, requires private quarantine and isolates decoding/transcoding. Review the [proposed code anatomy](../architecture/README.md) and [agent tooling](../tooling/agent-workflow.md); neither a folder layout nor a repository SVG check proves these runtime boundaries.

Open — Obtain G2 design approval and complete MS-009 before application scaffolding.

Lessons — Foundation checks establish repository health. Live API capability, content quality and autonomous publication each need their own proof. Code Autopilot and Caveman are explicitly enabled; preserve the [development skill roles and activation limits](../tooling/development-skills.md).

## Required plan

Include the requested [customer media library, calendar and optional advertising](../18_MEDIA_LIBRARY.md) in scope selection. Its provider evidence and MEDIA/PLAN/ADS cases are G2 inputs, not completed integrations or authorization to spend. Select one verified provider/channel path first; keep customer upload, generation, organic publication and paid-ad activation authority distinct.

Keep `C:/Users/Maxi/Documents/GitHub/MaexSocial` on clean `main`. Application changes and tests under `tests/` belong in a separate task worktree following [playbooks](../12_CLAUDE_CODE_PLAYBOOKS.md). After merge and regularly, require an empty canonical working tree, then `git fetch --prune origin` and `git pull --ff-only origin main`. Never pull with dirty files.

Use Superpowers brainstorming to settle first customer/channel, user journey, account authority, scope, provider access, cost and deployment choices. Record alternatives and rationale in a product design. Obtain G2 approval. Then use writing-plans to specify files, interfaces, schemas, tests, migration/rollback behavior and independently verifiable tasks.

The first slice must exercise real business flow with synthetic data and authorized test accounts. Include revoked tokens, cross-tenant requests, edited approvals, duplicate submissions, ambiguous provider timeouts and stop behavior. Add media generation after the publication slice is proved. Autonomous operation follows explicit policy and a supervised pilot.

## Start prompt for the build chat

Begin MaexSocial design/build from the current repository state. Read root instructions, docs/01_STATUS.md, docs/research/synthesis.md and the approved product design if present. Work through MS-008 and MS-009 with Superpowers before MS-010. Verify actual G2 approval and available provider access. Implement the approved first slice through normal entry points, run its acceptance checks and obtain gpt-6-astra high review on the current head. Use the enabled Code Autopilot/Caveman skills under the current repository rules.
