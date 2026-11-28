DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pilot.fixture_audit_disposition) THEN
        RAISE EXCEPTION 'Audit dispositions prevent this downgrade' USING ERRCODE = '23514';
    END IF;
END $$;
DROP TRIGGER guarded_audit_delete ON pilot.audit;
DROP TRIGGER append_only_audit ON pilot.audit;
CREATE TRIGGER append_only_audit BEFORE UPDATE OR DELETE ON pilot.audit
    FOR EACH ROW EXECUTE FUNCTION pilot.reject_mutation();
DROP FUNCTION pilot.guard_fixture_audit_delete();
DROP TABLE pilot.fixture_audit_disposition;
