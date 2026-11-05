# External access, administration and tenant security

Status — G2 design requirements, recorded 2026-11-05. Implementation and runtime verification remain future work. No authentication provider, framework or storage architecture is selected.

Design task — [MS-013, issue #30](https://github.com/Maeximilion/MaexSocial/issues/30), dependent on research synthesis. The accepted access design feeds MS-009's executable plan and MS-010's first implementation slice.

## Confirmed product requirements

- MaexSocial must be reachable externally through a secure login.
- A platform administrator must be able to view and manage all customers.
- Each customer needs a separate dashboard and access limited to their authorized customer workspace.
- A public website provides customer registration and login. Administrator access is separate.

Public self-registration creates only a customer identity and eligible customer workspace membership. The proposed activation control requires verified email ownership before customer workspace access. No signup field or default grants platform administration. Public-site content, payments, invitation support and detailed registration/verification behavior remain G2 decisions.

## Proposed access model for G2 approval

| Principal | Proposed authority | Boundary |
|---|---|---|
| Visitor | Public pages, customer registration and authentication entry | No customer or administration data |
| Customer member | Allowed operations in current workspace | Membership and operation checked on every request |
| Customer administrator | Manage approved workspace settings and members | Cannot grant platform privileges |
| Platform administrator | List customers, inspect permitted account state and perform approved customer management | Explicit platform authority, selected target workspace and audit trail |
| Background worker | Execute a validated job for its workspace | No user-controlled widening of scope |

Platform authority is granted through a controlled administrative process. Registration, profile editing and customer invitations cannot self-assign it. Define an action/role/resource matrix, deny unspecified operations and enforce it server-side. The interface's navigation visibility is only presentation. [OWASP Authorization, consulted 2026-11-05](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)

Cross-customer management must show the selected customer and record administrator identity, target workspace, action, timestamp, result and relevant change metadata. Limit each role to approved actions. All-customer visibility excludes passwords, session secrets and provider tokens. Define separate approval for destructive actions or impersonation if later requested. These are proposed product safeguards for the requested administrative scope.

## Proposed controls

Tenant identity must come from verified membership or explicit platform authority. Enforce that context across database queries, lists/search, jobs, caches, media, file downloads and exports. Revalidate queued work against its workspace and current authority before side effects. Client-supplied IDs must not switch tenant context. Private objects require an authorized retrieval path and scoped, expiring download access where used. [OWASP Multi Tenant Security, consulted 2026-11-05](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html)

Require HTTPS throughout login and authenticated use. Prefer maintained framework/provider session handling. For cookie sessions require Secure, HttpOnly and an explicitly chosen SameSite policy compatible with the approved login flow. Rotate sessions after authentication/privilege changes and enforce server-side idle/absolute expiry and revocation. Avoid session identifiers in URLs. [OWASP Session Management, consulted 2026-11-05](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)

Propose mandatory MFA for platform administrators, with an approved enrollment and recovery process. Reauthenticate for sensitive changes. Login, signup, verification resend and recovery use generic responses and bounded abuse controls so account existence is not disclosed. Verification/recovery links are scoped, expiring and single-use. G2 must select identity-provider behavior, throttle thresholds and the recovery/revocation policy before tests are executable. [OWASP Authentication, consulted 2026-11-05](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

Use the selected framework's appropriate CSRF defense for cookie-authenticated writes, validated server-side, with origin checks as appropriate. State-changing operations use suitable non-GET methods. SameSite alone is not the complete defense. Include login CSRF in the selected authentication-flow review. [OWASP CSRF Prevention, consulted 2026-11-05](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)

## Design acceptance cases

These cases are proposed test contracts for MS-009 and implementation acceptance in MS-010. They are not currently passing product tests. Use two synthetic tenants A/B, members of each, a customer administrator and a platform administrator. G2 assigns exact endpoint contracts and configurable limits.

| ID | Type | Input or sequence | Required result |
|---|---|---|---|
| ACCESS-01 | Browser + HTTP integration | Anonymous request to customer/admin page and protected API | No private payload, correct authentication flow, approved return destination |
| ACCESS-02 | API/data integration | A requests B's object, list filter, search result, export and private media/download | Denied or scoped empty result per contract, no B data or mutation |
| ACCESS-03 | Worker integration | Alter tenant ID on a queued job or revoke its authority before execution | No cross-tenant access or unauthorized provider side effect |
| ACCESS-04 | API integration | Member/customer admin changes role fields or calls platform-admin endpoints directly | Platform privilege unchanged, request denied |
| ACCESS-05 | Integration + browser | Authorized platform admin selects A, reads permitted state and performs an allowed management action | Correct customer selected, only allowed change, audit records actor/target/outcome |
| ACCESS-06 | Response/log assertions | Inspect customer/admin responses, exports and audit records | No password material, session secret or provider credential exposed |
| ACCESS-07 | Browser + HTTP integration | Log in, elevate privileges, log out, then replay old session; separately disable account | Old/revoked credentials rejected, expiry enforced, approved cookie attributes present |
| ACCESS-08 | Authentication integration | Platform admin omits second factor or replays recovery material | Privileged access denied, recovery follows approved policy and replay rejected |
| ACCESS-09 | Abuse integration | Repeated login/recovery requests for existing and absent users across configured limit | Equivalent public response class, throttling activates without existence disclosure |
| ACCESS-10 | Browser + HTTP integration | Cross-site state-changing request with missing/invalid CSRF proof, then valid same-origin write | Forgery rejected without mutation, legitimate authorized operation succeeds |
| ACCESS-11 | Deployment smoke | Access externally over HTTP and HTTPS and inspect authenticated traffic | Approved HTTPS endpoint works, credentials/session never accepted over plaintext |
| ACCESS-12 | Browser accessibility | Customer and platform-admin login/dashboard journeys using keyboard | Accessible authentication/recovery, distinct role context and visible target customer |
| ACCESS-13 | Authentication integration | Public signup submits an administrator role, then attempts access before email verification | Customer-only identity, no platform privileges, workspace access withheld until valid verification |
| ACCESS-14 | Authentication integration | Redeem verification link twice, after expiry, or for another identity; resend for existing/absent identity | Invalid attempts rejected, intended activation only once, equivalent public resend response class |

Run negative authorization cases at the server and worker boundaries, not only through hidden buttons. Do not declare the service ready for external customer access until selected release cases pass in the deployed test environment. Existing repository checks validate the foundation only.

## G2 decisions still required

Coordinate media access with [MS-014 upload security](security/uploads.md): private originals/derivatives, scoped worker credentials, safe delivery, signed-link revocation and URL retrieval. A separate admin entry point or storage bucket does not replace server-side authorization.

Choose authentication/session provider, tenant role/action matrix, administrator bootstrap and recovery, MFA methods, customer MFA policy, how account verification works and when its credentials expire or can be revoked, rate limits, audit retention, sensitive-management operations and external domain/deployment. Specify public-site content and the exact self-registration lifecycle. MS-009 then assigns concrete files, fixtures, contracts and tests to each accepted case.
