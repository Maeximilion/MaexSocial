ALTER TABLE pilot.attempts ADD COLUMN resource_name text;
GRANT UPDATE (resource_name) ON pilot.attempts TO pilot_app;
