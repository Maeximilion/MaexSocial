-- An older approval has no evidence of the tenant lifecycle in which it was granted.
ALTER TABLE pilot.approvals ADD COLUMN tenant_version integer CHECK (tenant_version > 0);
