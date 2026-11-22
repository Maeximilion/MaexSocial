DO $$
BEGIN
    LOCK TABLE pilot.attempts IN ACCESS EXCLUSIVE MODE;
    IF EXISTS (SELECT 1 FROM pilot.attempts WHERE details_retired) THEN
        RAISE EXCEPTION 'Retired dispatch claims prevent this downgrade' USING ERRCODE = '23514';
    END IF;
    DROP TRIGGER attempt_resolution ON pilot.attempts;
    DROP FUNCTION pilot.keep_attempt_resolution();
    ALTER TABLE pilot.attempts
        DROP CONSTRAINT attempt_detail_shape,
        DROP CONSTRAINT attempt_occurrence,
        DROP COLUMN details_retired,
        DROP COLUMN resolved_at,
        ALTER COLUMN id SET NOT NULL,
        ALTER COLUMN approval_id SET NOT NULL,
        ALTER COLUMN claimed_at SET NOT NULL;
    REVOKE INSERT (tenant_id, occurrence_id, approval_id, id, claimed_at, outcome, observed_at, resource_name)
        ON pilot.attempts FROM pilot_app;
    GRANT INSERT ON pilot.attempts TO pilot_app;
END $$;
