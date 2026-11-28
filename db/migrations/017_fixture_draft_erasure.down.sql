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
DROP TABLE pilot.fixture_draft_erasure;
DROP FUNCTION pilot.guard_draft_instruction();
