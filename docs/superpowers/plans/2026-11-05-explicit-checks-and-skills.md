# Explicit Checks and Skill Roles Implementation Plan

> Execute in this session using the existing worktree; use Superpowers executing-plans. Keep one independent Astra-high review at the end.

**Goal:** Check security/dependency reminders only on `/start` or `/task`, and activate complementary development skills under the owner's explicit request.

**Architecture:** Keep native skills/plugins installed locally. Track project plugin declarations and one shared workflow guide; do not copy plugin caches into Git. Keep the existing advisory checker and actual secret-protection controls separate.

**Spec:** Owner request on 2026-11-05: remove 15-minute polling, enable Code Autopilot and Caveman persistently, use Ponytail for reviews/audits/small-to-medium tasks and Superpowers for larger plans. This is tooling configuration, not product design or G2 acceptance.

**Approach:** Reuse the existing native plugin mechanisms and local skills. Vendoring entire plugin trees would duplicate updates and consume unnecessary context. A prose-only activation claim would not establish discovery; verify the native catalogs and saved configuration.

## Constraints and review focus

- No implicit security polling on session start, work-package changes, resumption or notifications.
- Preserve model-routing logic and its explicit decision pause; update only obsolete skill-status wording.
- Keep a single active Code Autopilot/Caveman copy; leave synchronized duplicates disabled.
- Keep Astra high for reviews, normal PRs, required tests and secret guards. Skills grant no new merge/deployment/delegation authority.
- Skills and plugins load through each client's own mechanism. Report live-session gaps honestly.

## Tasks

- [x] Back up and pause the local heartbeat; replace triggering policy in AGENTS, start/task commands and local security operations.
- [x] Back up local skill metadata, user instructions, router and configuration. Enable canonical skills with Codex compatibility notes; update obsolete reminders without changing routing behavior.
- [x] Register Ponytail/Superpowers in project configuration, install the missing Claude plugin, and add a shared workflow guide with thin platform skill entrypoints.
- [x] Verify automation/config readback, native skill/plugin discovery, router behavior equivalence, repository checks and tests.
- [x] Run an independent Astra-high review, commit/push, and create a normal PR linked to the issue. Record rollback and current activation boundaries.

Delivery: [PR #59](https://github.com/Maeximilion/MaexSocial/pull/59), a normal PR stacked on #48. Local configuration is applied; repository merge remains pending.
