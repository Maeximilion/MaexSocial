---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "docs/architecture/**"
  - "docs/security/**"
---

Read docs/02_ARCHITECTURE.md, docs/17_ACCESS_SECURITY.md and docs/security/uploads.md before changing these boundaries. Application implementation requires accepted G2 design and the executable task plan. TypeScript strict does not replace runtime validation or server-side authorization. Scope customer data, jobs and media to the tenant; separate platform-admin authority. External input and model/provider output remain untrusted. Keep security-sensitive decisions testable at the actual boundary.
