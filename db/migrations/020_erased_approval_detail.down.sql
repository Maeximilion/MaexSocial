DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pilot.approvals WHERE mfa_at IS NULL) THEN
        RAISE EXCEPTION 'Minimized approval detail cannot be reconstructed';
    END IF;
END $$;
DROP TRIGGER minimize_after_attempt ON pilot.attempts;
DROP TRIGGER minimize_after_occurrence ON pilot.occurrences;
DROP FUNCTION pilot.refresh_erased_approval();
DROP TRIGGER require_unerased_claim ON pilot.attempts;
DROP FUNCTION pilot.require_unerased_claim();
DROP TRIGGER immutable_erased_claim_schedule ON pilot.occurrences;
DROP FUNCTION pilot.keep_erased_claim_schedule();
DROP TRIGGER minimize_approval ON pilot.approvals;
DROP FUNCTION pilot.minimize_erased_approval();
DROP TRIGGER immutable_approval_proof ON pilot.approvals;
DROP TRIGGER immutable_approval ON pilot.approvals;
CREATE TRIGGER immutable_approval BEFORE INSERT OR UPDATE OR DELETE ON pilot.approvals
    FOR EACH ROW EXECUTE FUNCTION pilot.guard_erased_approval();
ALTER TABLE pilot.approvals DROP CONSTRAINT approval_detail_before_erasure,
    ALTER COLUMN location_id SET NOT NULL, ALTER COLUMN due_at SET NOT NULL, ALTER COLUMN timezone SET NOT NULL,
    ALTER COLUMN membership_id SET NOT NULL, ALTER COLUMN membership_version SET NOT NULL;
