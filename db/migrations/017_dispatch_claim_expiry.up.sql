-- Retire the audit while the attempt's original resolution and approval still exist.
CREATE FUNCTION pilot.retire_dispatch_claim_audit() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    instant timestamptz := COALESCE(NULLIF(current_setting('pilot.retention_clock', true), '')::timestamptz,
        statement_timestamp());
    event_id uuid;
BEGIN
    IF current_user <> 'pilot_owner' OR current_database() <> 'pilot_fixture'
        OR OLD.resolved_at IS NULL OR NOT isfinite(instant)
        OR instant - OLD.resolved_at < interval '2160 hours' THEN
        RETURN NULL;
    END IF;

    UPDATE pilot.fixture_audit_disposition d SET expiry_xid=pg_current_xact_id(), checked_at=instant
    FROM pilot.audit e
    JOIN pilot.approvals p ON (p.tenant_id,p.occurrence_id)=(e.tenant_id,e.occurrence_id)
    JOIN pilot.memberships m ON (m.tenant_id,m.id,m.identity_id)=(p.tenant_id,p.membership_id,e.actor_id),
        public.fixture_identity f
    WHERE (e.tenant_id,e.occurrence_id,e.action)=(OLD.tenant_id,OLD.occurrence_id,'dispatch_claim')
        AND p.id=OLD.approval_id AND e.outcome='in_flight' AND e.reason='Synthetic organic text'
        AND e.device_id IS NULL AND e.membership_id IS NULL AND e.approval_id IS NULL
        AND e.created_at<=OLD.claimed_at AND (d.tenant_id,d.audit_id,d.event_at)=(e.tenant_id,e.id,e.created_at)
        AND d.incident_state='clear' AND d.fixture_id=current_setting('pilot.retention_fixture',true)
        AND d.fixture_id=f.id AND f.purpose='dispatch-retention' AND NOT f.restore_target
        AND NOT EXISTS (SELECT 1 FROM pilot.audit other
            WHERE (other.tenant_id,other.occurrence_id,other.action)=(e.tenant_id,e.occurrence_id,e.action)
                AND other.id<>e.id)
    RETURNING d.audit_id INTO event_id;
    IF event_id IS NULL THEN RETURN NULL; END IF;
    DELETE FROM pilot.audit WHERE tenant_id=OLD.tenant_id AND id=event_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Dispatch audit expiry was not applied'; END IF;
    RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION pilot.retire_dispatch_claim_audit() FROM PUBLIC;
CREATE TRIGGER retire_dispatch_audit BEFORE UPDATE OF details_retired ON pilot.attempts
    FOR EACH ROW WHEN (NEW.details_retired AND NOT OLD.details_retired)
    EXECUTE FUNCTION pilot.retire_dispatch_claim_audit();

-- Only the nested deletion with this transaction's incident decision can remove a claim.
CREATE FUNCTION pilot.guard_dispatch_claim_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF pg_trigger_depth()=2 AND current_user='pilot_owner' AND current_database()='pilot_fixture'
        AND EXISTS (SELECT 1 FROM pilot.fixture_audit_disposition d
            JOIN public.fixture_identity f ON f.id=d.fixture_id
            WHERE (d.tenant_id,d.audit_id,d.event_at)=(OLD.tenant_id,OLD.id,OLD.created_at)
                AND f.purpose='dispatch-retention' AND NOT f.restore_target
                AND d.incident_state='clear' AND d.expiry_xid=pg_current_xact_id()) THEN
        RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Immutable pilot record' USING ERRCODE = '23514';
END $$;
REVOKE ALL ON FUNCTION pilot.guard_dispatch_claim_delete() FROM PUBLIC;
DROP TRIGGER guarded_audit_delete ON pilot.audit;
CREATE TRIGGER guarded_audit_delete BEFORE DELETE ON pilot.audit FOR EACH ROW
    WHEN (OLD.action <> 'dispatch_claim') EXECUTE FUNCTION pilot.guard_fixture_audit_delete();
CREATE TRIGGER guarded_dispatch_delete BEFORE DELETE ON pilot.audit FOR EACH ROW
    WHEN (OLD.action = 'dispatch_claim') EXECUTE FUNCTION pilot.guard_dispatch_claim_delete();
