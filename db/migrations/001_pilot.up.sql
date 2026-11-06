CREATE SCHEMA pilot;
REVOKE ALL ON SCHEMA pilot FROM PUBLIC;
CREATE TABLE pilot.tenants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
    active boolean NOT NULL DEFAULT true,
    version integer NOT NULL DEFAULT 1 CHECK (version > 0)
);
CREATE TABLE pilot.identities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subject text NOT NULL UNIQUE,
    verified boolean NOT NULL DEFAULT false,
    version integer NOT NULL DEFAULT 1 CHECK (version > 0)
);
CREATE TABLE pilot.memberships (
    tenant_id uuid NOT NULL REFERENCES pilot.tenants(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    identity_id uuid NOT NULL REFERENCES pilot.identities(id),
    role text NOT NULL CHECK (role IN ('Manager', 'Employee')),
    active boolean NOT NULL DEFAULT true,
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, identity_id),
    UNIQUE (tenant_id, id, identity_id)
);
CREATE TABLE pilot.platform_grants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    identity_id uuid NOT NULL UNIQUE REFERENCES pilot.identities(id),
    active boolean NOT NULL DEFAULT true,
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    UNIQUE (id, identity_id)
);
CREATE TABLE pilot.pending_access (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid REFERENCES pilot.tenants(id),
    identity_id uuid REFERENCES pilot.identities(id),
    email text NOT NULL CHECK (email = lower(email) AND length(email) BETWEEN 3 AND 254),
    purpose text NOT NULL CHECK (purpose IN ('signup', 'verification', 'reset', 'access')),
    token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (expires_at > created_at)
);
CREATE TABLE pilot.invitations (
    tenant_id uuid NOT NULL REFERENCES pilot.tenants(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    email text NOT NULL CHECK (email = lower(email) AND length(email) BETWEEN 3 AND 254),
    role text NOT NULL CHECK (role IN ('Manager', 'Employee')),
    purpose text NOT NULL CHECK (purpose = 'membership'),
    issuer_membership_id uuid,
    issuer_platform_grant_id uuid REFERENCES pilot.platform_grants(id),
    issuer_version integer NOT NULL CHECK (issuer_version > 0),
    grant_version integer NOT NULL CHECK (grant_version > 0),
    token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz,
    revoked_at timestamptz,
    PRIMARY KEY (tenant_id, id),
    FOREIGN KEY (tenant_id, issuer_membership_id) REFERENCES pilot.memberships(tenant_id, id),
    CHECK (num_nonnulls(issuer_membership_id, issuer_platform_grant_id) = 1),
    CHECK (issuer_membership_id IS NULL OR role = 'Employee'),
    CHECK (expires_at > created_at)
);
CREATE TABLE pilot.devices (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_grant_id uuid NOT NULL REFERENCES pilot.platform_grants(id),
    identity_id uuid NOT NULL,
    public_key text NOT NULL,
    active boolean NOT NULL DEFAULT true,
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    UNIQUE (id, identity_id),
    FOREIGN KEY (platform_grant_id, identity_id) REFERENCES pilot.platform_grants(id, identity_id)
);
CREATE TABLE pilot.sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
    identity_id uuid NOT NULL REFERENCES pilot.identities(id),
    tenant_id uuid,
    membership_id uuid,
    membership_version integer,
    device_id uuid REFERENCES pilot.devices(id),
    identity_version integer NOT NULL CHECK (identity_version > 0),
    device_version integer,
    audience text NOT NULL CHECK (audience IN ('customer', 'management')),
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    mfa_at timestamptz,
    revoked_at timestamptz,
    FOREIGN KEY (tenant_id, membership_id, identity_id) REFERENCES pilot.memberships(tenant_id, id, identity_id),
    FOREIGN KEY (device_id, identity_id) REFERENCES pilot.devices(id, identity_id),
    CHECK (expires_at > created_at),
    CHECK ((audience = 'customer' AND tenant_id IS NOT NULL AND membership_id IS NOT NULL
        AND membership_version IS NOT NULL AND membership_version > 0 AND device_id IS NULL AND device_version IS NULL)
      OR (audience = 'management' AND tenant_id IS NULL AND membership_id IS NULL
        AND membership_version IS NULL AND device_id IS NOT NULL AND device_version IS NOT NULL AND device_version > 0))
);
CREATE TABLE pilot.locations (
    tenant_id uuid NOT NULL REFERENCES pilot.tenants(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    provider_location text NOT NULL,
    grant_active boolean NOT NULL DEFAULT false,
    version integer NOT NULL DEFAULT 1 CHECK (version > 0),
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, provider_location)
);
CREATE TABLE pilot.drafts (
    tenant_id uuid NOT NULL REFERENCES pilot.tenants(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    PRIMARY KEY (tenant_id, id)
);
CREATE TABLE pilot.draft_revisions (
    tenant_id uuid NOT NULL,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    draft_id uuid NOT NULL,
    revision integer NOT NULL CHECK (revision > 0),
    text text NOT NULL CHECK (length(text) BETWEEN 1 AND 1500),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, draft_id, id),
    UNIQUE (tenant_id, draft_id, revision),
    FOREIGN KEY (tenant_id, draft_id) REFERENCES pilot.drafts(tenant_id, id)
);
CREATE TABLE pilot.occurrences (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    draft_id uuid NOT NULL,
    location_id uuid NOT NULL,
    creation_key uuid NOT NULL,
    due_at timestamptz NOT NULL,
    timezone text NOT NULL CHECK (length(timezone) BETWEEN 1 AND 100),
    approval_id uuid,
    state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','approved','held','exported','in_flight','unknown','pending','confirmed','rejected','quarantined')),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, id),
    UNIQUE (tenant_id, id, draft_id),
    UNIQUE (tenant_id, creation_key),
    FOREIGN KEY (tenant_id, draft_id) REFERENCES pilot.drafts(tenant_id, id),
    FOREIGN KEY (tenant_id, location_id) REFERENCES pilot.locations(tenant_id, id)
);
CREATE TABLE pilot.approvals (
    tenant_id uuid NOT NULL,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    occurrence_id uuid NOT NULL,
    draft_id uuid NOT NULL,
    revision_id uuid NOT NULL,
    location_id uuid NOT NULL,
    membership_id uuid NOT NULL,
    membership_version integer NOT NULL CHECK (membership_version > 0),
    grant_version integer NOT NULL CHECK (grant_version > 0),
    due_at timestamptz NOT NULL,
    timezone text NOT NULL CHECK (length(timezone) BETWEEN 1 AND 100),
    mfa_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, occurrence_id, id),
    FOREIGN KEY (tenant_id, occurrence_id, draft_id) REFERENCES pilot.occurrences(tenant_id, id, draft_id),
    FOREIGN KEY (tenant_id, draft_id, revision_id) REFERENCES pilot.draft_revisions(tenant_id, draft_id, id),
    FOREIGN KEY (tenant_id, location_id) REFERENCES pilot.locations(tenant_id, id),
    FOREIGN KEY (tenant_id, membership_id) REFERENCES pilot.memberships(tenant_id, id)
);
ALTER TABLE pilot.occurrences ADD FOREIGN KEY (tenant_id, id, approval_id)
    REFERENCES pilot.approvals(tenant_id, occurrence_id, id);
