ALTER TABLE pilot.sessions
    ADD COLUMN csrf_hash text CHECK (csrf_hash ~ '^[a-f0-9]{64}$'),
    ADD COLUMN tenant_version integer CHECK (tenant_version > 0),
    ADD COLUMN mfa_credential_id text;
