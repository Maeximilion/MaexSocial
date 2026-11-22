-- Legacy approvals retain unknown access status rather than inferring it from the current location.
ALTER TABLE pilot.approvals ADD COLUMN grant_active_at_approval boolean;
