-- Never cascade into objects this migration does not own; any dependency rolls back the drill.
DROP TABLE pilot.tenants, pilot.identities, pilot.memberships, pilot.platform_grants,
    pilot.pending_access, pilot.invitations, pilot.devices, pilot.sessions, pilot.locations,
    pilot.drafts, pilot.draft_revisions, pilot.occurrences, pilot.approvals, pilot.attempts,
    pilot.audit, pilot.budgets, pilot.budget_reservations, pilot.dispatch_control;
DROP FUNCTION pilot.reject_mutation(), pilot.keep_occurrence_identity(),
    pilot.advance_version(), pilot.keep_invitation_binding();
DROP SCHEMA pilot RESTRICT;
