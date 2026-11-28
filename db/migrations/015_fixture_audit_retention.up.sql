-- Only restricted fixture setup binds an independently known event instant and incident disposition.
CREATE TABLE pilot.fixture_audit_disposition (
    fixture_id text NOT NULL,
    tenant_id uuid NOT NULL,
    audit_id uuid NOT NULL,
    event_at timestamptz NOT NULL CHECK (isfinite(event_at)),
    incident_state text NOT NULL CHECK (incident_state IN ('held','clear')),
    expiry_xid xid8,
    checked_at timestamptz CHECK (isfinite(checked_at)),
    PRIMARY KEY (tenant_id, audit_id),
    FOREIGN KEY (tenant_id, audit_id) REFERENCES pilot.audit(tenant_id, id) ON DELETE CASCADE
);
REVOKE ALL ON pilot.fixture_audit_disposition FROM PUBLIC, pilot_app;

CREATE FUNCTION pilot.guard_fixture_audit_delete() RETURNS trigger LANGUAGE plpgsql AS $$
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
REVOKE ALL ON FUNCTION pilot.guard_fixture_audit_delete() FROM PUBLIC;

DROP TRIGGER append_only_audit ON pilot.audit;
CREATE TRIGGER append_only_audit BEFORE UPDATE OR TRUNCATE ON pilot.audit
    FOR EACH STATEMENT EXECUTE FUNCTION pilot.reject_mutation();
CREATE TRIGGER guarded_audit_delete BEFORE DELETE ON pilot.audit
    FOR EACH ROW EXECUTE FUNCTION pilot.guard_fixture_audit_delete();
