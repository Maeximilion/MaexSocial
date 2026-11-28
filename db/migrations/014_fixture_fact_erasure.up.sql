-- Only the isolated fixture owner can issue an exact, digest-bound instruction.
CREATE TABLE pilot.fixture_fact_erasure (
    fixture_id text PRIMARY KEY,
    tenant_id uuid NOT NULL,
    location_id uuid NOT NULL,
    sequence bigint NOT NULL CHECK (sequence > 0),
    history_digest text NOT NULL CHECK (history_digest ~ '^[0-9a-f]{64}$'),
    applied_xid xid8,
    FOREIGN KEY (tenant_id, location_id) REFERENCES pilot.locations(tenant_id, id)
);
REVOKE ALL ON pilot.fixture_fact_erasure FROM PUBLIC, pilot_app;

CREATE FUNCTION pilot.guard_fixture_fact_erasure() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF current_user = 'pilot_owner' AND current_database() = 'pilot_fixture'
        AND EXISTS (
            SELECT 1 FROM public.fixture_identity m JOIN pilot.fixture_fact_erasure e ON e.fixture_id=m.id
            WHERE NOT m.restore_target AND m.purpose='backup' AND to_jsonb(m)->>'disposable_backup'='true'
                AND e.applied_xid=pg_current_xact_id() AND NOT EXISTS (
                    SELECT 1 FROM erased WHERE (tenant_id,location_id) <> (e.tenant_id,e.location_id)
                )
        ) THEN
        RETURN NULL;
    END IF;
    RAISE EXCEPTION 'Immutable pilot record' USING ERRCODE = '23514';
END $$;
REVOKE ALL ON FUNCTION pilot.guard_fixture_fact_erasure() FROM PUBLIC;

DROP TRIGGER immutable_business_facts ON pilot.business_fact_revisions;
CREATE TRIGGER immutable_business_fact_writes BEFORE UPDATE OR TRUNCATE ON pilot.business_fact_revisions
    FOR EACH STATEMENT EXECUTE FUNCTION pilot.reject_mutation();
CREATE TRIGGER immutable_business_facts AFTER DELETE ON pilot.business_fact_revisions
    REFERENCING OLD TABLE AS erased FOR EACH STATEMENT EXECUTE FUNCTION pilot.guard_fixture_fact_erasure();
