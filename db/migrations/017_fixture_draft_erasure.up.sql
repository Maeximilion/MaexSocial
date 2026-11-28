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

CREATE FUNCTION pilot.applying_draft_erasure(tenant uuid, draft uuid) RETURNS boolean LANGUAGE sql VOLATILE AS $$
    SELECT current_user='pilot_owner' AND current_database()='pilot_fixture' AND EXISTS (
        SELECT 1 FROM public.fixture_identity m JOIN pilot.fixture_draft_erasure e
            ON e.source_id=CASE WHEN m.restore_target THEN to_jsonb(m)->>'restore_history_source_id' ELSE m.id END
        WHERE to_jsonb(m)->>'disposable_backup'='true' AND (m.restore_target OR m.purpose='backup')
            AND (e.tenant_id,e.draft_id)=(tenant,draft) AND e.applied_xid=pg_current_xact_id()
    );
$$;
REVOKE ALL ON FUNCTION pilot.applying_draft_erasure(uuid,uuid) FROM PUBLIC;

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
        IF pilot.applying_draft_erasure(OLD.tenant_id,OLD.draft_id) THEN
            RETURN NEW;
        END IF;
    END IF;
    RAISE EXCEPTION 'Immutable pilot record' USING ERRCODE='23514';
END $$;
REVOKE ALL ON FUNCTION pilot.guard_draft_instruction(), pilot.guard_draft_revision() FROM PUBLIC;
DROP TRIGGER immutable_revision ON pilot.draft_revisions;
CREATE TRIGGER immutable_revision BEFORE INSERT OR UPDATE OR DELETE ON pilot.draft_revisions
    FOR EACH ROW EXECUTE FUNCTION pilot.guard_draft_revision();

-- Withdrawals and attempt recovery keep their bindings. Neither needs the proof instant or historical grant state.
ALTER TABLE pilot.approvals ALTER COLUMN mfa_at DROP NOT NULL,
    ALTER COLUMN created_at DROP NOT NULL, ALTER COLUMN grant_version DROP NOT NULL;
CREATE FUNCTION pilot.guard_erased_approval() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE proof text[] := ARRAY['mfa_at','created_at','grant_version','grant_active_at_approval'];
BEGIN
    IF TG_OP='INSERT' THEN
        IF num_nonnulls(NEW.mfa_at,NEW.created_at,NEW.grant_version)=3 THEN RETURN NEW; END IF;
    ELSIF TG_OP='UPDATE' AND current_user='pilot_owner' AND OLD.mfa_at IS NOT NULL
        AND num_nonnulls(NEW.mfa_at,NEW.created_at,NEW.grant_version,NEW.grant_active_at_approval)=0
        AND (to_jsonb(NEW)-proof)=(to_jsonb(OLD)-proof) THEN
        IF pilot.applying_draft_erasure(OLD.tenant_id,OLD.draft_id) THEN RETURN NEW; END IF;
    END IF;
    RAISE EXCEPTION 'Immutable pilot record' USING ERRCODE='23514';
END $$;
REVOKE ALL ON FUNCTION pilot.guard_erased_approval() FROM PUBLIC;
DROP TRIGGER immutable_approval ON pilot.approvals;
CREATE TRIGGER immutable_approval BEFORE INSERT OR UPDATE OR DELETE ON pilot.approvals
    FOR EACH ROW EXECUTE FUNCTION pilot.guard_erased_approval();

CREATE FUNCTION pilot.require_purged_payloads() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM pilot.draft_revisions WHERE (tenant_id,draft_id)=(NEW.tenant_id,NEW.draft_id)
            AND text IS NOT NULL)
        OR EXISTS (SELECT 1 FROM pilot.approvals WHERE (tenant_id,draft_id)=(NEW.tenant_id,NEW.draft_id)
            AND num_nonnulls(mfa_at,created_at,grant_version,grant_active_at_approval)>0) THEN
        RAISE EXCEPTION 'Incomplete draft erasure' USING ERRCODE='23514';
    END IF;
    RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION pilot.require_purged_payloads() FROM PUBLIC;
CREATE CONSTRAINT TRIGGER complete_draft_erasure AFTER UPDATE ON pilot.fixture_draft_erasure
    DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION pilot.require_purged_payloads();
