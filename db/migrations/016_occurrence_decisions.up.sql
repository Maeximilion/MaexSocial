-- A NULL approval identifies a hold. Each non-NULL approval identifies one withdrawal.
CREATE TABLE pilot.expired_occurrence_decisions (
    tenant_id uuid NOT NULL,
    occurrence_id uuid NOT NULL,
    approval_id uuid,
    UNIQUE NULLS NOT DISTINCT (tenant_id, occurrence_id, approval_id),
    FOREIGN KEY (tenant_id, occurrence_id) REFERENCES pilot.occurrences(tenant_id, id) ON DELETE CASCADE,
    FOREIGN KEY (tenant_id, occurrence_id, approval_id)
        REFERENCES pilot.approvals(tenant_id, occurrence_id, id) ON DELETE CASCADE
);
REVOKE ALL ON pilot.expired_occurrence_decisions FROM PUBLIC, pilot_app;

CREATE VIEW pilot.occurrence_decisions AS
    SELECT tenant_id, occurrence_id, approval_id FROM pilot.audit
        WHERE occurrence_id IS NOT NULL AND action IN ('occurrence_hold','approval_withdrawal')
    UNION
    SELECT tenant_id, occurrence_id, approval_id FROM pilot.expired_occurrence_decisions;
GRANT SELECT ON pilot.occurrence_decisions TO pilot_app;

CREATE OR REPLACE FUNCTION pilot.guard_fixture_audit_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF current_user = 'pilot_owner' AND current_database() = 'pilot_fixture'
        AND EXISTS (
            SELECT 1 FROM pilot.fixture_audit_disposition d JOIN public.fixture_identity m ON m.id=d.fixture_id
            WHERE m.purpose='audit-retention' AND NOT m.restore_target
                AND (d.tenant_id,d.audit_id)=(OLD.tenant_id,OLD.id)
                AND d.incident_state='clear' AND d.event_at=OLD.created_at
                AND d.expiry_xid=pg_current_xact_id() AND d.checked_at - d.event_at >= interval '2160 hours'
        ) THEN
        IF OLD.action IN ('occurrence_hold','approval_withdrawal') AND OLD.occurrence_id IS NOT NULL THEN
            INSERT INTO pilot.expired_occurrence_decisions(tenant_id,occurrence_id,approval_id)
                VALUES(OLD.tenant_id,OLD.occurrence_id,OLD.approval_id) ON CONFLICT DO NOTHING;
            RETURN OLD;
        ELSIF OLD.action IN ('organization_create','invitation_issue','membership_role_changed',
            'membership_revoked','employee_membership_revoked')
        AND OLD.occurrence_id IS NULL AND OLD.approval_id IS NULL THEN
            RETURN OLD;
        END IF;
    END IF;
    RAISE EXCEPTION 'Immutable pilot record' USING ERRCODE = '23514';
END $$;
