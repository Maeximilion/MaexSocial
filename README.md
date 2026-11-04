<p align="center"><img src=".github/assets/banner.svg" alt="MaexSocial — local visibility, social operations and creative production" width="100%"></p>

[![Foundation CI](https://github.com/Maeximilion/MaexSocial/actions/workflows/ci.yml/badge.svg)](https://github.com/Maeximilion/MaexSocial/actions/workflows/ci.yml)
[![Project](https://img.shields.io/badge/Project-delivery_board-6ee7b7)](https://github.com/users/Maeximilion/projects/5)
[![Stage](https://img.shields.io/badge/Stage-discovery-163841)](docs/01_STATUS.md)

**MaexSocial brings local visibility, social account operations and creative production into one planned AI workflow.** A business supplies approved facts and images. The intended product prepares content, produces media, publishes through authorized integrations and measures results.

[Project board](https://github.com/users/Maeximilion/projects/5) · [Documentation](docs/README.md) · [Work packages](docs/07_WORKPACKAGES.md) · [Current status](docs/01_STATUS.md) · [Claude handover](docs/handovers/claude-rea.md)

## Current state

This repository contains the project foundation, research evidence and delivery workflow. The application is not implemented yet. Independent Codex and Claude Code REA investigations feed a synthesis and an approved product design before implementation.

The initial Codex investigation analyzed three public SocialEdge JavaScript bundles. Authenticated behavior, server implementation and end-to-end publication remain unverified. See the [report](docs/research/codex-rea.md) and [evidence summary](docs/research/evidence-codex.json).

## Planned product

<img src=".github/assets/flow.svg" alt="Planned flow from approved business facts to content and media, publishing and measured results" width="100%">

| Area | Intended outcome |
| --- | --- |
| Local visibility | Maintain business profiles, products, reviews and local presence |
| Social operations | Plan, create and publish channel-specific content |
| Creative studio | Turn approved images and briefs into campaign assets and video |
| Bounded autonomy | Operate within account permissions, budgets and explicit brand rules |

Provider availability and platform requirements are assessed in discovery. The architecture and production stack are decided at G2.

## Delivery gates

| Gate | Acceptance outcome |
| --- | --- |
| G0 Foundation | Repository, Project, tasks, checks and handovers verified |
| G1 Discovery | Independent findings reconciled with API evidence |
| G2 Design | Owner-approved scope, architecture and executable task plan |
| G3 MVP | One verified end-to-end publishing slice |
| G4 Creative | Tested image-to-video production with cost and quality evidence |
| G5 Autonomy | Controlled operation, monitoring and recovery demonstrated |

## Start contributing

Requires Git, Python 3.12 or newer and authenticated GitHub CLI for GitHub maintenance.

```sh
git clone https://github.com/Maeximilion/MaexSocial.git
cd MaexSocial
python scripts/check_repo.py
python -m unittest discover -s tests
```

Read [AGENTS.md](AGENTS.md), [CLAUDE.md](CLAUDE.md) and [CONTRIBUTING.md](CONTRIBUTING.md). Claude Code supports `/start`, `/task`, `/gate`, `/project` and `/handover`. Codex has matching repository skills for the shared start, project and handover procedures.

## Research handovers

- [Independent Claude Code REA assignment](docs/handovers/claude-rea.md)
- [Codex REA assignment and continuation](docs/handovers/codex-rea.md)
- [Evidence synthesis in a new chat](docs/handovers/synthesis.md)
- [Implementation after G2 approval](docs/handovers/build.md)

## GitHub operations

CI validates foundation files and tests. PR metadata checks require Conventional Commit titles and linked issues. The Project tracks Status, Gate, Priority and Iteration. Local board reconciliation uses `python scripts/project_sync.py`.

Account-level Project automation requires a dedicated `PROJECT_TOKEN` secret and `PROJECT_SYNC_ENABLED=true`. Until configured, local reconciliation is the available path. See [GitHub Project operations](docs/16_GITHUB_PROJECT.md).

## Assets and license

Original SVG assets live in [.github/assets](.github/assets). Asset source and usage rules are in the [README strategy](docs/15_README_STRATEGY.md). Research assets and customer media follow separate provenance and privacy rules.

Copyright 2026 Maeximilion. Publicly readable, proprietary. See [LICENSE](LICENSE) and [SECURITY.md](SECURITY.md).
