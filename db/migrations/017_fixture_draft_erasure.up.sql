-- Only this fixture's owner issues instructions. Applied revisions retain their FK identities.
CREATE TABLE pilot.fixture_draft_erasure (
    source_id text NOT NULL,
    tenant_id uuid NOT NULL,
    draft_id uuid NOT NULL,
    sequence bigint NOT NULL CHECK (sequence > 0),
    authorized_at timestamptz NOT NULL CHECK (isfinite(authorized_at)),
    history_digest text NOT NULL CHECK (history_digest ~ '^[0-9a-f]{64}$'),
    applied_xid xid8,
    PRIMARY KEY (source_id, tenant_id, draft_id),
    UNIQUE (source_id, sequence),
    FOREIGN KEY (tenant_id, draft_id) REFERENCES pilot.drafts(tenant_id, id)
);
REVOKE ALL ON pilot.fixture_draft_erasure FROM PUBLIC, pilot_app;

CREATE FUNCTION pilot.guard_draft_instruction() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP='INSERT' AND NEW.applied_xid IS NULL AND current_user='pilot_owner' AND current_database()='pilot_fixture' THEN
        IF EXISTS (SELECT 1 FROM public.fixture_identity m WHERE to_jsonb(m)->>'disposable_backup'='true'
            AND ((m.restore_target AND to_jsonb(m)->>'restore_history_source_id'=NEW.source_id)
                OR (NOT m.restore_target AND m.purpose='backup' AND m.id=NEW.source_id
                    AND NEW.authorized_at=date_trunc('milliseconds',transaction_timestamp())))) THEN
            RETURN NEW;
        END IF;
    ELSIF TG_OP='UPDATE' AND OLD.applied_xid IS NULL AND NEW.applied_xid=pg_current_xact_id()
        AND (to_jsonb(OLD)-'applied_xid')=(to_jsonb(NEW)-'applied_xid') THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Immutable erasure instruction' USING ERRCODE='23514';
END $$;
CREATE TRIGGER immutable_draft_instruction BEFORE INSERT OR UPDATE OR DELETE ON pilot.fixture_draft_erasure
    FOR EACH ROW EXECUTE FUNCTION pilot.guard_draft_instruction();
CREATE TRIGGER immutable_draft_instruction_set BEFORE TRUNCATE ON pilot.fixture_draft_erasure
    FOR EACH STATEMENT EXECUTE FUNCTION pilot.reject_mutation();

ALTER TABLE pilot.draft_revisions ALTER COLUMN text DROP NOT NULL;
CREATE FUNCTION pilot.guard_draft_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP='INSERT' THEN
        PERFORM 1 FROM pilot.drafts WHERE (tenant_id,id)=(NEW.tenant_id,NEW.draft_id) FOR UPDATE;
        IF NEW.text IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pilot.draft_revisions
            WHERE (tenant_id,draft_id)=(NEW.tenant_id,NEW.draft_id) AND text IS NULL) THEN
            RETURN NEW;
        END IF;
    ELSIF TG_OP='UPDATE' AND current_user='pilot_owner' AND current_database()='pilot_fixture'
        AND OLD.text IS NOT NULL AND NEW.text IS NULL AND (to_jsonb(NEW)-'text')=(to_jsonb(OLD)-'text') THEN
        IF EXISTS (SELECT 1 FROM public.fixture_identity m JOIN pilot.fixture_draft_erasure e
            ON e.source_id=CASE WHEN m.restore_target THEN to_jsonb(m)->>'restore_history_source_id' ELSE m.id END
            WHERE to_jsonb(m)->>'disposable_backup'='true'
            AND (m.restore_target OR m.purpose='backup') AND (e.tenant_id,e.draft_id)=(OLD.tenant_id,OLD.draft_id)
            AND e.applied_xid=pg_current_xact_id()) THEN
            RETURN NEW;
        END IF;
    END IF;
    RAISE EXCEPTION 'Immutable pilot record' USING ERRCODE='23514';
END $$;
REVOKE ALL ON FUNCTION pilot.guard_draft_instruction(), pilot.guard_draft_revision() FROM PUBLIC;
DROP TRIGGER immutable_revision ON pilot.draft_revisions;
CREATE TRIGGER immutable_revision BEFORE INSERT OR UPDATE OR DELETE ON pilot.draft_revisions
    FOR EACH ROW EXECUTE FUNCTION pilot.guard_draft_revision();
