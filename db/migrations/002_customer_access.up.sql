ALTER TABLE pilot.identities
    ADD COLUMN email text UNIQUE CHECK (email = lower(email) AND length(email) BETWEEN 3 AND 254),
    ADD COLUMN generation uuid NOT NULL DEFAULT gen_random_uuid(),
    ADD COLUMN lifecycle text NOT NULL DEFAULT 'pending' CHECK (lifecycle IN ('pending','active','recovering'));
ALTER TABLE pilot.pending_access
    ADD COLUMN identity_generation uuid,
    ADD COLUMN subject text;
ALTER TABLE pilot.sessions
    ADD COLUMN csrf_hash text CHECK (csrf_hash ~ '^[a-f0-9]{64}$'),
    ADD COLUMN mfa_credential_id text;

CREATE TABLE pilot.identity_operations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    identity_id uuid NOT NULL REFERENCES pilot.identities(id),
    challenge_id uuid NOT NULL UNIQUE REFERENCES pilot.pending_access(id),
    purpose text NOT NULL CHECK (purpose IN ('signup','reset','invitation')),
    binding_id uuid NOT NULL,
    generation uuid NOT NULL,
    old_subject text NOT NULL,
    new_subject text,
    phase text NOT NULL CHECK (phase IN ('prepared','retired','created','awaiting','complete','denied')),
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL CHECK (expires_at > created_at)
);
CREATE UNIQUE INDEX one_identity_operation ON pilot.identity_operations(identity_id)
    WHERE phase NOT IN ('complete','denied');

CREATE TABLE pilot.identity_completions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_id uuid NOT NULL UNIQUE REFERENCES pilot.identity_operations(id),
    identity_id uuid NOT NULL REFERENCES pilot.identities(id),
    identity_version integer NOT NULL CHECK (identity_version > 0),
    subject text NOT NULL,
    generation uuid NOT NULL,
    email text NOT NULL CHECK (email = lower(email)),
    first_name text NOT NULL CHECK (length(first_name) BETWEEN 1 AND 100),
    last_name text NOT NULL CHECK (length(last_name) BETWEEN 1 AND 100),
    previously_verified boolean NOT NULL,
    purpose text NOT NULL CHECK (purpose IN ('signup','reset','invitation')),
    binding_id uuid NOT NULL,
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz,
    revoked_at timestamptz
);
CREATE TRIGGER completion_binding BEFORE UPDATE ON pilot.identity_completions
    FOR EACH ROW EXECUTE FUNCTION pilot.keep_invitation_binding();

CREATE TABLE pilot.public_sessions (
    token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
    csrf_hash text NOT NULL CHECK (csrf_hash ~ '^[a-f0-9]{64}$'),
    expires_at timestamptz NOT NULL
);
CREATE TABLE pilot.browser_flows (
    state_hash text PRIMARY KEY CHECK (state_hash ~ '^[a-f0-9]{64}$'),
    browser_hash text NOT NULL REFERENCES pilot.public_sessions(token_hash),
    nonce text NOT NULL,
    verifier text NOT NULL,
    purpose text NOT NULL CHECK (purpose IN ('login','complete','mfa','enroll')),
    operation_id uuid REFERENCES pilot.identity_operations(id),
    session_id uuid REFERENCES pilot.sessions(id),
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz,
    CHECK ((purpose='complete') = (operation_id IS NOT NULL)),
    CHECK ((purpose IN ('mfa','enroll')) = (session_id IS NOT NULL))
);
CREATE TABLE pilot.rate_windows (
    flow text NOT NULL CHECK (flow IN ('login','signup','recovery','resend')),
    bucket text NOT NULL CHECK (bucket IN ('account','source')),
    key_hash text NOT NULL CHECK (key_hash ~ '^[a-f0-9]{64}$'),
    attempts timestamptz[] NOT NULL CHECK (cardinality(attempts) <= 31),
    PRIMARY KEY (flow,bucket,key_hash)
);
GRANT SELECT, INSERT, UPDATE ON pilot.identity_operations, pilot.identity_completions,
    pilot.public_sessions, pilot.browser_flows, pilot.rate_windows TO pilot_app;
