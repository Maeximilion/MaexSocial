CREATE TABLE pilot.business_fact_revisions (
    tenant_id uuid NOT NULL,
    location_id uuid NOT NULL,
    revision integer NOT NULL CHECK (revision > 0),
    text text NOT NULL CHECK (length(text) BETWEEN 1 AND 6000 AND position(chr(13) IN text) = 0),
    source_note text NOT NULL CHECK (length(source_note) BETWEEN 1 AND 500 AND position(chr(13) IN source_note) = 0),
    evidence_kind text NOT NULL CHECK (evidence_kind = 'synthetic_fixture'),
    membership_id uuid NOT NULL,
    membership_version integer NOT NULL CHECK (membership_version > 0),
    confirmed_at timestamptz NOT NULL CHECK (isfinite(confirmed_at)),
    PRIMARY KEY (tenant_id, location_id, revision),
    FOREIGN KEY (tenant_id, location_id) REFERENCES pilot.locations(tenant_id, id),
    FOREIGN KEY (tenant_id, membership_id) REFERENCES pilot.memberships(tenant_id, id)
);

CREATE FUNCTION pilot.prepare_fixture_facts() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE member pilot.memberships%ROWTYPE;
BEGIN
    NEW.text := replace(replace(NEW.text, E'\r\n', E'\n'), E'\r', E'\n');
    NEW.source_note := replace(replace(NEW.source_note, E'\r\n', E'\n'), E'\r', E'\n');
    SELECT * INTO member FROM pilot.memberships
        WHERE tenant_id = NEW.tenant_id AND id = NEW.membership_id FOR SHARE;
    -- Missing membership is rejected by the composite foreign key.
    IF FOUND AND (NOT member.active OR member.role <> 'Manager' OR member.version <> NEW.membership_version) THEN
        RAISE EXCEPTION 'Invalid synthetic Manager evidence' USING ERRCODE = '23514';
    END IF;
    IF NEW.confirmed_at > clock_timestamp() THEN
        RAISE EXCEPTION 'Future synthetic confirmation' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION pilot.prepare_fixture_facts() FROM PUBLIC;
CREATE TRIGGER prepare_fixture_facts BEFORE INSERT ON pilot.business_fact_revisions
    FOR EACH ROW EXECUTE FUNCTION pilot.prepare_fixture_facts();
CREATE TRIGGER immutable_business_facts BEFORE UPDATE OR DELETE OR TRUNCATE ON pilot.business_fact_revisions
    FOR EACH STATEMENT EXECUTE FUNCTION pilot.reject_mutation();
GRANT SELECT ON pilot.business_fact_revisions TO pilot_app;
