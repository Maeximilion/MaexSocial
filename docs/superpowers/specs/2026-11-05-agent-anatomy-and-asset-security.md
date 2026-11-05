# Agent anatomy and asset security

Status: authorized repository foundation work, issue [#42](https://github.com/Maeximilion/MaexSocial/issues/42). Product architecture remains a G2 proposal.

## Outcome and boundaries

Make the repository understandable and usable by both Codex and Claude Code. Keep shared workflows in one place, add real platform entry points and validate repository artwork. The owner's anatomy reference is inspiration; official platform documentation determines loading behavior. Do not vendor the third-party reference image, install arbitrary plugins, expand permissions, create empty application scaffolding or claim a deployed upload service exists.

## Design

- `AGENTS.md` remains the shared instruction source; Claude imports it explicitly. Existing slash commands remain canonical procedures. Complete Codex's thin command wrappers and add a focused repository-check skill on each platform.
- Add a bounded, read-only Claude evidence researcher and a Codex reviewer configured for `gpt-6-astra` / `high`. A configuration is not proof that an existing session loaded it. Claude must hand code review to the required Codex reviewer, not claim the same model through a Claude agent.
- Add scoped Claude research and application-security rules. Shared requirements live in documents referenced by `AGENTS.md`, so Codex receives the same obligations without pretending Claude rule files load there.
- Register a cheap Stop quality hook for Claude and Codex, sharing one script. Resolve paths independently of session subdirectories; accept only the expected JSON event, bound input and execution, and avoid infinite Stop loops. Run repository validation only; never rewrite files, send messages or claim hooks enforce a security boundary. Codex hook trust remains an explicit local runtime step.
- Add a small standard-library SVG policy to the existing repository check. Accept only the inert subset needed by current artwork; reject active content, foreign namespaces, external resources, entity declarations, unsupported compressed files and oversized/over-complex inputs. This is a repository policy, not an upload sanitizer.
- Organize architecture, security and tooling documentation into purposeful directories. Describe a proposed modular application layout and concrete trust boundaries; defer framework, runtime and deployment choices to G2.
- Define the future upload contract separately: initial customer SVG/SVGZ rejection, bounded true-format decoding, private quarantine, isolated media processing, tenant authorization, safe delivery and SSRF protection. Give this G2 design work a stable task and named acceptance cases.

## Acceptance

Current artwork passes unchanged. Previously accepted active SVG fixtures fail without being rendered. Hook tests cover valid events, invalid input, failure, timeout, subdirectories/paths with spaces and Stop recursion. Existing foundation checks remain green. Documentation distinguishes configured, locally tested and runtime-loaded behavior. An Astra high review and a focused PR precede integration; canonical main is synchronized afterward. Product gates remain open.
