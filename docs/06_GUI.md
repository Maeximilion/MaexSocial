# User journeys for G2

Status — interaction requirements. Visual design follows research synthesis.

The first user should understand what MaexSocial will do, for which account, when, and with which authority. The first slice follows brand setup → connected account → content draft → review → schedule/publication → result.

## Access and dashboard journeys

The user requires secure external login, a platform-administration area for viewing/managing all customers, and a separate customer dashboard. The customer journey shows only authorized workspaces. The platform journey shows an all-customer overview and an explicit target customer before a management action. Privileged access must not expose credentials.

A public website with customer registration/login and a separate administrator entry is confirmed. Signup offers customer access only, with proposed email-verification activation and enumeration-safe verification/recovery messages. Invitations and the administrator provisioning mechanism remain G2 choices. Authentication, MFA/recovery, session expiry and access-denied screens must follow the approved [access design](17_ACCESS_SECURITY.md). Server-side authorization remains required regardless of navigation visibility.

## Required visible states

Maxi's [media-library and calendar request](18_MEDIA_LIBRARY.md) adds a proposed journey: private image/video upload → AI-assisted creation → exact-variant review → calendar/recurrence → per-channel publication result. Optional Campaigns shows separate audience, dates, ad budget and activation approval. Media library, Create, Calendar and Campaigns are proposed dashboard areas, not implemented screens or accepted G2 layout.

- Account connection shows platform, account identity, granted capabilities and expired/revoked access.
- Draft review shows source facts, image/media provenance, exact revision and intended destinations.
- Publication shows scheduled, submitting, confirmed, failed and outcome-unknown states. A timeout must not display a false successful publication.
- Autonomy controls show active policy, account scope, frequency, budget and stop state.
- Activity history links each action to revision, actor/policy and external post or job identity.
- Media jobs show queued/running/completed/failed/cancellation state and actual versus reserved cost where supported.

## Acceptance questions

Can a user distinguish a draft from a live post? Can they identify the account before publication? Can they stop future activity and see what is already in flight? Can keyboard and screen-reader users complete the primary journey? Can a failed provider call be understood and recovered without duplicate publication?

Can customers reach only their own permitted data? Does an administrator always see which customer an action affects? Do login, expiry and recovery provide accessible paths without disclosing account existence? The ACCESS acceptance cases in the [security design](17_ACCESS_SECURITY.md) cover these boundaries through browser and server tests.

MS-008 chooses the first journey and produces an accessible prototype. MS-010 verifies it end to end with synthetic content and an authorized test account.
