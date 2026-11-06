@AGENTS.md

# MaexSocial

AI-assisted local visibility, social account operations and creative production. The repository foundation is complete and G1 discovery is accepted within its recorded limits. G2 design planning is authorized. Product capabilities in the roadmap are planned capabilities.

## Start

Read `AGENTS.md`, `docs/00_PCF.md`, `docs/01_STATUS.md`, `docs/07_WORKPACKAGES.md`, then the active task issue. Check `git status` and the current branch. Execute `/start` or `/task` and their matching Codex skills only when explicitly requested; opening a session does not invoke them.

## Working agreement

`AGENTS.md` is the shared rule source. This file adds Claude entry points. User instructions override repository guidance. Code Autopilot and Caveman are explicitly enabled; use the [development skill roles](docs/tooling/development-skills.md) and preserve this repository's permissions and gates.

One focused branch and PR per task or coherent task group. PR titles use Conventional Commits. Include `Closes #N`, the actual verification commands and outstanding limitations. Keep open work committed and pushed. PR merge, deployment, paid provider calls and account publication follow the user's actual authorization and gate decisions.

## Gates

G0 establishes this repository and its workflow. G1 reconciles independent Codex and Claude REA evidence with official provider capabilities. G2 approves scope, architecture, data model and a testable implementation plan. G3 delivers one vertical slice. G4 adds media production. G5 validates bounded autonomy.

The product must eventually enforce tenant isolation, account authorization, publication idempotency, provider limits and per-tenant budgets. Generated claims must trace to approved business facts. A failed or uncertain publish must be reconciled before retrying. Define and test these contracts during G2 and G3.

## Commands

Codex is the primary programmer here. Manual Codex command skills use the same procedures as Claude Code in [the commands directory](.claude/commands/). Request `source-command-anatomy` in Codex or `/anatomy` in Claude Code for a read-only repository check. These are procedural instructions, not installed security hooks. GitHub branch rules and checks provide technical enforcement where configured.

Run `python scripts/check_repo.py`, `python -m unittest discover -s tests` and `node --test tests/*.test.cjs` for the foundation. See `docs/16_GITHUB_PROJECT.md` for Project synchronization and credential setup. G2 access and upload design must cover MS-013 and MS-014.

## Platform entry points

See `docs/tooling/agent-workflow.md` for skills, the read-only evidence researcher, scoped rules and the registered Stop hook. The hook checks links, JSON/TOML and repository SVG policy; it does not run the full test suite or establish upload security. Code reviews must use the configured Codex Astra reviewer with the actual model/effort verified; a Claude agent cannot substitute for it.
