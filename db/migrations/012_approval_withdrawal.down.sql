DO $$
BEGIN
    LOCK TABLE pilot.audit IN ACCESS EXCLUSIVE MODE;
    IF EXISTS (SELECT 1 FROM pilot.audit WHERE action = 'approval_withdrawal') THEN
        RAISE EXCEPTION 'Approval withdrawal history prevents this downgrade' USING ERRCODE = '23514';
    END IF;
    ALTER TABLE pilot.audit DROP COLUMN approval_id;
END $$;
