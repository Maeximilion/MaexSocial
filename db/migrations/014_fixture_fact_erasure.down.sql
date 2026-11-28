DROP TRIGGER immutable_business_facts ON pilot.business_fact_revisions;
DROP TRIGGER immutable_business_fact_writes ON pilot.business_fact_revisions;
CREATE TRIGGER immutable_business_facts BEFORE UPDATE OR DELETE OR TRUNCATE ON pilot.business_fact_revisions
    FOR EACH STATEMENT EXECUTE FUNCTION pilot.reject_mutation();
DROP FUNCTION pilot.guard_fixture_fact_erasure();
DROP TABLE pilot.fixture_fact_erasure;
