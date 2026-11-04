# ADR 0001 — Application language

Status — Language baseline chosen on 2026-11-05 under Maxi's explicit delegation of technology selection. Full G2 product scope and architecture approval remain pending.

## Context

MaexSocial needs a public website, customer registration/login, customer dashboards, separate platform administration and integration-heavy content/media workflows. Research synthesis must still establish the first release and provider capabilities. The repository already uses Python for maintenance and validation.

## Decision

Use **TypeScript with strict checking** as the primary application language. Use TypeScript in browser code and Node.js as the default direction for API and job orchestration. Start with one coherent application and introduce a background worker when durable or long-running work requires it. Keep existing Python repository tooling.

This records a development direction. Frameworks, authentication services, database, queue, package versions, runtime version and deployment remain G2 decisions. Product scaffolding follows Claude's independent REA report, synthesis and the approved implementation plan.

## Rationale and consequences

One language across browser and application code supports shared contracts and tooling. Strict checking catches categories of mistakes before execution. This is a maintainability choice for the current product requirements. TypeScript annotations are erased and do not change runtime behavior, so this decision makes no inherent execution-speed or security claim. [TypeScript strict](https://www.typescriptlang.org/tsconfig/strict.html) · [Type erasure](https://www.typescriptlang.org/docs/handbook/2/basic-types.html#erased-types)

Validate requests, webhooks, provider responses and model outputs at runtime before trusting them. Keep server-side authorization, tenant isolation, session controls, idempotency and the [access acceptance cases](../17_ACCESS_SECURITY.md) explicit. A type assertion cannot establish the validity of untrusted data.

Keep API request work bounded and avoid blocking Node's event loop. Schedule long-running media work through suitable provider jobs or workers. We expect external generation, uploads and network/database activity to contribute substantially to latency, but this is a workload hypothesis to measure during the first slice. [Node.js event-loop guidance](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop)

## Alternatives considered

| Language | Relevant property | MaexSocial decision |
|---|---|---|
| TypeScript | Static checks plus the JavaScript browser/runtime ecosystem | Chosen baseline for application code |
| Go | Concurrency and tooling are central design goals | Consider for a specific measured service need that justifies an additional language |
| Rust | Compiler-checked ownership for memory management | Consider for a demonstrated native component or resource constraint |
| Python | Existing repository tools and potential specialized libraries | Preserve current tools; add product use only for a concrete library/inference requirement |

Go's concurrency/tooling goals and Rust's ownership model are documented properties, not comparative MaexSocial benchmarks. Python's type annotations also lack automatic runtime enforcement. The alternatives add another application toolchain if introduced alongside browser TypeScript. [Go FAQ](https://go.dev/doc/faq#What_is_the_purpose_of_the_project) · [Rust ownership](https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html) · [Python typing](https://docs.python.org/3/library/typing.html)

## Follow-up at G2

- Confirm the first workflow from the completed research synthesis.
- Select frameworks, maintained authentication/session handling and runtime validation contracts.
- Set performance, cost and security acceptance targets before implementation.
- Add type checking and the selected application's behavioral tests to CI when application code exists.
- Revisit a language boundary only when measurements or a required provider/library establish a concrete need.

Official sources consulted on 2026-11-05. No application benchmark or implementation is claimed by this decision.
