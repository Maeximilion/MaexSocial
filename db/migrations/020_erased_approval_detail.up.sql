-- An erased approval keeps its revision and occurrence FKs. New approvals keep the original shape.
ALTER TABLE pilot.approvals
    ALTER COLUMN location_id DROP NOT NULL, ALTER COLUMN due_at DROP NOT NULL, ALTER COLUMN timezone DROP NOT NULL,
    ALTER COLUMN membership_id DROP NOT NULL, ALTER COLUMN membership_version DROP NOT NULL,
    ADD CONSTRAINT approval_detail_before_erasure CHECK (mfa_at IS NULL OR
        num_nonnulls(location_id,due_at,timezone,membership_id,membership_version)=5);

-- 017 still checks the original permit and proof-only assignment before this trigger derives the remaining fields.
DROP TRIGGER immutable_approval ON pilot.approvals;
CREATE TRIGGER immutable_approval BEFORE INSERT OR DELETE ON pilot.approvals
    FOR EACH ROW EXECUTE FUNCTION pilot.guard_erased_approval();
CREATE TRIGGER immutable_approval_proof BEFORE UPDATE ON pilot.approvals
    FOR EACH ROW WHEN (OLD.mfa_at IS NOT NULL) EXECUTE FUNCTION pilot.guard_erased_approval();

CREATE FUNCTION pilot.minimize_erased_approval() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    o pilot.occurrences%ROWTYPE;
    attempt_outcome text;
    prior_state text;
    withdrawn boolean;
    active_authority boolean;
BEGIN
    IF OLD.mfa_at IS NULL AND NEW IS DISTINCT FROM OLD THEN
        RAISE EXCEPTION 'Immutable erased approval' USING ERRCODE='23514';
    END IF;
    SELECT * INTO STRICT o FROM pilot.occurrences WHERE (tenant_id,id)=(OLD.tenant_id,OLD.occurrence_id);
    SELECT outcome INTO attempt_outcome FROM pilot.attempts
        WHERE (tenant_id,occurrence_id,approval_id)=(OLD.tenant_id,OLD.occurrence_id,OLD.id);
    IF attempt_outcome IS NOT NULL AND OLD.location_id IS NOT NULL AND
        (OLD.location_id,OLD.due_at,OLD.timezone) IS DISTINCT FROM (o.location_id,o.due_at,o.timezone) THEN
        RAISE EXCEPTION 'Claimed schedule differs from approval' USING ERRCODE='23514';
    END IF;
    NEW.location_id := NULL;
    NEW.due_at := NULL;
    NEW.timezone := NULL;
    IF attempt_outcome IS NULL OR attempt_outcome IN ('confirmed','rejected') THEN
        NEW.provider_location := NULL;
    END IF;

    prior_state := CASE WHEN o.state='quarantined' THEN to_jsonb(o)->>'restore_previous_state' ELSE o.state END;
    active_authority := o.approval_id IS NOT DISTINCT FROM OLD.id AND prior_state IN ('draft','approved','held');
    SELECT EXISTS (SELECT 1 FROM pilot.occurrence_decisions
        WHERE (tenant_id,occurrence_id,approval_id)=(OLD.tenant_id,OLD.occurrence_id,OLD.id)) INTO withdrawn;
    IF NOT withdrawn AND (active_authority IS NOT TRUE OR prior_state<>'approved') THEN
        NEW.tenant_version := NULL;
    END IF;
    IF NOT withdrawn AND active_authority IS NOT TRUE THEN
        NEW.membership_version := NULL;
        -- The restricted claim-audit expiry still checks the original actor against this membership.
        IF attempt_outcome IS NULL THEN NEW.membership_id := NULL; END IF;
    END IF;
    RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION pilot.minimize_erased_approval() FROM PUBLIC;
CREATE TRIGGER minimize_approval BEFORE UPDATE ON pilot.approvals
    FOR EACH ROW WHEN (OLD.mfa_at IS NULL OR NEW.mfa_at IS NULL) EXECUTE FUNCTION pilot.minimize_erased_approval();

CREATE FUNCTION pilot.require_unerased_claim() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
    SET search_path=pg_catalog,pg_temp AS $$
BEGIN
    PERFORM 1 FROM pilot.approvals WHERE (tenant_id,occurrence_id,id)=(NEW.tenant_id,NEW.occurrence_id,NEW.approval_id)
        AND mfa_at IS NOT NULL FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Claim requires an unerased approval' USING ERRCODE='23514'; END IF;
    RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION pilot.require_unerased_claim() FROM PUBLIC;
CREATE TRIGGER require_unerased_claim BEFORE INSERT ON pilot.attempts
    FOR EACH ROW EXECUTE FUNCTION pilot.require_unerased_claim();

-- Once the matching schedule is checked at erasure, the occurrence is the sole surviving schedule.
CREATE FUNCTION pilot.keep_erased_claim_schedule() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM pilot.attempts a JOIN pilot.approvals p
        ON (p.tenant_id,p.occurrence_id,p.id)=(a.tenant_id,a.occurrence_id,a.approval_id)
        WHERE (a.tenant_id,a.occurrence_id)=(OLD.tenant_id,OLD.id) AND p.mfa_at IS NULL) THEN
        RAISE EXCEPTION 'Erased claim schedule is immutable' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION pilot.keep_erased_claim_schedule() FROM PUBLIC;
CREATE TRIGGER immutable_erased_claim_schedule BEFORE UPDATE OF location_id,due_at,timezone ON pilot.occurrences
    FOR EACH ROW WHEN ((OLD.location_id,OLD.due_at,OLD.timezone) IS DISTINCT FROM (NEW.location_id,NEW.due_at,NEW.timezone))
    EXECUTE FUNCTION pilot.keep_erased_claim_schedule();

-- Resolve with the application role. It receives no general approval UPDATE privilege.
-- Defer occurrence changes so withdrawal's audit decision and detached approval commit together.
CREATE FUNCTION pilot.refresh_erased_approval() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
    SET search_path=pg_catalog,pg_temp AS $$
DECLARE occurrence uuid;
BEGIN
    IF TG_TABLE_NAME='attempts' THEN occurrence := NEW.occurrence_id; ELSE occurrence := NEW.id; END IF;
    UPDATE pilot.approvals SET provider_location=provider_location
        WHERE tenant_id=NEW.tenant_id AND occurrence_id=occurrence AND mfa_at IS NULL;
    RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION pilot.refresh_erased_approval() FROM PUBLIC;
CREATE TRIGGER minimize_after_attempt AFTER UPDATE OF outcome,details_retired ON pilot.attempts
    FOR EACH ROW WHEN (OLD.outcome IS DISTINCT FROM NEW.outcome OR OLD.details_retired IS DISTINCT FROM NEW.details_retired)
    EXECUTE FUNCTION pilot.refresh_erased_approval();
CREATE CONSTRAINT TRIGGER minimize_after_occurrence AFTER UPDATE ON pilot.occurrences DEFERRABLE INITIALLY DEFERRED
    FOR EACH ROW WHEN (OLD.state IS DISTINCT FROM NEW.state OR OLD.approval_id IS DISTINCT FROM NEW.approval_id)
    EXECUTE FUNCTION pilot.refresh_erased_approval();

-- Upgrade committed 017 erasures without issuing another permit or touching any new target.
UPDATE pilot.approvals SET provider_location=provider_location WHERE mfa_at IS NULL;
