-- Rollback discards initial location context; drafts and their immutable revisions remain.
ALTER TABLE pilot.drafts DROP COLUMN initial_location_id;
