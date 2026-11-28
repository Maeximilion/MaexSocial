-- A populated downgrade must never forget an instruction or fabricate erased text.
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pilot.fixture_draft_erasure) THEN
        RAISE EXCEPTION 'Draft erasure history requires current schema';
    END IF;
END $$;
ALTER TABLE pilot.draft_revisions ALTER COLUMN text SET NOT NULL;
DROP TRIGGER immutable_revision ON pilot.draft_revisions;
CREATE TRIGGER immutable_revision BEFORE UPDATE OR DELETE ON pilot.draft_revisions
    FOR EACH ROW EXECUTE FUNCTION pilot.reject_mutation();
DROP FUNCTION pilot.guard_draft_revision();
ALTER TABLE pilot.approvals ALTER COLUMN mfa_at SET NOT NULL,
    ALTER COLUMN created_at SET NOT NULL, ALTER COLUMN grant_version SET NOT NULL;
DROP TRIGGER immutable_approval ON pilot.approvals;
CREATE TRIGGER immutable_approval BEFORE UPDATE OR DELETE ON pilot.approvals
    FOR EACH ROW EXECUTE FUNCTION pilot.reject_mutation();
DROP FUNCTION pilot.guard_erased_approval();
DROP FUNCTION pilot.applying_draft_erasure(uuid,uuid);
DROP TABLE pilot.fixture_draft_erasure;
DROP FUNCTION pilot.guard_draft_instruction();
