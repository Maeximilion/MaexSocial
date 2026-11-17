ALTER TABLE pilot.drafts ADD COLUMN initial_location_id uuid,
    ADD CONSTRAINT drafts_initial_location_fk FOREIGN KEY (tenant_id, initial_location_id)
    REFERENCES pilot.locations(tenant_id, id);
