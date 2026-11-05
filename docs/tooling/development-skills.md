# Development skill roles

Owner decision, 2026-11-05; [maintenance issue #56](https://github.com/Maeximilion/MaexSocial/issues/56). These are development tools, not product architecture or merge approval.

| Work | Primary skill | Boundary |
|---|---|---|
| Coding work generally | Code Autopilot | Evidence-driven progress, useful checks and concise delivery; host/project rules override imported defaults |
| Replies | Caveman, readable lite default | Preserve technical substance, uncertainty and clear instructions; code, commits and PR prose remain normal |
| Small/medium implementation and fixes | Ponytail | Smallest complete change; reuse existing code; run relevant tests |
| Code review | Ponytail review | Correctness/security/test coverage before simplification; actual GPT-6 Astra with reasoning high |
| Requested repository audit | Ponytail audit | Stay within the requested repository and action scope |
| Larger coupled changes, design and implementation plans | Superpowers | Relevant discovery/design/planning/execution/TDD/debugging skills; do not load the entire library |

Use one primary workflow for a task. Code Autopilot supplies execution discipline, Caveman reply style; they do not launch competing workflows. Ponytail's small-change principles still apply within a large Superpowers plan. When a task grows materially, explain the change and use the appropriate planning depth. Save tokens through focused reads, small diffs, reuse and avoiding duplicate investigations; never trade away security, verification or clarity. No fixed savings percentage is claimed.

## Native project integration

Codex: `.codex/config.toml` enables the installed `superpowers@openai-curated-remote` and `ponytail@ponytail` packages. The repository `.agents/skills/development-workflow` entrypoint points here. Install the packages through Codex's plugin interface on a new machine. For Ponytail, first run `codex plugin marketplace add DietrichGebert/ponytail`, then `codex plugin add ponytail@ponytail`; configuration alone does not download them or establish project trust. [Codex skills](https://learn.chatgpt.com/docs/build-skills), [Superpowers installation](https://github.com/obra/superpowers#installation).

Claude Code: `.claude/settings.json` declares project enablement and marketplace sources for `superpowers@claude-plugins-official` and `ponytail@ponytail`; `.claude/skills/development-workflow` points here. These use the native plugin loader, not a fake `.claude/plugins` folder. For a new clone, trust the project normally and install the declared plugins:

```text
claude plugin install superpowers@claude-plugins-official --scope project
claude plugin install ponytail@ponytail --scope project
claude plugin list --json
```

[Claude plugin installation and scopes](https://code.claude.com/docs/en/plugins/install). The declared Ponytail marketplace uses the v5.3.3 tag. The inspected official catalog selected Superpowers commit `bb92a77741419a4ab5f06e711a283343f1ada0c3`. Review plugin sources and executable hooks before updating. Both hosted Claude review jobs pass `--setting-sources user` so project plugin and hook settings apply to local development only.

## Local Code Autopilot and Caveman

The owner-authorized canonical copies live in the user's `.agents/skills/code-autopilot` and `.agents/skills/caveman` directories. Codex enables automatic invocation for those copies; older synchronized and plugin duplicates remain disabled. Claude's user skill directories point to the same canonical sources. User instructions request their persistent use; they are not background processes.

Code Autopilot originated in Claude Code. Its local Codex adaptation requires discovering available tools instead of assuming Claude-only slash commands, preserves the selected project stack, and treats imported iteration caps as scope guidance rather than arbitrary interruptions of authorized work. Host response rules, actual authorization, the model-routing pause and Astra-high reviews take precedence. Caveman defaults to concise readable sentences rather than losing necessary information.

Enabling a skill does not authorize extra agents, new chats, external messages, merges, deployments or spending. Use normal PRs; drafts require an explicit request. Product design still requires G2 acceptance. Real secret guards and required CI stay in force.

## Explicit advisory checks

Run the GitHub security/quality/Dependabot advisory check only when the user explicitly invokes `/start` or `/task`, or their named Codex skill equivalents. Their Codex skill metadata disables implicit invocation, and their Claude command frontmatter sets `disable-model-invocation: true`. Generic coding requests, session startup, resumption, notifications and this skill do not trigger it. The previous 15-minute automation is paused; do not recreate a timer. See [local security operations](../19_LOCAL_SECURITY.md). Report findings or unavailable access, then continue the task.

## Verification boundary

Separate saved configuration, native catalog discovery, script tests and observed model behavior. Existing sessions may retain old instructions; reload the client/session if discovery does not refresh. Do not claim automatic use in every client or a live workflow run from an installation result alone. Backups and targeted rollback are kept in the owner's local change register, outside this public repository.

Observed on 2026-11-05: Codex's native `skills/list` reports one enabled canonical copy each of Code Autopilot and Caveman, disabled synchronized duplicates, the repository workflow entrypoint, Ponytail 5.3.3 and Superpowers 7.0.1 skills. Claude's plugin list reports project-enabled Superpowers 7.0.0 and Ponytail 5.3.3; its user skill junctions resolve to the same canonical sources. Router AST comparison permits only two updated status strings; seven isolated event/state comparisons preserve routing and pause behavior. The optional skill-creator validator could not run because local Python lacks PyYAML; native skill parsing/discovery succeeded. No new model session was launched to claim automatic behavior across all clients.