CREATE TABLE pilot.attempts (
    tenant_id uuid NOT NULL,
    occurrence_id uuid NOT NULL,
    approval_id uuid NOT NULL,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    claimed_at timestamptz NOT NULL DEFAULT now(),
    outcome text NOT NULL DEFAULT 'unknown' CHECK (outcome IN ('unknown','pending','confirmed','rejected')),
    observed_at timestamptz,
    PRIMARY KEY (tenant_id, occurrence_id),
    UNIQUE (tenant_id, id),
    FOREIGN KEY (tenant_id, occurrence_id, approval_id) REFERENCES pilot.approvals(tenant_id, occurrence_id, id)
);
CREATE TABLE pilot.audit (
    tenant_id uuid NOT NULL REFERENCES pilot.tenants(id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    actor_id uuid NOT NULL REFERENCES pilot.identities(id),
    device_id uuid REFERENCES pilot.devices(id),
    occurrence_id uuid,
    action text NOT NULL CHECK (length(action) BETWEEN 1 AND 80),
    reason text NOT NULL CHECK (length(reason) BETWEEN 1 AND 500),
    outcome text NOT NULL CHECK (length(outcome) BETWEEN 1 AND 80),
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tenant_id, id),
    FOREIGN KEY (tenant_id, occurrence_id) REFERENCES pilot.occurrences(tenant_id, id)
);
CREATE TABLE pilot.budgets (
    tenant_id uuid PRIMARY KEY REFERENCES pilot.tenants(id),
    synthetic_units bigint NOT NULL DEFAULT 0 CHECK (synthetic_units >= 0)
);
CREATE TABLE pilot.budget_reservations (
    tenant_id uuid NOT NULL REFERENCES pilot.budgets(tenant_id),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    operation_key uuid NOT NULL,
    units bigint NOT NULL CHECK (units > 0),
    state text NOT NULL DEFAULT 'reserved' CHECK (state IN ('reserved','settled','released','unknown')),
    settled_units bigint CHECK (settled_units >= 0 AND settled_units <= units),
    PRIMARY KEY (tenant_id, id),
    UNIQUE (tenant_id, operation_key)
);
CREATE TABLE pilot.dispatch_control (
    singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
    stopped boolean NOT NULL DEFAULT true
);
INSERT INTO pilot.dispatch_control DEFAULT VALUES;

