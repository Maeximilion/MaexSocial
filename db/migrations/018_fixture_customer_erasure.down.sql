DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pilot.fixture_customer_erasure) THEN
        RAISE EXCEPTION 'Customer erasure instruction exists';
    END IF;
END $$;
DROP TABLE pilot.fixture_customer_erasure;
