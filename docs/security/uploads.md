# Upload and media-processing security

Status: proposed G2 contract, [MS-014 / #43](https://github.com/Maeximilion/MaexSocial/issues/43). No customer upload endpoint, media worker or production storage exists yet. Repository artwork validation is implemented separately and does not establish service security.

## Threat model and default

An uploaded SVG can contain active browser content. Restricted image embedding differs from direct document navigation or `object`/`iframe` embedding; parser flaws and resource exhaustion create separate processing risks. The impact depends on origin, credentials and process isolation, not the filename alone. [MDN SVG image contexts](https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_as_an_image)

Proposed first release: reject customer SVG/SVGZ and other active document formats, including renamed files and false MIME declarations. Select a small raster/video allowlist at G2 and validate actual content through bounded decoding. SVG support would need its own design and tests. File extensions and client-provided content types are not security proof. Layered validation, storage and processing controls follow [OWASP's upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).

## Required processing contract

1. **Authorize and quarantine.** Check tenant, upload authority and quota before accepting bytes. Store originals privately under generated keys; filenames and metadata are untrusted data. Quarantined content cannot be previewed, publicly retrieved, sent to a provider or used in a paid job.
2. **Bound actual decoding.** Fix encoded/decoded byte, pixel/dimension, duration/frame, concurrency, memory and time limits. Choose maintained decoders, validate signatures and decoded content, and reject unsupported, ambiguous or malformed files. Scanning can supplement these checks, not replace them. Treat derived/provider media as untrusted at the same boundary.
3. **Isolate processing.** A restricted worker receives only the intended object and output destination. No application session, admin/database/provider credential, privileged filesystem or unrestricted network access. Rasterization/transcoding is itself an attack surface. G2 must choose the concrete sandbox, egress policy and patching process.
4. **Promote verified outputs.** Publish previews only from allowed, successfully validated derivatives. Define metadata stripping and provenance. Apply tenant checks to originals, thumbnails, derivatives, jobs and replacements. Handle partial processing, quota reservation, deletion, retention and dependent scheduled content explicitly.
5. **Deliver safely.** Never inline arbitrary original documents on the authenticated application origin. For allowed original downloads specify exact content type, attachment disposition and `X-Content-Type-Options: nosniff`. Use a media origin without application cookies where appropriate, while retaining private access control. Define signed-link scope, expiry and revocation bounds; a public URL is not tenant authorization.
6. **Constrain retrieval.** If URL ingestion is enabled, allow only selected schemes/destinations, enforce time/byte/redirect limits and block private, loopback, link-local and metadata addresses across DNS resolution and redirects. Apply this to provider outputs too. Do not let a model choose unrestricted fetch destinations.

Audit acceptance, rejection, promotion, access and deletion without recording secrets or raw private content. A platform administrator needs separate explicit authority and a target-customer audit trail; uploading never authorizes publishing or spending.

## Proposed acceptance cases — not executed against an application

| ID | Input or sequence | Required result |
|---|---|---|
| UPLOAD-01 | SVG/SVGZ, SVG renamed PNG, false MIME, HTML/polyglot or unsupported content | Reject before preview, provider handoff or paid processing |
| UPLOAD-02 | Malformed file, excessive dimensions/duration, decode bomb or concurrent quota exhaustion | Bounded rejection, resource limits enforced, no worker/app outage |
| UPLOAD-03 | Quarantined original requested through direct URL, preview, job API or provider handoff | No retrieval, promotion or external processing before validation |
| UPLOAD-04 | Tenant A changes B's original/thumbnail/derivative/job ID, upload key or replacement target | No cross-tenant disclosure or mutation; authorized same-tenant control case passes |
| UPLOAD-05 | Traversal/control characters in filenames, metadata or storage key input | Generated safe keys; no path escape, response-header injection or executable metadata |
| UPLOAD-06 | Direct navigation, image, iframe/object preview and allowed original download | No active original on application origin; intended private access, MIME, attachment and nosniff behavior verified |
| UPLOAD-07 | Decoder tries to read app secrets, write outside its output scope or contact disallowed networks | Runtime restrictions deny access; per-job authority and resource limits verified in staging |
| UPLOAD-08 | URL redirects/DNS changes to loopback, private, link-local or metadata endpoint; oversized provider output | Retrieval blocked or bounded, including each redirect; no credential leakage |
| UPLOAD-09 | Reuse an expired/revoked signed link, delete an asset with derivatives and scheduled use | Accepted revocation/retention bounds enforced across all objects; dependent jobs cannot use unauthorized content |
| UPLOAD-10 | Duplicate job, processor crash or rejected derivative followed by retry | No premature promotion/paid handoff; visible failure, bounded retry and quota reservation recovery |

MS-014 settles numerical limits and delivery/isolation decisions with [MS-013 access design](../17_ACCESS_SECURITY.md). MS-009 maps accepted cases into executable tasks. Require relevant tests before externally accessible uploads in G3, and extend them for the G4 provider pipeline. Successful repository checks do not close this task.

## Current repository artwork boundary

`scripts/svg_policy.py` checks the narrow inert SVG subset used by original brand artwork through `scripts/check_repo.py` and required foundation CI. Hostile fixtures are parsed, never rendered. `.svgz` is unsupported. The policy is not a general-purpose sanitizer and must never be reused as customer upload approval. A PR can change both artwork and its checker, so review remains necessary. See the implementation and regression tests for exact limits and accepted elements.

The 2026-11-05 baseline audit found no active content in the five existing SVG assets and no deployed upload path to test. It found the missing artwork check by passing an `onload` fixture through the old checker. No offensive remote test, full Git-history secret scan or production penetration test was performed.
