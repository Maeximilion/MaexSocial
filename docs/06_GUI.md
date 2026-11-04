# User journeys for G2

Status — interaction requirements. Visual design follows research synthesis.

The first user should understand what MaexSocial will do, for which account, when, and with which authority. The first slice follows brand setup → connected account → content draft → review → schedule/publication → result.

## Required visible states

- Account connection shows platform, account identity, granted capabilities and expired/revoked access.
- Draft review shows source facts, image/media provenance, exact revision and intended destinations.
- Publication shows scheduled, submitting, confirmed, failed and outcome-unknown states. A timeout must not display a false successful publication.
- Autonomy controls show active policy, account scope, frequency, budget and stop state.
- Activity history links each action to revision, actor/policy and external post or job identity.
- Media jobs show queued/running/completed/failed/cancellation state and actual versus reserved cost where supported.

## Acceptance questions

Can a user distinguish a draft from a live post? Can they identify the account before publication? Can they stop future activity and see what is already in flight? Can keyboard and screen-reader users complete the primary journey? Can a failed provider call be understood and recovered without duplicate publication?

MS-008 chooses the first journey and produces an accessible prototype. MS-010 verifies it end to end with synthetic content and an authorized test account.
