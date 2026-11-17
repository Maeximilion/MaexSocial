CREATE TABLE pilot.oidc_attempts (
    slot smallint PRIMARY KEY CHECK (slot BETWEEN 1 AND 256),
    state_hash text NOT NULL UNIQUE CHECK (state_hash ~ '^[a-f0-9]{64}$'),
    browser_hash text NOT NULL CHECK (browser_hash ~ '^[a-f0-9]{64}$'),
    config_hash text NOT NULL CHECK (config_hash ~ '^[a-f0-9]{64}$'),
    nonce text NOT NULL CHECK (nonce ~ '^[a-f0-9]{64}$'),
    verifier text NOT NULL CHECK (verifier ~ '^[A-Za-z0-9_-]{43}$'),
    created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    expires_at timestamptz NOT NULL DEFAULT (statement_timestamp() + interval '5 minutes'),
    CHECK (expires_at > created_at AND expires_at <= created_at + interval '5 minutes')
);
GRANT SELECT, DELETE ON pilot.oidc_attempts TO pilot_app;
GRANT INSERT (slot, state_hash, browser_hash, config_hash, nonce, verifier) ON pilot.oidc_attempts TO pilot_app;
-- PostgreSQL row locks require UPDATE privilege; limit it to the bounded primary key.
GRANT UPDATE (slot) ON pilot.oidc_attempts TO pilot_app;
