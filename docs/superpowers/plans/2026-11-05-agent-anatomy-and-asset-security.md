# Agent anatomy and asset security implementation plan

**Goal:** Deliver useful Claude/Codex anatomy and a tested artwork guard for issue #42.

**Architecture:** Preserve existing command procedures and foundation CI. Add thin platform definitions, one shared quality-hook script and one narrow SVG checker; document future product boundaries without implementing them.

**Tech stack:** Python standard library, JSON, TOML and Markdown; existing Node workflow tests unchanged.

**Spec:** [Design](../specs/2026-11-05-agent-anatomy-and-asset-security.md).

**Global constraints:** English repository, separate worktree/PR, no secrets or third-party bundles, no product implementation or gate acceptance, no global settings changes. Official loading rules override the reference graphic. Keep code-autopilot/caveman disabled.

**Review focus:** Active SVG bypasses, resource bounds, hook path/input handling, local-vs-runtime claims, least privilege and honest G2 status.

## Tasks

- [x] **1. Artwork policy — independent implementation.** Add `scripts/svg_policy.py` with `check_svg(path: Path) -> list[str]`. Integrate every case-insensitive `.svg` and `.svgz` path in `scripts/check_repo.py`. Add `tests/test_svg_policy.py`: first reproduce the accepted active SVG, then test current assets and rejected script/event/HTML/namespaced attribute/DTD/entity/PI/external/data/CSS-escape/malformed/oversized/complex/symlink inputs. Bound bytes before parsing and allow only supported local gradient/clip targets. Run targeted tests RED then GREEN. Preserve direct script and module/test imports.
- [x] **2. Quality hook — independent implementation.** Add `.claude/hooks/check_repository.py`, `.claude/settings.json`, `.codex/hooks.json` and `tests/test_repository_hook.py`. Read bounded JSON stdin; process Stop only; skip a repeated `stop_hook_active` event. Invoke the existing checker using an argument array with a timeout and fixed repository root. Return valid JSON only, with a bounded failure reason. Claude uses direct executable plus args; Codex uses separate POSIX/Windows commands resolving the Git root, not an unquoted interpolated path. Test actual commands from a subdirectory with spaces where available. Do not change trust or global settings. Test RED then GREEN.
- [x] **3. Agent entry points.** Import `@AGENTS.md`; complete five missing `.agents/skills/source-command-*/SKILL.md` wrappers; add repository-check skills in both supported paths, `.claude/agents/evidence-researcher.md`, `.codex/agents/reviewer.toml` and focused `.claude/rules/` files. Update local-settings ignores. Check TOML/JSON/frontmatter and exact workflow references. Extend the existing checker to validate newly introduced TOML syntax, with a regression test.
- [x] **4. Documentation and task mapping.** Create `docs/architecture/README.md`, `docs/security/uploads.md`, `docs/tooling/agent-workflow.md`. Create MS-014 at G2 for upload design. Cross-link charter/work packages/evaluations/access/media/status/README/docs index and existing architecture summary. Describe plugin/MCP loading accurately without dummy directories. Preserve pending Claude REA and G2 decisions.
- **5. Verify and deliver — acceptance tracked in #42 and its linked PR.** Run `python scripts/check_repo.py`, `python -m unittest discover -s tests -v`, `node --test tests/*.test.cjs`; inspect final diff and get fresh GPT-6 Astra high review. Commit/push, open linked PR, fetch, wait for exact-head checks, merge within existing authorization and pull clean canonical main. Record actual evidence and hook-activation limits; close only foundation #42, not MS-014 or any product gate.

Parallel work is limited to tasks 1 and 2 with disjoint owned files; the coordinator owns all other files and integration.
