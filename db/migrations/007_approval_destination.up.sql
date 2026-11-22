-- Historical approvals preserve their original bindings without inventing a destination label.
ALTER TABLE pilot.approvals ADD COLUMN provider_location text;
