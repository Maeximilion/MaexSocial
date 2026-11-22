ALTER TABLE pilot.audit
    ADD COLUMN membership_id uuid,
    ADD COLUMN membership_version integer CHECK (membership_version > 0),
    ADD CHECK (num_nonnulls(membership_id, membership_version) IN (0, 2)),
    ADD FOREIGN KEY (tenant_id, membership_id) REFERENCES pilot.memberships(tenant_id, id);
