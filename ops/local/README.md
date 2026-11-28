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

`work/pilot/provider-state/` holds the [local GBP counting fake](../../apps/worker/src/fake-gbp.ts) separately from both database volumes. Each accepted `create` commits one SQLite row, even when its reply is lost. Reopening the directory retains counts and scripted observations. Task 5 must exclude this independent state from application restore.

From the worktree root with the pinned Node 24.22.2 and dependencies installed, run:

```text
npm run pilot:build
node --test dist/pilot/tests/pilot/fake-gbp.test.js
```

The focused tests use fresh temporary directories and invented identifiers. The default adapter directory is created by `pilot:up`. A scenario supplies timed frames relative to acceptance, each with zero, one or several candidate states. Polling selects a frame using the injected clock and the original attempt identifiers, plus the resource name when known. The fake returns observations for worker tests. Real Manager approval, provider access and publication decisions remain separate.

For a fresh run after expiry or a failed initialization, stop the fixture, preserve the complete `work/pilot/` directory under another ignored name, then run `pilot:up` again. Never repoint the manifest at an existing database or reuse a namespace with different credentials. Stopped volumes remain for deliberate recovery/cleanup. Do not print or attach manifests, generated SQL, private keys or raw logs. No certificate is installed in the host trust store. Fixture credentials and device records provide no production assurance.

## Isolated text worker wake (#286)