CREATE FUNCTION pilot.reject_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Immutable pilot record' USING ERRCODE = '23514';
END $$;
CREATE TRIGGER immutable_revision BEFORE UPDATE OR DELETE ON pilot.draft_revisions
    FOR EACH ROW EXECUTE FUNCTION pilot.reject_mutation();
CREATE TRIGGER immutable_approval BEFORE UPDATE OR DELETE ON pilot.approvals
    FOR EACH ROW EXECUTE FUNCTION pilot.reject_mutation();
CREATE TRIGGER append_only_audit BEFORE UPDATE OR DELETE ON pilot.audit
    FOR EACH ROW EXECUTE FUNCTION pilot.reject_mutation();
CREATE FUNCTION pilot.keep_occurrence_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF ROW(NEW.id, NEW.tenant_id, NEW.draft_id, NEW.creation_key) IS DISTINCT FROM
       ROW(OLD.id, OLD.tenant_id, OLD.draft_id, OLD.creation_key) THEN
        RAISE EXCEPTION 'Immutable occurrence identity' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER immutable_occurrence BEFORE UPDATE ON pilot.occurrences
    FOR EACH ROW EXECUTE FUNCTION pilot.keep_occurrence_identity();
CREATE FUNCTION pilot.advance_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.version <> OLD.version + 1 THEN
        RAISE EXCEPTION 'Authority changes require the next grant version' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
CREATE FUNCTION pilot.keep_invitation_binding() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF (to_jsonb(NEW) - ARRAY['consumed_at','revoked_at']) IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['consumed_at','revoked_at'])
       OR (OLD.consumed_at IS NOT NULL AND NEW.consumed_at IS DISTINCT FROM OLD.consumed_at)
       OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at) THEN
        RAISE EXCEPTION 'Invitation binding and terminal state are immutable' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER invitation_binding BEFORE UPDATE ON pilot.invitations
    FOR EACH ROW EXECUTE FUNCTION pilot.keep_invitation_binding();
DO $$ DECLARE item text; BEGIN
    FOREACH item IN ARRAY ARRAY['tenants','identities','memberships','platform_grants','devices','locations'] LOOP
        EXECUTE format('CREATE TRIGGER version_change BEFORE UPDATE ON pilot.%I FOR EACH ROW EXECUTE FUNCTION pilot.advance_version()', item);
    END LOOP;
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA pilot FROM PUBLIC;
GRANT USAGE ON SCHEMA pilot TO pilot_app;
GRANT SELECT ON ALL TABLES IN SCHEMA pilot TO pilot_app;
GRANT INSERT, UPDATE ON pilot.tenants, pilot.identities, pilot.memberships, pilot.platform_grants,
    pilot.pending_access, pilot.invitations, pilot.devices, pilot.sessions, pilot.locations,
    pilot.drafts, pilot.budgets, pilot.budget_reservations, pilot.dispatch_control TO pilot_app;
GRANT INSERT ON pilot.draft_revisions, pilot.approvals, pilot.attempts, pilot.audit TO pilot_app;
GRANT UPDATE (outcome, observed_at) ON pilot.attempts TO pilot_app;
GRANT INSERT (tenant_id, draft_id, location_id, creation_key, due_at, timezone) ON pilot.occurrences TO pilot_app;
GRANT UPDATE (location_id, due_at, timezone, approval_id, state) ON pilot.occurrences TO pilot_app;
