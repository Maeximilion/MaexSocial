# Isolated storage fixture

[Issue #114](https://github.com/Maeximilion/MaexSocial/issues/114) implements only task 1 of the [accepted MS-009 plan](../../docs/superpowers/plans/2026-11-05-ms-009-local-text-pilot.md). No portal, desktop, dispatch, export or recovery workflow is present. G3 remains open.

Use Node **24.22.2**, npm **11.19.1**, Docker Engine and Compose. From the worktree root:

```text
npm ci
npm run pilot:build
npm run pilot:up
npm run pilot:migrate -- up
npm run pilot:migrate -- down
npm run pilot:migrate -- up
node --test dist/pilot/tests/pilot/migration-empty.js
node --test dist/pilot/tests/pilot/storage.test.js
npm run pilot:test
npm run pilot:down
```

Run the up/down/up migration drill and `migration-empty.js` only before seeding. The runner accepts no database URL or target argument. It verifies the generated manifest, every service's Docker project/label, actual internal-only network attachments and database marker before SQL. Migration down locks all pilot tables and refuses populated tables, unknown database objects or an enabled dispatch control. Explicit teardown uses no CASCADE; unknown dependencies or remaining schema objects roll back the whole transaction. The one stopped control row is bootstrap metadata. No command deletes volumes.

`pilot:up` generates a new random namespace, credentials, one-day TLS certificates and an expiring manifest in ignored `work/pilot/`. Database login credentials also expire after one day. It starts separate application PostgreSQL, identity PostgreSQL, Keycloak and a mailbox sink. Both networks are internal with no published ports; a disposable Node runner joins them for readiness, migrations and tests. Package/image downloads occur before runtime. No daemon or host firewall changes, external mail relay, external product request or real credential is needed. `pilot:down` works with an expired manifest and preserves all volumes.

Docker 29.9.2 on the development host accepted internal-network port declarations but supplied no mappings. The plan allows an isolated local network, so this delivery uses that topology throughout. The direct Node test command transparently runs its database assertions inside the isolated runner. It does not require a host database port. Browser ingress and exact OIDC redirect registrations belong to task 2/3; the two public-client definitions are disabled until then, with no wildcard redirects, direct password grants or client secrets. Identity management port 9000 is never published.

Application login is a non-superuser with no role/database creation, bypass-RLS or identity-database access. It receives explicit table/column privileges, including generated-only occurrence IDs and no delete permission. Composite keys prevent cross-tenant references; they do not replace the later API's active-tenant and role checks. Approval/revision/audit snapshots are immutable. Membership and grant changes advance a version. Later tasks must atomically check current versions and serialize approval, hold/export/claim, revocation and audit. This delivery does not claim those transitions or tenant row-level read authorization.

`work/pilot/provider-state/` is reserved separately from both database volumes for the future counting fake. It is retained by down/restart; no provider is implemented here. Task 5 must exclude that independent state from application restore. Remaining local secrets/fixtures stay isolated and untracked; publish only sanitized results.

For a fresh run after expiry or a failed initialization, stop the fixture, preserve the complete `work/pilot/` directory under another ignored name, then run `pilot:up` again. Never repoint the manifest at an existing database or reuse a namespace with different credentials. Stopped volumes remain for deliberate recovery/cleanup. Do not print or attach manifests, generated SQL, private keys or raw logs. No certificate is installed in the host trust store. Fixture credentials and device records provide no production assurance.

## Pins and evidence

Pins were read from official sources on 2026-11-06. The lockfile fixes packages and integrity; Compose fixes image tags **and** registry digests. Node is pinned for CI and the isolated runner. TypeScript 7.0.2 and node-postgres 8.23.1 use the registry metadata of their upstream packages.

- [Node 24.22.2 distribution and SHA-256 manifest](https://nodejs.org/dist/v24.22.2/SHASUMS256.txt), [Node release policy](https://github.com/nodejs/Release)
- [PostgreSQL 17.11 release](https://www.postgresql.org/docs/17/release-17-11.html), [TLS](https://www.postgresql.org/docs/17/ssl-tcp.html)
- [Keycloak 26.8.2](https://github.com/keycloak/keycloak/releases/tag/26.8.2), [database/TLS configuration](https://www.keycloak.org/server/db)
- [Mailpit 1.33.0](https://github.com/axllent/mailpit/releases/tag/v1.33.0), [runtime options](https://mailpit.axllent.org/docs/configuration/runtime-options/)
- [Docker internal-network behavior](https://docs.docker.com/compose/how-tos/networking/), [upstream port-mapping report](https://github.com/moby/moby/discussions/53256)

Local observed results: strict build passed; TLS readiness passed; empty migration up/down/up passed; storage races, A/B reference rejection, immutable IDs/snapshots, versioned approval, single attempt, invitation reuse denial and populated-down refusal passed. Isolation tests verify internal-only network attachments, no published ports, app-role denial on the identity DB with a valid Keycloak-role control, rejection of plaintext PostgreSQL and verified HTTPS for Keycloak/mailbox. These are synthetic storage/infrastructure results, not ACCESS/PLAN whole-slice or real-provider evidence. Exact revision and hosted results are recorded in the delivery PR.
