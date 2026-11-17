# Isolated pilot fixture

Task 1 / #114 supplies storage. [Task 2A1 / #117](https://github.com/Maeximilion/MaexSocial/issues/117) adds a synthetic protected dashboard and session/tenant/CSRF tests. Initial sessions and authority are created only inside isolated tests: no public login/token issuance or runtime launcher. [#131](https://github.com/Maeximilion/MaexSocial/issues/131) retains real auth/lifecycle/MFA/recovery. Desktop, dispatch and export remain later work; G3/G5 stay open.

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

`pilot:test` runs files sequentially because they share one schema and the storage suite takes exclusive table locks to test populated-down refusal. Concurrency tests still run their competing transactions explicitly inside each test; sequencing files prevents unrelated migration locks from interfering with those barriers.

`pilot:up` generates a new random namespace, credentials, one-day TLS certificates and an expiring manifest in ignored `work/pilot/`. Database login credentials also expire after one day. It starts separate application PostgreSQL, identity PostgreSQL, Keycloak and a mailbox sink. Both networks are internal with no published ports; a disposable Node runner joins them for readiness, migrations and tests. Package/image downloads occur before runtime. No daemon or host firewall changes, external mail relay, external product request or real credential is needed. `pilot:down` works with an expired manifest and preserves all volumes.

Docker 29.9.2 on the development host accepted internal-network port declarations but supplied no mappings. The plan allows an isolated local network, so this delivery uses that topology throughout. The direct Node test command transparently runs its database assertions inside the isolated runner. It does not require a host database port. The dashboard browser uses an isolated runner alias and generated customer certificate. Real ingress and OIDC redirects belong to A2/Task 3; the two public-client definitions are disabled until then, with no wildcard redirects, direct password grants or client secrets. Identity management port 9000 is never published.

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

## Synthetic dashboard checks

`npm run pilot:test` includes a real keyboard browser test. The pinned Playwright worker runs on the internal identity network, without host ports, with read-only root and only the public customer certificate (no private key, manifest or DB credentials). The Node 24 application runner owns test sessions and HTTPS; the browser image runtime is separate. A unique short network alias stays within the DNS label limit. The harness tears down its worker and saves `work/portal-preview/dashboard.png` for local inspection. This dashboard test makes no IdP/external request.

Handlers share `apps/web/src/server/request.ts`; domain callers must bind HTTP/CSRF and current authority inside one transaction and scope queries to its resolved tenant. See the [A1 contract](../../docs/superpowers/plans/2026-11-06-task-2-deliveries.md#a1-shared-contract-and-evidence) for lock order and synthetic MFA limits. Same-origin referrer policy retains browser form Origin for strict CSRF checks.

Migration 002 adds only session CSRF, tenant version and synthetic factor binding. The unmerged experimental lifecycle schema is not an upgrade target: preserve old investigative fixtures and initialize a fresh namespace. No migration deletes populated fixture data. Pushed source/private checkpoints retain experiments without delivering executable lifecycle contracts.

## Read-only identity status (#136)

`createIdentityInspector` in [identity.ts](../../apps/web/src/server/identity.ts) implements A1's existing `InspectIdentity` contract. Only server composition supplies the fixed pilot issuer, client credentials and trusted CA. There is no runtime launcher, public token issuer, authentication callback or fixture-login route. The test harness alone seeds application sessions.

A **fresh** fixture imports two credentialless synthetic users (enabled/disabled), a dedicated `pilot-status` service principal and a roleless negative-control principal. Random client secrets and the generated realm stay in ignored `work/pilot/`, with restrictive creation permissions. The existing static realm remains the closed public-client baseline. Preserve any earlier fixture and its volumes before starting a new namespace; importing this source does not update existing realms. No Admin REST write or customer credential change is performed.

The status principal receives only `realm-management/view-users`, with matching client scope mapping and `fullScopeAllowed=false`. Its built-in composite includes `query-users` and `query-groups`; it has realm-wide user/group read authority, not field-level or per-user permissions. This is accepted only for the isolated synthetic pilot realm. Both clients have the built-in `kc-admin-api` scope so Keycloak can enforce its Admin API audience; this grants no management role. The roleless control must authenticate successfully and then receive HTTP 403 on user inspection.

Pinned Keycloak **26.8.2** evidence:

- [UserResource](https://github.com/keycloak/keycloak/blob/26.8.2/services/src/main/java/org/keycloak/services/resources/admin/UserResource.java): `getUser` and `credentials` require `requireView(user)`; the credentials endpoint removes `secretData`.
- [UserPermissions](https://github.com/keycloak/keycloak/blob/26.8.2/services/src/main/java/org/keycloak/services/resources/admin/fgap/UserPermissions.java): `view-users` satisfies the direct read; `query-users` alone does not. No management role is needed.
- [Service accounts](https://github.com/keycloak/keycloak/blob/26.8.2/docs/documentation/server_admin/topics/clients/oidc/proc-using-a-service-account.adoc): token roles are the intersection of service-account roles and client scope mappings.
- [Admin API audience](https://github.com/keycloak/keycloak/blob/26.8.2/docs/documentation/server_admin/topics/admin-console-permissions/admin-api-audience.adoc): custom clients also need `kc-admin-api`, which supplies the fixed API audience and scope. The audience check stays enabled.

The adapter makes exactly one client-credentials POST to `/realms/pilot/protocol/openid-connect/token`, then GETs `/admin/realms/pilot/users/{subject}` and that user's `/credentials`. One five-second deadline covers DNS, TLS, headers and bodies across all three requests. Each response is limited to 64 KiB, headers to 8 KiB, each list to 32 entries, IDs to 255 characters and action/type labels to 128. TLS verification, exact immutable-subject matching, required boolean/array validation, UTF-8/JSON validation and unique credential IDs precede the minimal DTO projection. Unknown nonempty required actions remain visible to A1 and cause denial. Unavailable, malformed, mismatched, denied, oversized or partial responses fail with a fixed error; no raw body, token, secret, retry, redirect or cache is exposed.

Run `node --test dist/pilot/tests/pilot/identity-status.test.js` after the build and fresh fixture migration. The suite distinguishes real local Keycloak/guard checks from controlled HTTPS responses. The latter cover invalid/missing fields, mismatch, denied requests, partial failures, exact/over limits, TLS rejection and a delayed/trickling response under the shared deadline. HTTP status observation records numbers only, never response bodies or tokens.

These are two separate provider reads, **not an atomic lifecycle snapshot**. Enrollment does not prove factor use, MFA time, recovery generation, lifecycle completion or permission to issue an application session. The real fixture contains no factors; its successful status read still fails Manager MFA. #131 retains all real authentication/MFA/recovery obligations; #123/#124, Task 3 and G3/G5 remain dependent on them. #137's earlier browser observation remains unresolved.
