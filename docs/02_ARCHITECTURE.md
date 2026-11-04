# Architecture decisions to establish at G2

Status — provisional product boundaries. No application stack has been selected.

## Candidate responsibilities

| Responsibility | Owns | Evidence needed before implementation |
|---|---|---|
| Workspace and brand | Tenant boundary, approved business facts, assets and voice | First customer and account model |
| Content orchestration | Brief, generation jobs, revisions, policy checks | First channel content contract |
| Publication | Schedule, durable intent, channel result and reconciliation | Official API capabilities and permission model |
| Provider adapters | Authentication, requests, rate limits, error translation | Selected providers and current documentation |
| Media jobs | Source provenance, render lifecycle, outputs and costs | Image-to-video provider evaluation |
| Observability | Evidence of actions, cost, errors and stop controls | Pilot success and failure criteria |

The first slice should cover one complete workflow through these responsibilities. Modules should be introduced when needed by that slice, with business decisions separated from provider transport.

## Design invariants

- Every action is scoped to a workspace and account. Model output cannot select an unauthorized account.
- Publication authority is an explicit versioned policy. Draft approval and autonomous policy approval are distinguishable.
- External writes use durable intent, idempotency where supported and reconciliation where the provider result is ambiguous.
- Authentication secrets stay outside prompts, logs and repository files.
- Cost limits apply before external generation and publication-related purchases. Concurrent jobs share the same budget authority.
- A stop control prevents new work and documents treatment of already accepted provider jobs.

## G2 decision record

MS-008 compares a small application with direct APIs, a workflow-led implementation, and a hybrid where external orchestration is limited to appropriate background work. Record fit to the first slice, failure recovery, operating cost and maintainability. The approved choice determines code directories, technology and deployment. API and MCP are transport options whose capabilities and operational support must be proven separately.
