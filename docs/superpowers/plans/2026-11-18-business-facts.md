# Business facts implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline. The owner delegated technical decisions to Root; use the existing Claude API PR review, without a second review loop.

**Goal:** Let current Employees and Managers consult the latest synthetic facts for their active tenant's locations.

**Architecture:** Append-only PostgreSQL fact-sheet revisions, written only by the private fixture owner. Protected GET routes use the existing authority transaction and escaped server-rendered pages. Historical simulated confirmation grants no present authority.

**Tech stack:** Strict TypeScript, Node 24.22.2, existing Express/PostgreSQL and Playwright.

**Spec:** [Issue #153](https://github.com/Maeximilion/MaexSocial/issues/153), [accepted Task 2](2026-11-06-task-2-deliveries.md), [content policy](../../05_CONTENT_POLICY.md).

## Global constraints

- Facts: 1–6000 Unicode code points; source: 1–500. Normalize CRLF and CR to LF before storage.
- Composite tenant/location and tenant/membership references; positive revision and membership version; fixed `synthetic_fixture` evidence kind.
- Fixture insertion checks the active Manager and exact version; retain historical evidence after authority changes. App SELECT only; no fact mutation route.
- Existing identity/session/tenant/membership guards remain mandatory. No real confirmation, generation, media, scheduling, approval, export, provider operation or gate acceptance.
- Own migration005; sibling #154 owns migration006. Preserve other changes.

## Review focus

Tests cover cross-tenant IDs with a shared identity; latest revision per location; absent facts versus absent location; hostile text and Unicode/newline boundaries; historical confirmation after Manager revocation. Review also checks that stored synthetic evidence cannot become a current approval claim.

## Task 1: Storage and protected facts view

**Files:** `db/migrations/005_business_facts.{up,down}.sql`, `scripts/pilot-db.ts`, `apps/web/src/routes/facts.ts`, `apps/web/src/routes/content.ts`, `apps/web/src/routes/portal.ts`, `apps/web/src/server/customer.ts`, `tests/pilot/facts.test.ts`.

**Interfaces:** `renderFacts(db: Client, context: CustomerContext, locationId?: string): Promise<string>` consumes existing protected context and returns escaped HTML. `pilot.business_fact_revisions` uses `(tenant_id,location_id,revision)` as its primary key; facts text, source note, evidence kind, membership ID/version and confirmation timestamp are immutable. Reuse `page` from the content renderer and `html` from portal.

- [x] Add an actual HTTPS test for `/customer/facts`; strict build then run it and observe 404 before implementation.
- [x] Implement migration registration and table. Normalize text in its insert trigger; validate the Manager's current version under a share lock. Reuse `pilot.reject_mutation` for update/delete.
- [x] Implement list/detail GETs and portal/draft navigation. Latest revision uses a tenant/location lateral join; own empty location returns an explanatory page, foreign/unknown ID denies alike.
- [x] Expand actual DB/HTTPS checks: Employee/Manager, A/B/shared identity, current/stale/revoked/unavailable authority, escaped text, 6000/500 emoji limits and LF normalization, composite FK/positive constraints, duplicate revision, immutable rows, app write denial, unchanged content records and valid controls.
- [x] Run `npm run pilot:build`, empty fixture `pilot:migrate` up/down/up, `migration-empty.js`, then `facts.test.js`. Expected: build and all checks pass. Commit the complete behavior with a focused message.

## Task 2: Keyboard evidence and delivery

**Files:** `tests/pilot/portal-keyboard.test.ts`, `tests/pilot/fixtures.ts` only if shared seeding needs it, `ops/local/README.md`, `docs/01_STATUS.md`, `docs/07_WORKPACKAGES.md`, `docs/superpowers/plans/2026-11-06-task-2-deliveries.md`, six-section `docs/handovers/sessions/2026-11-18-business-facts.md`.

**Interfaces:** Private owner seeds invented facts; existing isolated browser runner is unchanged. App remains SELECT-only.

- [x] Add keyboard navigation from workspace to latest facts, verify literal hostile text, simulated confirmation and no active external links, and return to drafting. Verify an empty location.
- [x] Run strict build, targeted keyboard test and complete `npm run pilot:test`; stop/start the same isolated fixture with volumes retained and repeat the complete suite. Expected: all pass; record any failed run honestly.
- [x] Run foundation checks with the Git-configured Gitleaks binary. Complete docs and handover with a meaningful work revision/resumption point before the first normal PR.
- [ ] Commit/push, open one normal PR with `Closes #153`, attach it to this chat, fetch, and verify actual Claude API execution/current head-base coverage and candidate CI. Send frozen head/title/body and recovery checkpoint to Root; Root alone merges/archives.
