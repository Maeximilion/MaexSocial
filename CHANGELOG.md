# Changelog

## Unreleased

- Add staged-commit and full-history push secret hooks, shared credential/capture ignore rules and verified local Codex hook/CLI guidance.
- Run advisory Dependabot and security/quality checks only on explicit `/start` or `/task`. The periodic check is paused. Findings and repository Stop-hook warnings allow ordinary work to continue.
- Add the independent Claude Code SocialEdge report, evidence manifest and SE claim comparison with the Codex lane, plus a dated read-only authenticated runtime addendum.
- Fix the silent Claude PR review and close its runner-access paths: one job serves reviews and mentions, checks out only the default branch and passes PR metadata and the diff (GitHub API, bound to exact SHAs) plus the mention text (read from the event file) as nonce-framed untrusted prompt text, with JSON-escaped size limits and a final size check that keep the prompt within Linux environment limits. The model gets no file, shell, web, inline-comment or project-settings access (`--setting-sources user`, so no project hooks) and the subprocess env scrub stays on. A trusted step validates the structured result, publishes line findings as one PR review pinned to the reviewed head SHA and posts one summary comment: the result (marked incomplete when limits cut data), a documented skip when the run uses a different workflow revision from the default branch, or a visible failure.
- Add an advisory, SHA-pinned Claude Code PR review workflow for same-repository PRs (including drafts and Dependabot) and trusted `@claude` mentions, with edit, commit and push tools denied; it supplements and never replaces the required GPT-6 Astra high review. Dependabot bumps of `actions/checkout` or `claude-code-action` change this workflow file, so automatic reviews of those PRs get a documented skip comment instead of a review; `@claude` mentions in the PR conversation still run from the default branch.

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

