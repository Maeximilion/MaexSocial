LOCK TABLE pilot.attempts, pilot.audit IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pilot.attempts a WHERE a.details_retired
        AND NOT EXISTS (SELECT 1 FROM pilot.audit e
            WHERE (e.tenant_id,e.occurrence_id,e.action)=(a.tenant_id,a.occurrence_id,'dispatch_claim'))) THEN
        RAISE EXCEPTION 'Expired dispatch audit detail prevents this downgrade' USING ERRCODE = '23514';
    END IF;
END $$;
DROP TRIGGER retire_dispatch_audit ON pilot.attempts;
DROP FUNCTION pilot.retire_dispatch_claim_audit();
DROP TRIGGER guarded_dispatch_delete ON pilot.audit;
DROP FUNCTION pilot.guard_dispatch_claim_delete();
DROP TRIGGER guarded_audit_delete ON pilot.audit;
CREATE TRIGGER guarded_audit_delete BEFORE DELETE ON pilot.audit FOR EACH ROW
    EXECUTE FUNCTION pilot.guard_fixture_audit_delete();
