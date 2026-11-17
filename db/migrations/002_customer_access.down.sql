DROP TABLE pilot.browser_flows;
DROP TABLE pilot.public_sessions;
DROP TABLE pilot.rate_windows;
DROP TABLE pilot.identity_completions;
DROP TABLE pilot.identity_operations;
ALTER TABLE pilot.sessions DROP COLUMN csrf_hash, DROP COLUMN mfa_credential_id;
ALTER TABLE pilot.pending_access DROP COLUMN identity_generation, DROP COLUMN subject;
ALTER TABLE pilot.identities DROP COLUMN email, DROP COLUMN generation, DROP COLUMN lifecycle;
