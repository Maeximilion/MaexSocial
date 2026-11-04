# MaexSocial

AI-assisted local visibility, social account operations and creative production. The repository foundation is complete and G1 discovery is underway. Product capabilities in the roadmap are planned capabilities.

## Start

Read `AGENTS.md`, `docs/00_PCF.md`, `docs/01_STATUS.md`, `docs/07_WORKPACKAGES.md`, then the active task issue. Check `git status` and the current branch. Use `/start` in Claude Code or the matching repository skill in Codex.

## Working agreement

`AGENTS.md` is the shared rule source. This file adds Claude entry points. User instructions override repository guidance. Code-autopilot and caveman stay disabled. Do not copy their activation rules from Maex-Voice-Agent.

One focused branch and PR per task or coherent task group. PR titles use Conventional Commits. Include `Closes #N`, the actual verification commands and outstanding limitations. Keep open work committed and pushed. PR merge, deployment, paid provider calls and account publication follow the user's actual authorization and gate decisions.

## Gates

G0 establishes this repository and its workflow. G1 reconciles independent Codex and Claude REA evidence with official provider capabilities. G2 approves scope, architecture, data model and a testable implementation plan. G3 delivers one vertical slice. G4 adds media production. G5 validates bounded autonomy.

The product must eventually enforce tenant isolation, account authorization, publication idempotency, provider limits and per-tenant budgets. Generated claims must trace to approved business facts. A failed or uncertain publish must be reconciled before retrying. Define and test these contracts during G2 and G3.

## Commands

`/start`, `/task`, `/done`, `/gate`, `/handover`, `/project`, `/eval`, `/ship` live in `.claude/commands/`. These are procedural instructions, not installed security hooks. GitHub branch rules and checks provide technical enforcement where configured.

Run `python scripts/check_repo.py` and `python -m unittest discover -s tests` for the foundation. See `docs/16_GITHUB_PROJECT.md` for Project synchronization and credential setup.
