ALTER TABLE pilot.attempts
    ALTER COLUMN id DROP NOT NULL,
    ALTER COLUMN approval_id DROP NOT NULL,
    ALTER COLUMN claimed_at DROP NOT NULL,
    ADD COLUMN resolved_at timestamptz,
    ADD COLUMN details_retired boolean NOT NULL DEFAULT false,
    ADD CONSTRAINT attempt_occurrence FOREIGN KEY (tenant_id, occurrence_id)
        REFERENCES pilot.occurrences(tenant_id, id),
    ADD CONSTRAINT attempt_detail_shape CHECK (
        (details_retired AND outcome IN ('confirmed','rejected')
            AND id IS NULL AND approval_id IS NULL AND claimed_at IS NULL
            AND observed_at IS NULL AND resource_name IS NULL AND resolved_at IS NULL)
        OR (NOT details_retired AND id IS NOT NULL AND approval_id IS NOT NULL AND claimed_at IS NOT NULL
            AND (resolved_at IS NULL OR (outcome IN ('confirmed','rejected') AND isfinite(resolved_at))))
    );

CREATE FUNCTION pilot.keep_attempt_resolution() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.details_retired THEN
        RAISE EXCEPTION 'Retired dispatch claim is immutable' USING ERRCODE = '23514';
    END IF;
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    IF NEW.details_retired THEN
        IF OLD.resolved_at IS NULL
            OR ROW(NEW.tenant_id, NEW.occurrence_id, NEW.outcome) IS DISTINCT FROM
                ROW(OLD.tenant_id, OLD.occurrence_id, OLD.outcome) THEN
            RAISE EXCEPTION 'Retirement requires a resolved attempt and preserves its claim and outcome' USING ERRCODE = '23514';
        END IF;
    ELSIF OLD.resolved_at IS NOT NULL THEN
        IF NEW IS DISTINCT FROM OLD THEN
            RAISE EXCEPTION 'Resolved attempt evidence is immutable' USING ERRCODE = '23514';
        END IF;
    ELSIF OLD.outcome IN ('unknown','pending') AND NEW.outcome IN ('confirmed','rejected') THEN
        -- Record the local transaction's terminal write, independent of provider time.
        NEW.resolved_at := clock_timestamp();
    ELSE
        NEW.resolved_at := NULL;
    END IF;
    RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION pilot.keep_attempt_resolution() FROM PUBLIC;
CREATE TRIGGER attempt_resolution BEFORE UPDATE OR DELETE ON pilot.attempts
    FOR EACH ROW EXECUTE FUNCTION pilot.keep_attempt_resolution();

REVOKE INSERT ON pilot.attempts FROM pilot_app;
GRANT INSERT (tenant_id, occurrence_id, approval_id, id, claimed_at, outcome, observed_at, resource_name)
    ON pilot.attempts TO pilot_app;
