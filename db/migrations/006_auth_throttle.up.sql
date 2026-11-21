CREATE TABLE pilot.auth_throttle_key (
    singleton boolean PRIMARY KEY CHECK (singleton),
    key_hash text NOT NULL CHECK (key_hash ~ '^[a-f0-9]{64}$')
);
CREATE TABLE pilot.auth_throttle_buckets (
    flow text NOT NULL CHECK (flow IN ('login','signup','recovery','resend')),
    dimension text NOT NULL CHECK (dimension IN ('account','source')),
    bucket_key text NOT NULL CHECK (bucket_key ~ '^[a-f0-9]{64}$'),
    attempts timestamptz[] NOT NULL,
    expires_at timestamptz NOT NULL,
    PRIMARY KEY (flow,dimension,bucket_key),
    CHECK (array_ndims(attempts)=1 AND array_lower(attempts,1)=1 AND array_position(attempts,NULL) IS NULL),
    CHECK (cardinality(attempts) BETWEEN 1 AND
      CASE WHEN flow='login' THEN CASE WHEN dimension='account' THEN 5 ELSE 30 END
      ELSE CASE WHEN dimension='account' THEN 3 ELSE 10 END END),
    CHECK (expires_at=attempts[cardinality(attempts)] +
      CASE WHEN flow='login' THEN interval '15 minutes' ELSE interval '1 hour' END)
);
CREATE INDEX auth_throttle_expiry ON pilot.auth_throttle_buckets(expires_at);

-- Internal SQL primitive: caller holds (154,1) and supplies the post-lock database clock.
CREATE FUNCTION pilot.charge_auth_throttle(p_flow text, p_dimension text, p_key text, p_now timestamptz)
RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE
    allowance integer;
    window_size interval;
    previous timestamptz[];
    live timestamptz[];
BEGIN
    IF p_flow IS NULL OR p_flow NOT IN ('login','signup','recovery','resend')
      OR p_dimension IS NULL OR p_dimension NOT IN ('account','source')
      OR p_now IS NULL OR NOT isfinite(p_now) THEN
        RAISE EXCEPTION 'Throttle unavailable';
    END IF;
    allowance := CASE WHEN p_flow='login' THEN CASE WHEN p_dimension='account' THEN 5 ELSE 30 END
      ELSE CASE WHEN p_dimension='account' THEN 3 ELSE 10 END END;
    window_size := CASE WHEN p_flow='login' THEN interval '15 minutes' ELSE interval '1 hour' END;
    SELECT attempts INTO previous FROM pilot.auth_throttle_buckets
      WHERE flow=p_flow AND dimension=p_dimension AND bucket_key=p_key;
    IF EXISTS (SELECT 1 FROM unnest(previous) AS stamp WHERE stamp>p_now) THEN
        RAISE EXCEPTION 'Throttle unavailable';
    END IF;
    live := ARRAY(SELECT stamp FROM unnest(previous) AS stamp
      WHERE stamp>p_now-window_size AND stamp<=p_now ORDER BY stamp);
    INSERT INTO pilot.auth_throttle_buckets(flow,dimension,bucket_key,attempts,expires_at)
      VALUES(p_flow,p_dimension,p_key,
        (live || p_now)[greatest(1,cardinality(live)+2-allowance):],p_now+window_size)
      ON CONFLICT (flow,dimension,bucket_key) DO UPDATE
        SET attempts=EXCLUDED.attempts,expires_at=EXCLUDED.expires_at;
    RETURN cardinality(live)<allowance;
END;
$$;
REVOKE ALL ON FUNCTION pilot.charge_auth_throttle(text,text,text,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pilot.charge_auth_throttle(text,text,text,timestamptz) TO pilot_app;
GRANT SELECT, INSERT ON pilot.auth_throttle_key TO pilot_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON pilot.auth_throttle_buckets TO pilot_app;
