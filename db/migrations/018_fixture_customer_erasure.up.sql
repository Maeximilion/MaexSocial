CREATE TABLE pilot.fixture_customer_erasure (
    fixture_id text PRIMARY KEY,
    identity_id uuid NOT NULL,
    subject_binding text NOT NULL CHECK (subject_binding ~ '^[a-f0-9]{64}$'),
    identity_version integer NOT NULL CHECK (identity_version > 0),
    sequence bigint NOT NULL CHECK (sequence > 0),
    history_digest text NOT NULL CHECK (history_digest ~ '^[a-f0-9]{64}$'),
    authorized_at timestamptz NOT NULL DEFAULT clock_timestamp() CHECK (isfinite(authorized_at)),
    applied_xid xid8
);
REVOKE ALL ON pilot.fixture_customer_erasure FROM PUBLIC, pilot_app;