From this worktree, build and migrate a fresh ordinary fixture using the commands above.
When local dispatch is deliberately enabled using the [checked reopen](#explicit-reopen-266),
wake one stored global occurrence ID in its own worker process:

```text
node dist/pilot/apps/worker/src/main.js <occurrence-uuid>
```

The command binds the worker to its own worktree and local Docker fixture. It validates the
ordinary database marker, resolves approval and destination in PostgreSQL, and mounts only
the existing provider-state directory for writes. A successful claim commits before the local
SQLite fake accepts a create. Later wakes use readback for the stored attempt, including
while dispatch is stopped. The normal fake supplies PROCESSING. The command reports only
the state, such as `in_flight`, `pending` or `denied`. Invalid inputs and fixture failures
exit with a fixed error.

Run `node --test dist/pilot/tests/pilot/worker-wake.test.js` on the migrated ordinary fixture.
The test holds a PostgreSQL draft lock until two worker processes are waiting, then exercises
fresh process and container invocations after stop. It compares PostgreSQL and SQLite counters
and checks the provider-state directory across rejected structured and media wake inputs.
The [handover](../../docs/handovers/sessions/2026-11-23-isolated-worker-wake.md) records the
measured scope and the open integrated acceptance work.

## Disposable grant retirement (#310)

Use a fresh worktree with no active fixture and the pinned, cached pilot images. Build, run
`npm run pilot:up -- grant-retirement`, `npm run pilot:migrate -- up`, then
`node dist/pilot/tests/pilot/grant-retirement.js` and `npm run pilot:down`.
The drill requires a new database and creates its own external temporary directory. Only the
drill and its worker runners mount that directory. The database holds fixture-only digests
and version-bound revocation records. A location lock covers verification and the fake call.
The drill brackets the revocation commit on the database clock, exercises denial and restart,
then measures on-demand removal. A controlled as-of check uses the committed revocation time:
it changes from not due to overdue at the 24-hour boundary while the file exists, then confirms
absence for the same deadline after removal and restart. The drill removes the temporary store on exit. Scheduling, physical
media sanitization and deployed credential custody remain open.

## Private terminal text export (#252)

The private `claimExport` entry point reuses a bound customer session and the occurrence's immutable approval.
It locks the caller and approving Manager identities, draft, occurrence and destination before rechecking
current authority and the approved revision. A first eligible call commits `exported` and one audit row
before returning text. An eligible repeat returns the same text without another write. A hold, quarantine,
dispatch attempt, stale binding or currently active Google grant blocks access.

Migration 010 lets new approvals retain the destination's grant status at approval. The local export
accepts an already-missing grant at the approved version, or one version step from recorded active
access to missing access at the exact same destination. Older rows keep an unknown status and cannot
use the version-step path. Reconnecting access prevents further downloads and preserves the terminal state.

On an isolated migrated fixture, run `node --test dist/pilot/tests/pilot/occurrence-export.test.js` after
`npm run pilot:build`. The test drives the real private operation with synthetic customer authority,
including a deferred commit failure and a competing claim. The isolated HTTPS consumer is described
below. Integrated delivery remains in [Task 4](https://github.com/Maeximilion/MaexSocial/issues/165).

## Private customer HTTPS download (#289)

The isolated customer HTTPS fixture explicitly enables `POST /customer/occurrences/:id/export`.
The standard customer app leaves the route and download form disabled. The fixture uses stored
customer sessions, the existing origin and CSRF checks, and current tenant and membership authority
on every POST. The only form field is `csrf`.

An Employee or Manager can download `approved-post.txt` when the approved occurrence is eligible
for manual export. The response is a private, non-cacheable UTF-8 text attachment sent after the
existing export transaction commits. Reload the occurrence to see **Exported** and the closed
automatic submission state. Authorized repeats keep the original export audit. Restored Google
access blocks repeat downloads and preserves the terminal status.

On a fresh isolated fixture, run:

```text
npm run pilot:build
npm run pilot:up
npm run pilot:migrate -- up
node --test --test-concurrency=1 dist/pilot/tests/pilot/export-browser.test.js dist/pilot/tests/pilot/occurrence-export.test.js
npm run pilot:down
```

The browser checks keyboard downloads for both roles, exact bytes and the reloaded terminal state.
HTTPS checks cover an eligible repeat, restored access, revoked membership, the foreign tenant,
hold and dispatch attempt records, malformed requests and the default disabled route. Database
and SQLite counters check the export, dispatch and independent tenant effects. Integrated sign-in
and Task 4 acceptance remain under [#131](https://github.com/Maeximilion/MaexSocial/issues/131)
and [#165](https://github.com/Maeximilion/MaexSocial/issues/165).

## Private Manager approval withdrawal (#273)

The private `withdrawApproval` operation binds the occurrence and exact approval ID to the original
approving Manager's current tenant lifecycle and membership version. It checks the same five-minute
enrolled MFA as approval, including after the draft and occurrence locks. A successful withdrawal
returns the occurrence to draft and appends one audit row referencing the immutable approval. An
authorized repeat of that exact withdrawal leaves any later approval intact. A fresh approval needs
a proposal read after the withdrawal.

Dispatch and terminal export share the occurrence lock. A claim or export that wins retains its
approval and outcome. Dispatch reconciliation continues on the original attempt. Holds and
quarantine deny a new withdrawal and retain their own state.

Migration 012 links withdrawal audit rows to approvals and retains offline restore compatibility
with the exact 010 and 011 schemas. Downgrade is refused once a withdrawal audit exists.
On an isolated migrated fixture, run
`node --test dist/pilot/tests/pilot/occurrence-export.test.js` after building. Public approval UI and
authenticated integration remain under [#223](https://github.com/Maeximilion/MaexSocial/issues/223).

## Private approval across tenant reactivation (#271)

The Manager's private proposal and immutable approval record carry the current tenant version.
Approval submission checks the proposal under the session's tenant lock. Dispatch and terminal export,
including repeat downloads, check the stored approval against the same current lifecycle before any effect.
An eligible unclaimed occurrence can receive a deliberate fresh approval. It keeps the earlier snapshot.
Holds, quarantined occurrences and existing attempt or export history stay protected.

Migration 011 preserves previous snapshots with an unknown tenant version. It does not infer authority
from the tenant's current version. The 011 build accepts the exact 010 migration fingerprint for offline
paired restore. It verifies the captured schema and both archives, disables application login and
quarantines on the original schema. The ordinary dispatch reopen command requires the current schema.

Run `node --test dist/pilot/tests/pilot/occurrence-export.test.js` after building and migrating the ordinary
synthetic fixture. The lifecycle case covers old sessions, previews, approvals and repeat downloads,
a fresh Manager approval, an independent tenant, and reconciliation of an existing attempt. The
authenticated customer journey remains under [#223](https://github.com/Maeximilion/MaexSocial/issues/223).
Real identity and MFA remain under [#131](https://github.com/Maeximilion/MaexSocial/issues/131).

## Private synthetic dispatch claim (#253)

The [private dispatch entry](../../apps/worker/src/dispatch.ts) takes a stored occurrence ID and the
isolated fake's explicitly allowed organic-text policy. It locks current tenant and approving Manager
authority, the draft, occurrence, destination and stop control. PostgreSQL checks whether the exact
approved instant is due. One transaction records the attempt, state and audit before the winner can
send the immutable text to the SQLite fake. The fake stores the request with its call count. The
attempt remains in flight until the existing read-only reconciliation records a provider observation.

On a fresh isolated fixture after the migration drill, run `npm run pilot:build` and
`node --test dist/pilot/tests/pilot/dispatch.test.js`. The suite checks competing claims, both commit
orders with terminal export, stop and rollback, pre-send process exit, lost reply, restart and
zero budget reservations. Run `npm run pilot:down` after verification. The test creates its own
synthetic authorities, provider state and content. Integrated service operation and gate evidence
remain in [Task 4](https://github.com/Maeximilion/MaexSocial/issues/165) and [#10](https://github.com/Maeximilion/MaexSocial/issues/10).

## Local readiness recovery (#219)

Use a fresh task worktree without `work/pilot`, the pinned Node and npm, installed locked dependencies, and the pinned Compose images already present in the local Docker cache.

~~~text
npm run pilot:build
npm run --silent pilot:readiness
~~~

The command creates a dedicated fixture on the local Docker socket, verifies its isolated topology, and probes the Mailpit HTTPS info endpoint from its internal runner. It expects `ready` before stopping the mailbox, `unavailable` after Compose stops it, and `ready` after Compose starts the same container. It refuses an existing fixture and stops its own stack on completion or failure. The usual fixture files and volumes are retained in their isolated namespace.

The three JSON records contain the phase, UTC observation time, component, status and elapsed milliseconds. Each duration begins before the corresponding Compose action and includes the observation overhead. The output carries no HTTPS body, request identifiers or fixture credentials. These measurements describe one local mailbox run. Staging activation and alert response belong to [#82](https://github.com/Maeximilion/MaexSocial/issues/82) after [#166](https://github.com/Maeximilion/MaexSocial/issues/166) and operator approval. Production availability and recovery targets require a separate decision.

## Synthetic cold backup pair (#216)

Start in a separate clean task worktree with the existing pinned pilot images already present in the local Docker cache. Use a worktree without `work/pilot`. Set `MAEX_COLD_BACKUP_KEY_FILE` to an absolute path in a private directory outside the source and target worktrees and outside the copied fixture. On POSIX, the file must be owned by the current user with no group or other permissions. On Windows use a directory whose ACL restricts access to your account. To provision the separate throwaway key from the host after setting that path:

~~~text
node -e "require('node:fs').writeFileSync(process.env.MAEX_COLD_BACKUP_KEY_FILE, require('node:crypto').randomBytes(32), {mode: 0o600, flag: 'wx'})"
~~~

Use the same key file for capture, verify, restore and expiry. Keep only its path in the environment. Capture refuses a missing key before creating the source fixture.

~~~text
npm run pilot:backup -- capture
npm run pilot:backup -- verify
node --test dist/pilot/tests/pilot/cold-backup.test.js
~~~

The backup command builds the current source. Capture requires a clean worktree and checks the source revision again before publishing. It initializes its own disposable fixture, migrates AppDB, seeds an invented tenant with draft occurrences and imports a disabled IdP account bound to the same fixture ID. It accepts no source override and refuses an existing `work/pilot`, including a stopped fixture. It stops all fixture services before reading the two complete PostgreSQL data directories through read-only mounts. Both clusters must report clean shutdown. The command fails if a source is active, unrecognized or changes state during copying. Image pulls are disabled.

Format 3 publishes `app-db.tar.enc`, `identity-db.tar.enc`, `pair.json` and `pair.auth` together under ignored `work/pilot/cold-backup/`. Each archive streams through Node's AES-256-GCM with its own random nonce and authenticated source fixture ID and database role. The detached manifest tag authenticates the source revision, pinned builds, schema and configuration fingerprints, cluster identifiers, history anchor, UTC retention metadata and both ciphertext digests and seals. Verify streams both archives and checks the same build and configuration constraints. The synthetic limit is 256 MiB per archive. Capture stages ciphertext only and removes pending output on handled failure. A hard interruption can leave an unpublished ciphertext directory. An existing fixture and its volumes are never overwritten.

Keep the pair and the fixture's generated configuration private for [Task 5](https://github.com/Maeximilion/MaexSocial/issues/166). The generated configuration, TLS files, mailbox and independent provider state stay outside the pair. This check establishes local integrity and compatibility with the pinned fixture. The [paired restore](#offline-restore-of-a-verified-pair-235) consumes this input under the bounded Task 5 contract.

## Rolling expiry of disposable backup pairs (#250)

A fresh pair records its UTC capture time after the source stops. Formats 2 and 3 expire
30 elapsed days after capture. Format 1 has no trustworthy capture time and remains eligible
for compatible offline inspection and quarantine with unknown retention eligibility.

New disposable format-3 pairs authenticate their capture time as `lineageCapturedAt`.
A continued format-4 pair records its own actual `capturedAt` and inherits the authenticated
`lineageCapturedAt` from its parent. Both PostgreSQL system identifiers, catalog versions
and the original capture journal must match. At the lineage start plus 30 elapsed days,
capture publication, verification and restore admission refuse the pair. Older readers
refuse format 4. Existing format-3 pairs without the lineage start retain their recorded
lifetime and cannot seed another capture. Historical copies require separate disposition.
History replay requires the independent capture evidence and replay interval described below.

To test physical expiry, create a fresh disposable pair in its own clean local worktree:

~~~text
npm run pilot:backup -- capture --disposable
npm run pilot:backup -- expire
~~~

Run the second command in that same worktree at or after the recorded deadline. It accepts no
path, touches only the two matching archive files in that fixture's cold-backup directory, and
retains the manifest and its authentication tag for safe retries. Formats 3 and 4 authenticate the
expiry decision before removing either archive. Fixture volumes are outside the expiry operation. Preserve
the #216 reference and existing backups. Copy-wide expiry after online purge, production custody,
provider caches and integrated recovery acceptance remain in [#166](https://github.com/Maeximilion/MaexSocial/issues/166)
and [#82](https://github.com/Maeximilion/MaexSocial/issues/82).

## Synthetic job budget (#218)

Run `node --test dist/pilot/tests/pilot/budget.test.js` after building and migrating the isolated fixture.
The test helpers lock the tenant's budget row before admitting new work. Reservations and unknown costs
hold their full units. An atomic settlement fixes the first known cost and returns any unused units to
available capacity. A repeated settlement leaves the stored result intact. A missing or zero budget
admits zero work. The configured cap and reservation ledger stay in the existing tables.

The draft and approval suites exercise organic text with a funded synthetic budget and verify that the
budget and recorded reservations remain untouched. Synthetic accounting runs only inside the test fixture.
The integrated ADS-01 receipt and external operating prerequisites remain under [#10](https://github.com/Maeximilion/MaexSocial/issues/10).

## Local dispatch stop (#215)

From the worktree root with a built and migrated ordinary fixture, use these commands:

```sh
npm run pilot:stop-dispatch
npm run pilot:dispatch-status
npm run pilot:reopen-dispatch
```

All three report JSON with `stopped` and `outstandingAttempts`. The count includes stored
`unknown` and `pending` attempts. Stop commits on the control row used by the private claim.
Already claimed work can settle and be reconciled by readback. New claims are denied while
stopped, including after `pilot:down` and `pilot:up` with retained volumes.

### Explicit reopen (#266)

Use reopen deliberately after checking the status. It requires a local Docker socket, the
expected internal services, both healthy PostgreSQL containers, working application DB login,
the current pilot schema and Keycloak
and mailbox TLS readiness. A fresh ordinary fixture records its purpose in the manifest and
AppDB identity. Existing fixtures without both records, restore targets, backup sources and
readiness drills cannot reopen. Keep their data and use a freshly initialized disposable
fixture for ordinary dispatch. Reopen changes the control row only. Existing holds, quarantine,
approvals and attempts retain their state, and the command never retries a create.

On a running, migrated, stopped disposable ordinary fixture, run
`node dist/pilot/tests/pilot/dispatch-recovery.js`. It asserts and reports the guarded refusal,
post-commit stop and readback, retained restart and explicit reopen phases. A creates once,
B stays unclaimed and unexported, and a new approved control creates once after reopening.
The drill leaves dispatch stopped.

## Historical quarantine on a disposable restore target (#217)

Use a fresh local worktree with no existing `work/pilot/`. This mode uses a new Docker project and an explicit
restore marker in both the manifest and the AppDB. Its Docker networks are internal and the services publish
no host ports. The application role cannot log in or connect to the database. A normal fixture cannot be converted in place.
The regression below seeds invented historical rows into a fresh target. To use a separately seeded
synthetic target, run the quarantine command directly after seeding as the fixture owner. Keep the
independent fake provider ledger outside the database.

```text
npm run pilot:build
npm run pilot:up -- restore-target
npm run pilot:migrate -- up
node --test dist/pilot/tests/pilot/restore-quarantine.test.js
npm run pilot:restore-quarantine
npm run pilot:down
```

The quarantine command takes no target arguments. The host verifies the fixture's internal Docker
networks, attached containers and port mappings before starting the isolated runner. The runner verifies
the database marker and application role, commits the dispatch stop, and sets every occurrence to
`quarantined` in the same transaction. It records each prior
state in the restore-only `restore_previous_state` column, including `exported`, and preserves existing
approvals, attempts, and audit history. Every historical row is held even if independent history is
incomplete or a provider lookup yields no match. The output reports the observed Docker network and
published-port counts, application login, dispatch stop and rows quarantined by the invocation. A repeat
on the same rows reports zero. The fixture remains offline.

The focused test invokes the command against an empty and a populated scratch database. It covers all
occurrence states, two tenants, a missing attempt after a fake acceptance, a negative worker readback,
stable independent create counts, repeat execution, and refusal of an ordinary or mismarked database.
The ordinary pilot suite exercises refusal only. The [paired restore](#offline-restore-of-a-verified-pair-235)
and [history replay](#offline-deletion-and-revocation-history-replay-241) use the same quarantine.
A separately authorized release decision remains in [Task 5](https://github.com/Maeximilion/MaexSocial/issues/166).

## Offline restore of a verified pair (#235)

Run this in a fresh local worktree with no `work/pilot`. Supply a private copy of the source fixture
directory containing `fixture.json`, `compose.env`, and `cold-backup/` with the pair manifest and
both archives. For formats 3 and 4 include `pair.auth` and point `MAEX_COLD_BACKUP_KEY_FILE` to the separate
key outside the checkout and the copy. Legacy formats 1 and 2 retain their private offline path
with the original TAR filenames. If the legacy manifest records the generated IdP configuration fingerprint, include the
copy's `keycloak.conf` and `keycloak-realm.json`. Keep the original configuration, files and volumes
private and intact. Use the cached pinned images on the local Docker socket.

    npm run pilot:restore -- <private-synthetic-fixture-copy>
    npm run pilot:restore-quarantine
    npm run pilot:down

The command checks the pair identity, pinned builds, fixture configuration, schema fingerprints
and both archive hashes before creating storage. Formats 3 and 4 also authenticate the manifest and
both archives before creating storage. The isolated importer stages each streamed TAR in a
bounded container tmpfs and opens it only after the host authenticates the entire stream and
sends the completion digest. Each cluster is extracted and checked without a network connection. The command checks the captured AppDB and IdP records and their live schema
fingerprints, binds the new fixture identity, and restricts application and Keycloak logins. It starts
only PostgreSQL on internal networks with no published ports. Dispatch is stopped before either
database joins those networks, and #217's quarantine runs before the command records readiness.
The same transaction revokes unrevoked customer and management AppDB sessions using the
existing `revoked_at` field. Previously recorded revocation times, session bindings and audit
history are preserved. A quarantine failure rolls back its writes and prevents readiness.

The sanitized output reports two verified databases, the number of historical occurrences quarantined,
dispatch stop, disabled application login and the network topology. The same summary is recorded
privately in `work/pilot/restore-ready.json` after both restores and quarantine finish. An existing fixture
or target directory is refused. A partial import has no readiness record and the normal `pilot:up`
command refuses all paired targets. A handled failure tears down the disposable target's storage.
After inspection, stop the databases with `pilot:down`. For a completed or externally interrupted
drill, the owner may remove the volumes for the verified disposable target project with Docker
Compose `down --volumes` before discarding its local configuration. Retry from a fresh target and
keep the recovery pair.

For the historical drill, seed a draft occurrence before the disposable snapshot, record one accepted
create for that occurrence in the independent counting fake, then restore the pair. Check that the
restored state is `quarantined`, the saved previous state is `draft`, repeat quarantine reports zero
changes, and the fake still reports one create. Keep provider state outside both backup and target.

The [history replay](#offline-deletion-and-revocation-history-replay-241) uses the same marked offline
target contract. The full paired recovery drill, general credential invalidation, recovery targets
and release authority remain in [Task 5](https://github.com/Maeximilion/MaexSocial/issues/166).

### Restored AppDB session revocation (#291)

Build four fresh, clean worktrees at the same revision with the pinned local images available.
Set [the external disposable backup key](#synthetic-cold-backup-pair-216) outside all four
worktrees. Run this command in the source worktree:

    node dist/pilot/tests/pilot/restore-sessions.js <target-worktree> <control-worktree> <failure-target-worktree>

The normal source and a separate control each supply an encrypted physical pair with one
current and one previously revoked AppDB session per audience. The normal pair restores
with both database markers, disabled app and IdP service logins, no published ports and all
historical occurrences quarantined. Read-only checks compare session bindings, revocation
timestamps and existing audit across repeated quarantine, incomplete history refusal and a
retained-volume restart. The control pair contains a synthetic constraint that rejects the
session update. Its restore must fail during quarantine and remove target resources without
publishing readiness. The two sources stay stopped during restore and are read independently
before and after. This also limits Docker network allocation to one fixture at a time.
Real identity, device revocation and operating recovery remain in #131 and #82.

## Authorized draft text erasure (#312)

From a clean, built task checkout with fresh fixture paths, set the separate private
`MAEX_COLD_BACKUP_KEY_FILE` as for the encrypted backup drill and run
`node dist/pilot/tests/pilot/draft-erasure.js`. The drill creates two new local databases
and restores the captured pair into a separate, offline Docker project in the same checkout.
Its fixture owner issues three exact draft instructions, including one for a draft created after capture. Each binds the source, tenant,
draft, sequence, journal digest and millisecond timestamp on the source database clock.
The owner appends records to the same compact JSON interval. Earlier permits pin the complete interval as originally issued. Both source erasure and restore verify that prefix, including every earlier record. Restore also verifies the independently supplied SHA-256 of the complete current file. A location fact deletion has its own event type.

The private operator command is `node dist/pilot/ops/local/source-draft-erasure.js SEQUENCE`.
It accepts an existing instruction on a disposable backup source. It locks the draft,
erases every revision payload and clears four historical approval fields in one transaction.
The receipt commits with the updates. A post-commit observation bounds the elapsed time from
authorization on the same database clock. A repeated command reports the existing application.
The operator invokes the command manually. See the [Task 5 evidence](../../docs/handovers/sessions/2026-11-28-authorized-draft-erasure.md)
for concurrency, retained fields, provider boundaries and restoration.

## Restore before dispatch and terminal export (#258)

Use two clean, disposable worktrees at the same revision, each without `work/pilot`.
Install from the lockfile and run `npm run pilot:build` in both. Use the existing pinned
Docker images on a local socket and provision the [separate disposable key](#synthetic-cold-backup-pair-216)
outside both worktrees. In the source worktree run:

    node dist/pilot/tests/pilot/restore-before-effects.js <absolute-target-worktree>

The drill seeds two approved occurrences before the cold pair, continues the source, then
uses the normal private dispatch and export entries. A commits one attempt and one create
in an independent SQLite fake. B commits one export audit and returns its approved text to
the source caller. The drill compares both bindings with the offline restored rows and
rechecks the original pair, source counts and fake after the target probes.

The same drill also exercises post-capture fact deletion and device revocation
([#277](https://github.com/Maeximilion/MaexSocial/issues/277)). Before capture, it inserts
two distinct fact revisions and one synthetic device in each case. After capture,
it reads the pair's actual history sequence, writes a separate two-event interval,
and revokes the first source device through the fixture-owner control. The source retains
all four fact revisions. The deletion record is a synthetic instruction for recovery.

To apply the deletion to the continuing source as well, add `--erase-source` to the drill
command. This variant needs another fresh disposable pair. Its synthetic issuer pins the
journal digest, sequence, tenant and location in the owner-only instruction table.
The source checks both fixture markers, locks the instruction and location, and commits
the erasure and receipt together. The drill stops the source before offline import.
Both variants use the same independent replay format and preserve the control location.

For the final-copy timing case, build one fresh source and two distinct fresh target worktrees
at the same revision and provision the same external disposable key. Run from the source:

    node dist/pilot/tests/pilot/restore-before-effects.js <first-target> --last-copy-expiry <later-target>

This variant applies the source erasure, captures both continuing volumes twice, and imports
the original and first later pair offline. The three pairs share the original cutoff.
It tests verification, restore admission and explicit expiry at controlled instants while
keeping the host clock intact. It explicitly removes all six owned ciphertext files and
checks the retained metadata on retry. A synthetic marker identifies affected archives.
The [earlier drill](../../docs/handovers/sessions/2026-11-28-last-copy-expiry.md) records the
capture-only deadline on the previous reader.

The ordinary importer restores both databases, all four revisions and both active devices
into the offline target. Missing history, a correctly hashed incomplete interval, and a wrong
digest each leave the target held without a replay receipt. The complete source-bound interval
physically removes both targeted fact rows and revokes the target device at version 2.
The other location's revisions and device remain intact. An identical replay applies zero
events before and after both target databases restart. The drill verifies the original pair
manifest, both archives, the capture journal and the independent later interval.

The target uses outer PostgreSQL role and network controls. The normal application
connector is refused before either private operation reaches its domain checks or returns
text. Read-only fixture-owner queries independently verify snapshot state and counts.
Repeated quarantine changes zero rows. Both stacks stop on exit. Fixture files, backup
archives and the fake remain in the disposable worktrees' ignored directories.

## Offline deletion and revocation history replay (#241)

Start a fresh marked target with `npm run pilot:up -- restore-target <snapshot-sequence>` and apply
the fixture migrations. Use the sequence from the synthetic snapshot record when seeding the target.
Bootstrap records it in the AppDB marker. The replay compares that marker with the requested sequence
inside the guarded transaction. Keep the independently retained history and its SHA-256 outside the
AppDB and its backup. Supply the expected interval and hash, and make the matching bytes available
read-only to the runner at `work/pilot/restore-history.json`. Targets without a recorded snapshot sequence
remain eligible for quarantine and fail replay.

### History from a cold backup pair (#248)

Run `npm run pilot:backup -- capture` in a clean, fresh source worktree. It records and applies one
synthetic grant revocation before stopping the source. The retained `work/pilot/capture-history.json`
is outside both archives. Capture records its last sequence and SHA-256 in the AppDB and the pair
manifest. The offline importer verifies the two anchors agree before binding the source fixture ID to
the new AppDB target. Pairs without this capture evidence remain eligible for quarantine and fail replay.

Record a later synthetic revocation in an independently retained interval from the captured source.
For the fixture drill, use the grant labeled `after-snapshot` and check that `unaffected` remains active.
In a fresh target worktree, run `npm run pilot:restore -- <private-synthetic-fixture-directory>`.
Make the later interval available at the replay path below. Set its `fixtureId` to the **source** fixture
ID and use the independently checked interval and hash. A successful replay revokes the later grant
while all three historical occurrences stay quarantined. Repeating the same replay applies zero
records. The source capture journal, archives and later history remain separate from the target.
The integrated recovery drill remains in [Task 5](https://github.com/Maeximilion/MaexSocial/issues/166).

```text
npm run pilot:restore-quarantine -- replay-history <snapshot-sequence> <ending-sequence> <sha256>
```

History schema 1 contains `schema`, `fixtureId`, `after`, `through` and `records`. Records must
cover every integer sequence from `after + 1` through `through` in order. Each record includes its
`seq` and one of these operations:

| `kind` | Target | Effect |
| --- | --- | --- |
| `delete-facts` | `tenantId` and location `id` | Remove every synthetic business-fact revision at that location. Facts already absent satisfy the deletion. |
| `revoke-grant` | `tenantId`, location `id` and current `version` | Disable that location's provider grant and advance its version. |
| `revoke-device` | Device `id` and current `version` | Disable that admin device and advance its version. |

The command commits quarantine before evaluating history. Missing coverage, byte or target mismatch,
and incompatible records cause a failed invocation. Any partial history writes roll back.
The successful transaction stores a receipt with the data changes. An identical retry reports zero
applied records. A different receipt requires a fresh fixture. Ingress, dispatch and export stay
unavailable throughout, including after a database restart.

For the regression, use snapshot sequence `10` with the cached, pinned fixture images, build and apply
the migrations as above, then run `node --test dist/pilot/tests/pilot/restore-history.test.js`. The isolated
test seeds an invented target and a control tenant, preserves the replay input for equality checks, and
tests interruption, repeat execution and PostgreSQL restart. Run it on a separate fresh target from the
populated #217 regression. The integrated archive, custody, rotation and release drill remains in
[Task 5](https://github.com/Maeximilion/MaexSocial/issues/166).

## Private customer organization creation (#259)

`createOrganization` takes a trusted, action-scoped private management context and rechecks the verified
operator, current enrolled device and active platform grant and session under database locks. Freshness is
checked after the locks. Hold and role changes still require a current, active target tenant.

The organization name is trimmed and limited to 200 Unicode code points without control characters or
unpaired surrogates. The database assigns the ID, active state and initial version. The same transaction
records the operator, device, created tenant, reason, time and outcome. The command returns only the committed
ID and status. The organization starts without memberships, invitations or pending access.

After the strict build and fresh migration, run `node --test --test-concurrency=1
dist/pilot/tests/pilot/management-organization.test.js dist/pilot/tests/pilot/occurrence-hold.test.js
dist/pilot/tests/pilot/management-role-change.test.js`. The synthetic tests cover the exact five-minute
boundary, invalid or stale authority, customer authority, unchanged existing tenants and audit rollback.
[#164](https://github.com/Maeximilion/MaexSocial/issues/164) retains the listener, Windows client,
actual device and phishing-resistant proof verification, and separate named-access provisioning.

## Private organization directory (#269)

[The unmounted read](../../packages/contracts/management-directory.ts) accepts a trusted DEV/Admin
directory context. Each page checks the current management session, verified identity, active device
and platform grant against a read-only database snapshot. The stored phishing-resistant assertion
must match the session proof. The session expiry, 10-minute idle and 1-hour absolute limits apply.
The five-minute step-up bound applies to management writes.

A page contains at most 50 active or inactive organizations, ordered by existing organization UUID.
Each entry contains only the ID, display name and active flag. Display the ID alongside the name to
distinguish equally named organizations. Pass the last returned ID in `nextAfter` to continue until
it is null. Each page takes a new snapshot, so changes to organizations may be visible between pages.
Selecting an ID leaves authority and stored state intact. Subsequent mutations still validate their
target, current authority and step-up independently.

After the strict build and ordinary fixture migration, run
`node --test dist/pilot/tests/pilot/management-directory.test.js`. The fixture checks pagination,
minimal results, revocation between pages, session limits and unchanged stored state.
[#164](https://github.com/Maeximilion/MaexSocial/issues/164) retains device and identity proof,
the private listener, the Windows client and integrated acceptance.

## Private tenant role changes (#236)

[The private transaction](../../packages/contracts/management-role-change.ts) consumes already validated
management context bound to the tenant, membership, selected role and current versions. It rechecks
stored authority and five-minute proof freshness under lock. A stale membership version or an already
selected role produces no change. Promotion can create the first Manager and demotion can remove
the last Manager from that role.

One commit advances the selected membership version, revokes the old customer sessions and outstanding
invitations issued under the old grant, detaches its unclaimed approvals from draft, approved and held
occurrences, and writes one audit event with actor, device, target membership, new version, reason
and outcome. It keeps historical approvals, claimed attempts, exported and quarantined bindings, and
other memberships. A re-promotion requires a fresh approval.

After the strict build and fresh migration, run
`node --test dist/pilot/tests/pilot/management-role-change.test.js`. The isolated database test exercises
customer-session rejection, reapproval and audit rollback with synthetic management context.
[Task 3](https://github.com/Maeximilion/MaexSocial/issues/164) retains the private listener, device proof,
Windows entry and integrated acceptance.

## Private DEV/Admin membership revocation (#263)

[The unmounted transaction](../../apps/web/src/server/management-membership-revocation.ts)
requires current DEV/Admin session, device, grant and phishing-resistant proof bound to the
revocation action and exact tenant and membership versions. The trusted private caller resolves
the locked identity's subject through the fixture recipient binding. Either role can be revoked,
including the last Manager or an Employee in an organization without an active Manager. The exact
membership remains revocable if the target lost verification or has no trusted recipient binding.
Recipient-based invitation cancellation requires a canonical address from that binding.

The transaction deactivates the membership, advances its version, revokes old customer sessions
and pending invitations issued by that membership, and revokes pending tenant invitations to
the bound recipient for either role. It clears unclaimed approval bindings eligible for
invalidation and writes the operator, device, tenant, target, resulting version, reason, time and
outcome to the audit. Historical approvals, claims, terminal exports, quarantine and other
organizations keep their state.

After building and migrating the isolated fixture, run
`node --test dist/pilot/tests/pilot/management-role-change.test.js` for private revocation,
concurrent retries, cross-tenant controls and forced audit rollback. The test uses the actual
private invitation issuers and the local Mailpit sink. Integrated private management, real
device proof and staging acceptance remain in [#164](https://github.com/Maeximilion/MaexSocial/issues/164)
and [#82](https://github.com/Maeximilion/MaexSocial/issues/82).

## Private GBP reconciliation (#213)

The [worker entry](../../apps/worker/src/reconcile.ts) accepts a stored occurrence ID and the local fake's readback capability. It resolves the tenant, existing attempt, original approval destination and optional resource name from PostgreSQL. It closes the connection before readback and verifies the stored binding under lock before writing. One matching LIVE result records confirmation, the resource name and observation time. Processing becomes pending, rejection stays distinct, and ambiguous or missing results stay unknown. A legacy approval without a destination snapshot remains unknown. The attempt persists across every result, keeping the occurrence unavailable for export. Existing quarantine and the dispatch stop are preserved.

With a fresh isolated fixture, run `npm run pilot:build`, `npm run pilot:migrate -- up` and `node --test dist/pilot/tests/pilot/reconcile.test.js`. The test seeds attempts, reconnects to the same SQLite fake in a second Node process, checks the stored states and verifies the create counts. Complete the empty migration drill before seeding. Sender, terminal export and integrated evidence remain in [Task 4](https://github.com/Maeximilion/MaexSocial/issues/165).

## Management audit retention (#305)

Use a new worktree fixture with cached images, the pinned runtime and only synthetic data.

```sh
npm run pilot:build
npm run pilot:up -- audit-retention
npm run pilot:migrate -- up
node dist/pilot/tests/pilot/audit-retention.js
npm run pilot:down
```

The drill generates seven security event classes through their private writers. The restricted fixture
owner supplies an exact incident disposition and the clock instant used by the writer. For a prepared
record, `npm run pilot:expire-audit-event -- <tenant-uuid> <audit-uuid>` uses PostgreSQL time.
A successful transaction deletes one online audit event and its disposition. A missing event or
disposition, held evidence, mismatched event instant or premature retry returns `ineligible`.
Unavailable disposition storage or mismatched fixture markers refuse the operation. PostgreSQL
serializes an incident decision and expiry on the same disposition row. Incident setup must confirm
that its write affected the exact live row. The maintenance CLI supplies no hold or release decision.

The elapsed interval is 2,160 hours from the recorded event. An eligible occurrence hold or approval
withdrawal leaves its tenant and occurrence keys and, for withdrawals, the exact approval key. The
application reads these decisions alongside live evidence and has no write grant on compact decisions.
An incident hold retains full detail. Dispatch claims and exports remain separate publication records.
Physical remnants, encrypted archives, external sinks and operating decisions are tracked in #166 and #82.

## Resolved dispatch detail retention (#282)

Create a dedicated fixture from a worktree without `work/pilot` using the installed locked dependencies
and cached Docker images. Run the empty schema drill before seeding:

```text
npm run pilot:build
npm run pilot:up -- dispatch-retention
npm run pilot:migrate -- up
npm run pilot:migrate -- down
npm run pilot:migrate -- up
node dist/pilot/tests/pilot/dispatch-retention.js
npm run pilot:down
```

The private owner command `npm run pilot:retire-dispatch-details -- <occurrence-id>` requires the
explicit fixture purpose and matching database identity. Use `pilot:up -- dispatch-retention` for a
retained restart. The command checks one exact occurrence and uses the AppDB clock. It reports
`retired`, `already-retired` or `ineligible`. The test alone supplies an exact synthetic expiry clock.
No ordinary or restored fixture is eligible. Pending, unknown, held, historically held, quarantined,
inconsistent and unrelated occurrences are excluded.

The first terminal reconciliation writes `resolved_at` from PostgreSQL time in the transaction
that commits the attempt and occurrence together. The claim and provider observation times
remain independent. A rolled-back reconciliation records no resolution time. Historical terminal
rows with no trustworthy local time retain their details. The threshold is 90 elapsed days
(2,160 hours) from the local terminal write.

After expiry the row keeps `tenant_id`, `occurrence_id`, terminal `outcome` and
`details_retired=true`. The attempt `id`, `approval_id`, `claimed_at`, `observed_at`,
`resolved_at` and synthetic `resource_name` become SQL NULL. The original composite primary key
and occurrence foreign key keep the claim attached to the stored occurrence. The marker is immutable.
The occurrence, original approval record and independent audit are preserved. The customer sees the
matching terminal result and that its dispatch details expired. A retired slot cannot authorize
reconciliation readback, a new claim or approval, or a manual text export. Its result is also separate
from the counting fake's deliberately independent state.

Migration down refuses populated fixtures, and the migration itself refuses to discard a retired
claim. Existing supported cold pairs can still be imported offline in the forward direction.
The current schema cannot be imported by earlier builds. Cold capture still uses its own new
backup fixture and excludes the fake. This drill covers the logical data in the dedicated fixture.
Physical erasure, restored-copy minimization, provider data rules, management audit expiry and
operating retention remain outside it. See [Task 5](https://github.com/Maeximilion/MaexSocial/issues/166)
and the [access and recovery contract](../../docs/17_ACCESS_SECURITY.md#data-recovery-and-rollback-proposals).

## Windows two-dimension charging evidence (#238)

For an ordinary Windows `npm run pilot:test`, record `git rev-parse HEAD` and whether the fixture is fresh or
restarted with retained volumes. If the `both dimensions charge on denial, absent accounts and separate flows`
case fails, retain its name and fixed diagnostic. A database diagnostic identifies the connection, query or
disconnect stage and includes the SQLSTATE when PostgreSQL supplied one. Errors in direct fixture queries carry
the `fixture query` label. The diagnostic identifies the future-attempt guard
when the driver context matches [migration 006](../../db/migrations/006_auth_throttle.up.sql). An application
diagnostic means the app returned `Throttle unavailable` without a driver error captured by the test. If the
isolated runner fails before the case reports a result, record the runner failure and leave the case unobserved.

Share only those fields and the suite result. Keep raw driver messages, SQL, parameters and fixture material
private. The existing rollback case checks that the second-charge trigger and the future-attempt guard report
distinct diagnostics for SQLSTATE `P0001` while the caller still receives `Throttle unavailable`. A passing run
is a control. The original failures in [#234](https://github.com/Maeximilion/MaexSocial/pull/234) and
[#237](https://github.com/Maeximilion/MaexSocial/pull/237) lack the driver diagnostic needed to attribute their cause.

## Internal account/source throttles (#154)

`createAuthThrottle(key, connect, flow)` is an **unmounted internal component**. The composition root fixes
`login`, `signup`, `recovery` or `resend`; `consume(account, trustedSourceIp)` returns a boolean only after its
own PostgreSQL transaction commits. `connect` must open a fresh client, never reuse another operation's
transaction. Authentication failure or later caller rollback does not undo a committed attempt. Missing/invalid
configuration, unavailable SQL, lock/statement timeout, key mismatch or capacity exhaustion throws only
`Throttle unavailable`; a future adapter must deny on either false or error. No account lookup, credential,
mail, provider, tenant, role or session action occurs here. This does not complete ACCESS-09, #131 or #149.

Login allows 5/account and independently 30/source in a moving 15-minute window. Signup, recovery and resend
each allow 3/account and 10/source in separate moving one-hour windows. At time `t`, the interval is `(t-W,t]`:
exactly `t-W` has expired. Sample `clock_timestamp()` as PostgreSQL text **after** acquiring transaction lock
`(154,1)`; preserve microseconds and use that same time for both charges. Both buckets are charged even when
either rejects, including unknown accounts. Keep only the latest L timestamps in each bucket: once there are
L more recent attempts, older attempts cannot affect any subsequent allow/deny decision. These are capped
decision histories, not full audit totals. Attempts stop blocking after sufficient inactivity; continued abuse
can continue to throttle, without setting a permanent identity lockout. Future stored timestamps fail closed.

The account boundary accepts ASCII mailbox syntax, at most 254 characters and 64 local-part characters,
trims outer ASCII space/tab/CR/LF and lowercases the whole mailbox. It rejects Unicode before folding,
malformed dot-local parts and domain labels; it does not strip plus-tags or dots. Future identity integration
must use this same account contract or explicitly revise it; international/quoted mailboxes remain unsupported.
Source accepts only a validated direct transport IP, canonicalizes IPv6 and collapses IPv4-mapped IPv6 to IPv4.
It rejects ports, zones, lists and hostnames. **The trusted transport adapter must supply the source**; this
module never reads forwarding headers, a request body or proxy configuration. NAT clients share the source
limit; rotating sources still shares an account limit. IPv6 prefix aggregation/proxy trust are not implemented.

Store only domain-separated HMAC-SHA256 bucket digests and timestamps. `pilot:up` writes 32 random bytes as
64 lowercase hex characters in private `work/pilot/throttle-key` only when initializing a new fixture. Keep
that file with the database across restarts and restores; do not print it, reuse another service's key or
generate a replacement on missing configuration. The persisted HMAC key binding rejects a different key even
when every bucket has expired. No reset/clear/rotation API exists. Future controlled rotation requires stopped
admission for at least the maximum one-hour window, verification that all buckets expired, authorized metadata
replacement and consistent key/database recovery. That operating procedure is not implemented or tested here.

Migration `up` refuses a missing or malformed throttle key **before opening a database connection**. Fixtures
created before this component lack that file and are not supported for in-place upgrade to 006. Stop the old
fixture with `npm run pilot:down`, preserve its complete `work/pilot/` directory under a distinct ignored name
and retain its volumes; then run `npm run pilot:up` to initialize a new namespace/key and migrate the fresh
fixture. This does not transfer old data or reset an existing binding. A missing key after binding likewise
denies; recover the original key with its database. The guarded `down`/recovery path is unchanged.

The single global lock and maximum 4096 buckets intentionally bound this small local component. The transaction
rolls back both new charges if capacity would exceed 4096; availability can be exhausted by many distinct pairs.
The private SQL charging helper is an invoker-privilege primitive, not a safe external API: it requires the
global lock and post-lock database time. Only the Node component orchestrates the complete key/cleanup/capacity
contract. Do not call that helper directly from an authentication adapter.

Consumption and explicit `cleanup()` physically DELETE expired bucket rows under the same lock; neither
deletes the key binding. There is **no timer**: inactive expired rows remain until an operation runs. PostgreSQL
DELETE is logical row removal, not secure erasure of heap/WAL/backups. Public integration must supply bounded
timed cleanup, monitoring, trusted source provenance, identity normalization and operational key recovery,
while retaining the [product retention/deletion contract](../../docs/17_ACCESS_SECURITY.md#data-recovery-and-rollback-proposals).
Global contention, finite capacity, ASCII scope and operation-driven cleanup are deliberate local limitations.

Migration 006 adds only the two throttle tables, expiry index and internal SQL helper. The fixture down runner
still refuses any populated table, including a key binding. Direct down removes throttle history and binding;
never use it to recover a live admission service. Tests use invented data and owner-only SQL for deterministic
exact-microsecond boundary setup, future/expired timestamps and injected failure. The Node API exposes no clock.
Real clients/processes prove independent counters, rollback, normalization, key mismatch, capacity and post-lock
time. A retained exhausted canary is checked on the second full-suite run after `pilot:down`/`pilot:up`.

Run `npm run pilot:build` before `node --test dist/pilot/tests/pilot/auth-throttle.test.js`, then the full pilot
and retained-volume restart commands above. These checks establish this bounded internal component only;
public response timing/equivalence, lifecycle, MFA authority and G3/G5 remain unproven.

## Synthetic business facts (#153)

After the strict build and migrations, `node --test dist/pilot/tests/pilot/facts.test.js` runs actual HTTPS/PostgreSQL checks for the protected facts list/detail routes. Invented A/B facts and historical Manager evidence are inserted only with `connectFixture(true)` in the private test harness. The app connection has SELECT-only access to the new table. No facts are inserted by public requests or startup, and no real customer confirmation/MFA is claimed.

The suite covers both reader roles, shared identities, latest revision per location, empty states, escaped hostile content, Unicode/newline bounds, composite references, historical confirmation, write denial, current authority and unchanged domain records. A transactional migration005 down/up compatibility probe rolls back its metadata loss; complete down remains restricted to empty fixtures. Run a fresh up/down/up before seeding. Preserve populated fixtures and their volumes.

The existing keyboard suite follows workspace → facts → location → empty location → drafts, with customer-only requests. Its private screenshot is `work/portal-preview/facts.png`. Run the complete pilot before and after `pilot:down`/`pilot:up` with retained volumes. [Detailed contract](../../docs/superpowers/plans/2026-11-06-task-2-deliveries.md#synthetic-business-facts-153) and [handover](../../docs/handovers/sessions/2026-11-18-business-facts.md) separate these synthetic checks from #124/#131 and product gates.

## Customer publication outcomes (#214)

Employees and Managers read the details of an occurrence in their active workspace via the existing draft
destination link. The GET reads the occurrence and its tenant-bound attempt in the same statement and does
not refresh session activity. Processing, rejection and publication confirmation require a matching approval,
stored outcome and observation time. A missing or conflicting dispatch record stays unknown. A quarantined
occurrence stays under review, even when historical evidence is present. The attempt
start and last observation display in UTC only when each time is recorded. The due time remains distinct,
with its UTC instant and occurrence-local time. Export is terminal for automatic submission. It represents
manual handoff of the approved text with no Google publication confirmed.

After the strict build and fixture migration, run
`node --test --test-concurrency=1 dist/pilot/tests/pilot/occurrences.test.js dist/pilot/tests/pilot/portal-keyboard.test.js`.
The HTTPS suite seeds independent stored states, checks both roles and active-tenant isolation, and compares
domain and session rows across the reads. Chromium follows the existing keyboard path to an unknown result
and back. The suite uses invented rows and no provider calls. [#165](https://github.com/Maeximilion/MaexSocial/issues/165)
owns the integrated Task 4 evidence.

## Private Employee invitation preview (#207)

After the strict build and fixture migration, run `node --test dist/pilot/tests/pilot/invitation-browser.test.js`.
The isolated browser fixture mounts the preview for current synthetic customer sessions with a server-owned
subject-to-recipient binding. It seeds invitations and supplies their credentials in a secure HTTP-only cookie.
The regular customer app has no preview mount. A matched recipient using one workspace can see the workspace and
Employee role of their pending invitation to another. Invalid or unrelated invitations receive the same unavailable
view. The test checks real HTTPS and PostgreSQL, keyboard navigation, reload, mailbox counts, unchanged rows and
the absence of token or recipient email in rendered messages and observed application/browser logs.

[#221](https://github.com/Maeximilion/MaexSocial/issues/221) owns authenticated link delivery, real identity
proof and invitation acceptance. The fixture does not issue links, consume credentials or grant access.

## Private Employee invitation issuance (#209)

After the strict build and fixture migration, run `node --test dist/pilot/tests/pilot/invitation-issue.test.js`.
The private `issueEmployeeInvitation` operation runs in the isolated runner. Its server-owned callback
validates and locks the current customer context on the operation's transaction. The operation checks
fresh enrolled Manager MFA, binds the normalized recipient and current workspace and issuer, and stores a
24-hour Employee invitation using only the token hash. An unexpired pending invitation blocks
a second issue for the same workspace and recipient across both roles and issuer types. An invitation
stops blocking a new issue once its issuer version advances past the stored version. An explicit resend
supplies the previous ID and the same recipient. Resend retires the previous unconsumed invitation and advances the grant version
in the same transaction. Concurrent operations for the same workspace and recipient are serialized.

After commit the runner submits a single message over certificate-verified HTTPS to the local Mailpit
sink. Only the mailbox receives the raw token, in the fixture preview URL fragment. The private result
returns the invitation ID and whether capture was confirmed. An unconfirmed reply can be handled by
explicitly replacing that ID. The test inspects the actual mailbox message, the preview lookup,
both invitation generations and unchanged memberships.
[#221](https://github.com/Maeximilion/MaexSocial/issues/221) owns authenticated link handling and acceptance.

## Private DEV/Admin invitation issuance (#261)

The same `invitation-issue.test.js` exercises the private management operation on a newly created
organization and a control tenant. The trusted context binds the action, current organization,
normalized recipient and intended Manager or Employee role. The operation checks the verified
identity, device, platform grant and fresh phishing-resistant proof before committing the
platform-bound pending invitation and audit together. The audit records the actor, device,
organization, reason and selected role without storing the recipient address or invitation token.

Mailpit capture follows commit. An unconfirmed capture leaves the invitation pending. An explicit
resend with the same tenant, recipient, role and current issuer retires the previous ID in the
transaction. The existing recipient-bound read-only preview displays the stored role and organization
and requires a current issuing grant or Manager membership. Account provisioning and invitation
acceptance remain with [#131](https://github.com/Maeximilion/MaexSocial/issues/131) and
[#221](https://github.com/Maeximilion/MaexSocial/issues/221).

## Private Employee membership revocation (#210)

After the strict build and fixture migration, run `node --test dist/pilot/tests/pilot/employees.test.js`. The test invokes
`revokeEmployeeMembership` in a real PostgreSQL transaction using seeded Manager and Employee sessions.
The private entry point takes only a target membership ID, an already parsed customer request binding and
server-owned fixture dependencies. The actor's locked session selects the tenant. The fixture supplies a
canonical recipient email for the locked target subject. Missing bindings deny the removal.

The transaction locks both identities in order, then the tenant, memberships and actor session. The exclusive
tenant lock serializes the invitation update with issuance using the tenant authority lock. The operation checks
current Manager authority, stored CSRF, enrolled proof up to five minutes old and the current Employee role.
It disables the selected membership, advances its version, cancels that recipient's unexpired, unconsumed
and unrevoked Employee invitations in the tenant, and records one activity with actor and target membership
in append-only audit. Failure rolls back the writes. Repeating a committed removal returns false.

The protected HTTPS read denies the previous session for the removed membership. Another active membership
of the same identity remains usable. The [authenticated integration](https://github.com/Maeximilion/MaexSocial/issues/221)
owns real identity/MFA and recipient binding, invitation redemption and the public Manager mutation.

## Local pilot candidate manifest (#220)

From the repository root, use Python 3.12+, Git with the candidate commit available locally,
Docker Compose, and a GitHub CLI session with Actions read access. The [example record](candidate-example.json) covers
commit `bb281b2c1ed3f181a3823ab183c9b6939dfd3b4b` and migration `008_attempt_resource`.
Its [Foundation attempt](https://github.com/Maeximilion/MaexSocial/actions/runs/45011395093/attempts/1)
and [pilot attempt](https://github.com/Maeximilion/MaexSocial/actions/runs/45011395106/attempts/1)
both succeeded on that exact main push. The pilot includes the empty migration up/down/up drill,
storage suite and retained-volume restart.

Create the ignored `work/` directory if needed. Capture writes JSON to stdout after both checks pass.

```text
python scripts/pilot_candidate.py capture bb281b2c1ed3f181a3823ab183c9b6939dfd3b4b https://github.com/Maeximilion/MaexSocial/actions/runs/45011395093/attempts/1 https://github.com/Maeximilion/MaexSocial/actions/runs/45011395106/attempts/1 > work/pilot-candidate.json
python scripts/pilot_candidate.py verify work/pilot-candidate.json
python scripts/pilot_candidate.py verify ops/local/candidate-example.json
python -m unittest discover -s tests -p test_pilot_candidate.py -v
```

The SHA-256 values cover committed Git blob bytes for the Node and Compose fixture inputs, the
fixture setup and migration runner, and every paired up/down SQL file. Docker Compose renders the
committed configuration to verify the digest-pinned image reference for each service, including
the profiled runner. The final migration prefix and name identify the candidate schema. Verification
fails for a changed digest or image pin, wrong migration revision, missing proof or proof for a
different commit. An unavailable Actions attempt also fails verification.

The format-1 record leaves the authorized target, promotion identity, deployable and rollback
artifact digests, signature evidence and release approval as explicit nulls. [#82](https://github.com/Maeximilion/MaexSocial/issues/82)
retains the separately authorized staged assessment and release decision.

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

`node --test dist/pilot/tests/pilot/drafts.test.js` verifies #140's existing-text editor on the actual protected HTTPS app, using only test-created AppDB sessions and synthetic identity status. The standard keyboard test also navigates to a seeded 1500-character multiline draft, saves it unchanged, edits text and verifies all three persisted revisions; its additional private screenshot is `work/portal-preview/draft.png`. No new launcher/login/fixture issuer exists. [The draft lock and invalidation contract](../../docs/superpowers/plans/2026-11-06-task-2-deliveries.md#existing-text-editing-140) must also be used by later claim/approval implementations. The unexplained earlier browser observation remains #137; a successful run here does not close it.

Migration 002 adds only session CSRF, tenant version and synthetic factor binding. The unmerged experimental lifecycle schema is not an upgrade target: preserve old investigative fixtures and initialize a fresh namespace. No migration deletes populated fixture data. Pushed source/private checkpoints retain experiments without delivering executable lifecycle contracts.

## Read-only identity status (#136)

`createIdentityInspector` in [identity.ts](../../apps/web/src/server/identity.ts) implements A1's existing `InspectIdentity` contract. Only server composition supplies the fixed pilot issuer, client credentials and trusted CA. There is no runtime launcher, public token issuer, authentication callback or fixture-login route. The test harness alone seeds application sessions.

A **fresh** fixture imports two credentialless synthetic users (enabled/disabled), a dedicated `pilot-status` service principal and a roleless negative-control principal. Random client secrets and the generated realm stay in ignored `work/pilot/`, with restrictive creation permissions. The existing static realm remains the closed public-client baseline. Preserve any earlier fixture and its volumes before starting a new namespace; importing this source does not update existing realms. Before invoking Docker, `pilot:up` rejects a missing/non-file realm import with instructions to preserve old data and initialize a fresh fixture. The bind also sets `create_host_path=false`, but startup safety does not rely on that backend setting alone. No Admin REST write or customer credential change is performed.

The status principal receives only `realm-management/view-users`, with matching client scope mapping and `fullScopeAllowed=false`. Its built-in composite includes `query-users` and `query-groups`; it has realm-wide user/group read authority, not field-level or per-user permissions. This is accepted only for the isolated synthetic pilot realm. Both clients have the built-in `kc-admin-api` scope so Keycloak can enforce its Admin API audience; this grants no management role. The roleless control must authenticate successfully and then receive HTTP 403 on user inspection.

Pinned Keycloak **26.8.2** evidence:

- [UserResource](https://github.com/keycloak/keycloak/blob/26.8.2/services/src/main/java/org/keycloak/services/resources/admin/UserResource.java): `getUser` and `credentials` require `requireView(user)`; the credentials endpoint removes `secretData`.
- [UserPermissions](https://github.com/keycloak/keycloak/blob/26.8.2/services/src/main/java/org/keycloak/services/resources/admin/fgap/UserPermissions.java): `view-users` satisfies the direct read; `query-users` alone does not. No management role is needed.
- [Service accounts](https://github.com/keycloak/keycloak/blob/26.8.2/docs/documentation/server_admin/topics/clients/oidc/proc-using-a-service-account.adoc): token roles are the intersection of service-account roles and client scope mappings.
- [Admin API audience](https://github.com/keycloak/keycloak/blob/26.8.2/docs/documentation/server_admin/topics/admin-console-permissions/admin-api-audience.adoc): custom clients also need `kc-admin-api`, which supplies the fixed API audience and scope. The audience check stays enabled.

The adapter makes exactly one client-credentials POST to `/realms/pilot/protocol/openid-connect/token`, then GETs `/admin/realms/pilot/users/{subject}` and that user's `/credentials`. One five-second deadline covers DNS, TLS, headers and bodies across all three requests. Each response is limited to 64 KiB, headers to 8 KiB, each list to 32 entries, IDs to 255 characters and action/type labels to 128. TLS verification, exact immutable-subject matching, required boolean/array validation, UTF-8/JSON validation and unique credential IDs precede the minimal DTO projection. Unknown nonempty required actions remain visible to A1 and cause denial. Unavailable, malformed, mismatched, denied, oversized or partial responses fail with a fixed error; no raw body, token, secret, retry, redirect or cache is exposed.

Run `node --test dist/pilot/tests/pilot/identity-status.test.js` after the build and fresh fixture migration. The suite distinguishes real local Keycloak/guard checks from controlled HTTPS responses. The latter cover invalid/missing fields, mismatch, denied requests, partial failures, exact/over limits, TLS rejection and a delayed/trickling response under the shared deadline. HTTP status observation records numbers only, never response bodies or tokens.

These are two separate provider reads, **not an atomic lifecycle snapshot**. Enrollment does not prove factor use, MFA time, recovery generation, lifecycle completion or permission to issue an application session. The status-test identities contain no factors; their successful status read still fails Manager MFA. #131 retains all real authentication/MFA/recovery obligations; #123/#124, Task 3 and G3/G5 remain dependent on them. #137's earlier browser observation remains unresolved.

## Private OIDC verification (#139)

[oidc.ts](../../apps/web/src/server/oidc.ts) is an unmounted server component. `createOidcVerifier(config, connect)` takes trusted server configuration and a factory that opens a **new** PostgreSQL connection per operation. It never commits a caller's transaction. `start()` returns the authorization URL and a random browser binding for a host-only Secure/HttpOnly/SameSite=Lax cookie. Without the separate step-up configuration below, `complete(callbackUrl, browserToken)` returns only `{issuer, subject}`. Ordinary sign-in returns no token, email, MFA time, lifecycle completion, customer admission or application session. No customer application route imports this module.

The fixed pilot issuer supplies only its `/protocol/openid-connect/auth`, `/token` and `/certs` endpoints. Configuration requires HTTPS, the exact `/oidc/callback` path and a trusted CA; discovery, caller-selected endpoints and callback redirect parameters are rejected. The frozen client configuration and callback are hashed into each attempt. The verifier uses pinned [oauth4webapi 3.8.8](https://github.com/panva/oauth4webapi/tree/v3.8.8), including mandatory `validateApplicationLevelSignature` in addition to claim validation. It requires RS256, exact issuer, customer client audience, authorized party whenever present (and for multiple audiences), expiry with zero clock tolerance, nonce and nonempty bounded immutable subject. Issued-at must be an integer no later than the current time; it is **not MFA time**. State, nonce and PKCE S256 are generated independently for every attempt.

Migration 003 stores SHA-256 state/browser/config bindings, a nonce and verifier, and database creation/expiry times. Its constrained primary key permits at most **256 rows**, including expired rows. The normal five-minute lifetime is generated by PostgreSQL; the application role cannot write either time or update secrets/bindings. Starts serialize capacity allocation and remove expired rows. Completion locks only the matching state/browser/config row, checks the database clock after any wait, deletes it and **commits before** contacting the provider. Parallel callbacks on independent connections have at most one winner. Wrong bindings do not consume a valid attempt. Exchange failure, denial or a crash after consumption requires a new start; there is no automatic exchange retry.

`cleanup()` and well-formed start/complete operations physically remove expired rows. **Five minutes is a logical validity bound, not a physical deletion guarantee:** while idle, expired rows remain until the next cleanup. No daemon is installed for this unmounted component. #131 must integrate time-driven cleanup and its operating/retention evidence before public operation. A full store denies new starts until capacity is available. There is no eviction of valid attempts and no second session platform.

One five-second deadline covers the token request and any JWKS fetch, including DNS/TLS, headers and bodies. Each response is limited to 64 KiB and headers to 8 KiB. Only expected methods and exact endpoints are used; redirects, non-200 responses, compression, invalid UTF-8/JSON and partial responses fail closed. Errors expose only `OIDC unavailable`, with no provider body or nested cause. Access/refresh/ID tokens and exchange secrets are never persisted or logged by the component. The library implements JOSE verification; no application signature verifier is added.

A fresh `pilot:up` import creates a separate confidential `pilot-oidc-test` client: exact `https://customer:8443/oidc/callback`, Standard Flow, mandatory S256, RS256, no direct/implicit/service-account flows, no management roles or wildcard redirects, and only the `openid` request scope. Product `pilot-customer`/desktop clients remain disabled. An invented verified user receives a privately generated **initial** password during that first import. Generated client secret, password and realm stay under ignored `work/pilot/`; no Admin REST credential update is used. Existing realms and prior fixture volumes are not upgraded: preserve them and use a fresh namespace.

```text
npm run pilot:build
node --test dist/pilot/tests/pilot/oidc.test.js
node --test dist/pilot/tests/pilot/oidc-browser.test.js
```

The protocol suite uses controlled HTTPS responses and real PostgreSQL, not a mock attempt map. It covers signature/claim failures, fixed endpoints/TLS, JWKS failure, combined network deadline, response bounds, six concurrent callbacks, wrong binding/replay, expiration after a real row-lock wait, concurrent allocation at capacity, and physical cleanup. It verifies committed consumption from a different connection inside the controlled token endpoint.

The separate **real Keycloak browser** test reuses the isolated Playwright harness. Its worker receives only public customer/Keycloak certificate pins, no private key or fixture manifest. A test-only same-origin POST sets the browser binding; the ordinary provider form performs sign-in. The test-only callback pauses the first browser before verification, rejects a second browser with its own binding, then releases the first: exactly one real exchange, only the expected issuer/subject, no app session and rejected replay. `/verified` is the only fixed harness return target. Product auth/signup/recovery/MFA routes remain closed. Neither this test nor its synchronization touches provider credential mutations or identity-database locks.

Local diagnostic history: Playwright URL routing did not intercept the provider's redirected callback even though the harness reached `/verified`. A bounded diagnostic established that observation; the test now synchronizes at its own HTTPS callback handler instead of relying on redirect interception. The earlier #137 empty-title observation did not recur and is not declared fixed. Sanitized outcomes belong in evidence; callback query strings, cookies, codes, passwords and tokens do not.

Protocol sources: [OIDC Core §3.1.3.7](https://openid.net/specs/openid-connect-core-1_0.html#IDTokenValidation), [RFC 7636](https://www.rfc-editor.org/rfc/rfc7636), [Keycloak 26.8.2 client settings](https://github.com/keycloak/keycloak/blob/26.8.2/docs/documentation/server_admin/topics/clients/oidc/con-basic-settings.adoc), [pinned signature API](https://github.com/panva/oauth4webapi/blob/v3.8.8/docs/functions/validateApplicationLevelSignature.md). #131 retains full login/admission, MFA, recovery and lifecycle guarantees; #123/#124 integration, Task 3 and G3/G5 remain open.

## Private confirmed-browser logout (#147)

The [accepted contract](https://github.com/Maeximilion/MaexSocial/issues/147) preserves `POST /customer/logout`, its Origin/exact-form/CSRF checks and identity/session lock order. The normal two-argument `createCustomerApp` remains local-only. Only the isolated browser test supplies the third, server-owned configuration: issuer `https://keycloak:8443/realms/pilot`, client `pilot-oidc-test`, and `postLogoutRedirectUri: 'https://customer:8443/'`. Any other value fails during composition. The redirect is copied then; later caller mutation or request fields cannot change it.

Local revocation must commit before clearing both host cookies and returning the provider redirect. No backend provider call, ID-token hint, logout token, additional provider privilege or public auth route is added. Private mode permits only the fixed logout endpoint in `form-action` so Chromium accepts the form's redirect; the default CSP is unchanged. The #139 client's exact post-logout allowlist is imported only into a **fresh** fixture; existing volumes/configuration are preserved. The separate #143 flow remains unchanged.

Run `npm run pilot:build`, `node --test dist/pilot/tests/pilot/logout.test.js`, and `node --test dist/pilot/tests/pilot/oidc-browser.test.js`. The first covers rejected configuration/CSRF/Origin/request overrides, copied config, actual PostgreSQL rollback on an injected commit failure, both expired cookies and replay denial before provider contact. The browser test verifies fresh state/nonce/PKCE-bound silent SSO before logout, a visible confirmation abandoned without confirming, and an explicit confirmation followed by fresh `prompt=none` returning `login_required`. App-cookie replay is denied throughout. Because Playwright does not intercept redirected requests, the controlled connection-failure case retains the real same-origin POST response and faults the subsequent initial provider navigation. It does not claim a real provider outage.

The pinned confirmation has no Cancel button; navigating away is the tested cancellation. The existing root signed-out page neither creates authority nor attests provider success, including forged return parameters. Synthetic AppDB authority and real browser SSO are seeded separately: this proves logout of the explicitly confirmed browser only, not product subject/session binding, global revocation, MFA generation or recovery completion. #131, integrated Task 2 and G3/G5 remain open. [Delivery evidence](../../docs/handovers/sessions/2026-11-17-private-logout.md) records the checks and retained limits.

Sources: [RP-Initiated Logout](https://openid.net/specs/openid-connect-rpinitiated-1_0.html#RPLogout), [Keycloak 26.8.2 endpoint](https://github.com/keycloak/keycloak/blob/26.8.2/services/src/main/java/org/keycloak/protocol/oidc/endpoints/LogoutEndpoint.java), [confirmation template](https://github.com/keycloak/keycloak/blob/26.8.2/themes/src/main/resources/theme/base/login/logout-confirm.ftl).

## Private enrolled-factor evidence (#143)

The [accepted contract](https://github.com/Maeximilion/MaexSocial/issues/143#issuecomment-6956386079) extends the same verifier and migration-003 attempt store. Set trusted server-only `stepUp: { expectedSubject, policy: 'keycloak-26.8.2-enrolled-otp-v1' }` when composing the dedicated client. Never take these values from customer HTTP fields. The copied configuration hash includes purpose, expected subject, exact ACR and policy; ordinary and differently bound attempts cannot become step-up.

A fresh import adds `pilot-step-up-test` and the [dedicated flow](keycloak-step-up.json), plus two invented users: one initially enrolled with OTP and one password-only. Initial random passwords, client secret and OTP seed stay in ignored `work/pilot/`; no credential is updated during the experiment. Existing fixture directories/volumes are never upgraded automatically. Preserve them and initialize a new isolated fixture for this test. Keycloak remains pinned to 26.8.2 and its existing image digest.

The dedicated flow orders password LoA1 before required OTP LoA2, uses `loa-max-age=0` at LoA2, disables `CONFIGURE_TOTP` itself, and has no alternate factor, inline enrollment or client-policy flow substitution. It requests essential ACR `2` and uses `oidc-acr-mapper` for the signed ID token. The browser test reads the actual imported flow, levels, disabled action, client binding and policies through a read-only fixture-owner connection; this is test-only configuration inspection, not a new application IdP permission.

This policy is valid **only in the newly initialized controlled fixture with no other flow/client assigning reusable LoA2**. Keycloak's `AcrStore` accepts a previously stored level when its timestamp plus max age equals the current second; therefore max age zero alone is not a universal freshness guarantee. This flow never stores level2 for later authentication. Browser evidence must show a new OTP challenge after prior high-ACR SSO without `prompt=login`. The test waits for the next actual 30-second TOTP period before each submission because the provider disallows code reuse; it never retries a rejected code.

After mandatory signature/claim checks, the verifier requires exact subject and string ACR `2`. It samples PostgreSQL time in a new short operation after verification and requires `created_at <= now < expires_at <= created_at + 5 minutes`. The attempt was deleted and committed before any token/JWKS request. The private receipt contains only `issuer`, `clientId`, `subject`, `policy`, `acr`, `factorTimeLowerBound`, `verifiedAt` and `validUntil` (the three times are Dates). `factorTimeLowerBound` is the original attempt creation time, not an asserted exact OTP time; new factor execution occurs after it. `validUntil` remains the original expiry, never callback time plus five minutes. A receipt is evidence of this event, not current enrollment/recovery state or authority to act. Any later consumer must check expiry and lifecycle generation at use; #131 owns that bridge and A1-compatible representation. No consumer or public authentication route is added here.

Run after a fresh fixture and migrations:

```text
node --test dist/pilot/tests/pilot/oidc-step-up.test.js
node --test dist/pilot/tests/pilot/oidc-step-up-browser.test.js
npm run pilot:test
```

The controlled HTTPS/real PostgreSQL suite covers exact signed ACR, issuer/client/subject/nonce/policy/browser binding, signature rejection, configuration mutation, ordinary-mode separation, cancellation/replay, post-lock and post-verification expiry, original receipt lifetime and concurrent single use. The actual Keycloak browser test covers enrolled success, repeated SSO requiring OTP, unenrolled rejection without setup, first-factor-only rejection, unchanged application session count and closed product auth routes. Browser-test teardown cancels its outstanding private attempts through the same verifier; normal expired-row cleanup retains #139's operation-driven limits.

Pinned sources: [step-up configuration](https://www.keycloak.org/docs/26.8.2/server_admin/#_step-up-flow), [conditional LoA](https://github.com/keycloak/keycloak/blob/26.8.2/services/src/main/java/org/keycloak/authentication/authenticators/conditional/ConditionalLoaAuthenticator.java), [cached levels](https://github.com/keycloak/keycloak/blob/26.8.2/services/src/main/java/org/keycloak/authentication/authenticators/util/AcrStore.java), [cookie execution](https://github.com/keycloak/keycloak/blob/26.8.2/services/src/main/java/org/keycloak/authentication/authenticators/browser/CookieAuthenticator.java), [required-action guard](https://github.com/keycloak/keycloak/blob/26.8.2/services/src/main/java/org/keycloak/authentication/DefaultAuthenticationFlow.java), [OTP validation](https://github.com/keycloak/keycloak/blob/26.8.2/services/src/main/java/org/keycloak/authentication/authenticators/browser/OTPFormAuthenticator.java), [ACR mapper](https://github.com/keycloak/keycloak/blob/26.8.2/services/src/main/java/org/keycloak/protocol/oidc/mappers/AcrProtocolMapper.java), [historical AMR](https://github.com/keycloak/keycloak/blob/26.8.2/services/src/main/java/org/keycloak/protocol/oidc/mappers/AmrProtocolMapper.java).

See the [delivery checkpoint](../../docs/handovers/sessions/2026-11-17-fresh-factor.md) for executed results and limitations. #131/#123/#124, integrated Task 2 and G3/G5 remain open. No platform-admin phishing-resistant MFA claim, excluded credential/IdP-lock evidence, real account, deployment or product gate is supplied.
