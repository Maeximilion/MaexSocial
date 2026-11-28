LOCK TABLE pilot.audit, pilot.expired_occurrence_decisions IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pilot.expired_occurrence_decisions) THEN
        RAISE EXCEPTION 'Expired decision detail prevents this downgrade' USING ERRCODE = '23514';
    END IF;
END $$;
DROP VIEW pilot.occurrence_decisions;
DROP TABLE pilot.expired_occurrence_decisions;
CREATE OR REPLACE FUNCTION pilot.guard_fixture_audit_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF current_user = 'pilot_owner' AND current_database() = 'pilot_fixture'
        AND OLD.action IN ('organization_create','invitation_issue','membership_role_changed',
            'membership_revoked','employee_membership_revoked')
        AND OLD.occurrence_id IS NULL AND OLD.approval_id IS NULL
        AND EXISTS (
            SELECT 1 FROM pilot.fixture_audit_disposition d JOIN public.fixture_identity m ON m.id=d.fixture_id
            WHERE m.purpose='audit-retention' AND NOT m.restore_target
                AND (d.tenant_id,d.audit_id)=(OLD.tenant_id,OLD.id)
                AND d.incident_state='clear' AND d.event_at=OLD.created_at
                AND d.expiry_xid=pg_current_xact_id() AND d.checked_at - d.event_at >= interval '2160 hours'
        ) THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Immutable pilot record' USING ERRCODE = '23514';
END $$;
