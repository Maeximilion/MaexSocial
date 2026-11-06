# Architecture and accepted local baseline

Status — Maxi accepted the bounded local design with a synthetic Google adapter, PostgreSQL, Keycloak and a separate signed Windows client on 2026-11-06. The [owner decision](https://github.com/Maeximilion/MaexSocial/issues/15#issuecomment-6681723454) separately authorizes local synthetic implementation after the decision-record merge. #10/#82 retain real operating evidence; production deployment remains unauthorized.

[ADR 0001](decisions/0001-application-language.md) records the language decision and trade-offs. Use strict TypeScript for the portal and Node.js API/worker, PostgreSQL SQL for migrations and C#/.NET with WPF for the Windows administrator. Python maintains repository tooling. Use the accepted MS-009 plan and wait for the decision-record merge and coordinator dispatch.

## Candidate responsibilities

The [proposed application anatomy](architecture/README.md) maps these responsibilities to a minimal directory layout and trust-boundary diagram. No application folders or deployment isolation are implemented by that proposal. [MS-014](https://github.com/Maeximilion/MaexSocial/issues/43) is accepted for text-only scope with media disabled; #99 carries later [upload/processing evidence](security/uploads.md).

| Responsibility | Owns | Evidence needed before implementation |
|---|---|---|
| Workspace and brand | Tenant boundary, approved business facts, assets and voice | First customer and account model |
| Identity and access | External login, sessions, customer membership and separate platform authority | Approved role/action matrix, authentication and recovery decisions |
| Platform administration | All-customer overview and approved management operations | Explicit privileged access, target-customer context and audit contract |
| Content orchestration | Brief, generation jobs, revisions, policy checks | First channel content contract |
| Publication | Schedule, durable intent, channel result and reconciliation | Official API capabilities and permission model |
| Provider adapters | Authentication, requests, rate limits, error translation | Selected providers and current documentation |
| Media jobs | Source provenance, render lifecycle, outputs and costs | Image-to-video provider evaluation |
| Observability | Evidence of actions, cost, errors and stop controls | Pilot success and failure criteria |

The first slice should cover one complete workflow through these responsibilities. Modules should be introduced when needed by that slice, with business decisions separated from provider transport.

## Design invariants

- Every action is scoped to a workspace and account. Model output cannot select an unauthorized account.
- Customer and platform-administration permissions are checked server-side. Tenant context extends to jobs, media, files and exports. Platform administration uses explicit authority with an auditable target customer.
- Publication authority is an explicit versioned policy. Draft approval and autonomous policy approval are distinguishable.
- External writes use durable intent, idempotency where supported and reconciliation where the provider result is ambiguous.
- Authentication secrets stay outside prompts, logs and repository files.
- Validate external inputs and provider/model outputs at runtime. Compile-time types do not establish data validity or tenant authorization.
- Cost limits apply before external generation and publication-related purchases. Concurrent jobs share the same budget authority.
- A stop control prevents new work and documents treatment of already accepted provider jobs.

## G2 decision record

[ADR 0002](decisions/0002-google-text-pilot.md) preserves the delivery comparison, historical Frankfurt estimate and recovery requirements. Maxi accepted the local architecture and MS-009 plan in the [G2 decision](https://github.com/Maeximilion/MaexSocial/issues/15#issuecomment-6681723454); production hosting and costs remain in #10.

Use the accepted local application boundaries and six-task MS-009 plan. API/MCP capabilities and live provider operation still require their own evidence; local acceptance authorizes neither production deployment nor provider access.

[Access and security](17_ACCESS_SECURITY.md) records the accepted local Keycloak, Employee/Manager and separate Windows DEV/Admin contracts. Public signup cannot grant elevated roles. #82 retains actual device, identity, privacy and recovery proof; #10/#82 block G3/G5 until their carried criteria have evidence.
