# Changelog

## Unreleased

- Fix the silent Claude PR review: drop the subprocess environment scrub, which removed `GH_TOKEN` from `gh pr diff/view`; post the summary from a workflow step, remove Claude's `gh pr comment` and deny reads of `/proc`, `.git`, `~/.claude` and token-printing shell commands to reduce (not eliminate) the risk that review text carries runner secrets.
- Add an advisory, SHA-pinned Claude Code PR review workflow for same-repository PRs (including drafts and Dependabot) and trusted `@claude` mentions, with edit, commit and push tools denied; it supplements and never replaces the required GPT-6 Astra high review. Dependabot bumps of `actions/checkout` or `claude-code-action` change this workflow file, so the action skips review there (workflow validation) while the job still reports success.

- Add platform-native Claude/Codex skills, bounded agent roles, scoped rules and registered Stop checks; document loading/trust and plugin/MCP boundaries.
- Guard repository SVG artwork with bounded allowlist validation and hostile-input regressions; record the separate MS-014 customer-upload security contract and proposed application anatomy.

- Adopt Maxi's Deep Tech dark palette across brand artwork and README badges; document accessible color pairings for the future application.
- Record customer-owned media uploads, AI creative production, calendar/recurrence and separately authorized advertising as G2 inputs, with bounded provider evidence and proposed acceptance cases.

- Add named Overview and Delivery board Project views, with status columns and planning fields.
- Extend automatic PR metadata and dedicated dependency-task Development links while preserving manual planning choices.
- Choose TypeScript strict as the application-language baseline under delegated technology selection; retain G2 design and REA sequencing.

- Distinguish authenticated first-party Dependabot maintenance tasks in PR metadata, with nine workflow regression cases.
- Enable repository security scanning and document staged CI/CD and application test requirements.
- Record public customer registration/login, separate platform administration and tenant-isolation acceptance cases for G2.

- Establish MaexSocial branding, project documentation, gated delivery and agent instructions.
- Add GitHub issue and pull request templates, CI and Project synchronization tooling.
- Record initial public-source Codex REA findings and prepare the independent Claude Code handover.
- Verify hosted Project synchronization with narrowly scoped API calls, pagination and nine regression tests.
- Refresh the README with an original blue/red identity, logo, hero, workflow diagram and social-preview artwork.
- Require independent Claude evidence before claim-level comparison with Codex; clarify planning maturity and canonical checkout paths.

This is a project foundation. There is no released application version yet.

