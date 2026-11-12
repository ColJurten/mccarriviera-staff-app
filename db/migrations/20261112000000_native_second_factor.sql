-- migrate:up
-- Invalidate password-only native sessions and all pre-change pending contexts.
DELETE FROM auth_sessions WHERE mode IN ('native', 'web_pending');
DELETE FROM auth_flows;
DELETE FROM auth_verifications;
ALTER TABLE auth_sessions DROP CONSTRAINT auth_sessions_mode_check;
ALTER TABLE auth_sessions ADD CONSTRAINT auth_sessions_mode_check
  CHECK (mode IN ('native_pending', 'native', 'web_pending', 'web'));
ALTER TABLE auth_flows ADD COLUMN mode varchar(20) NOT NULL
  CHECK (mode IN ('native', 'web'));
-- Serialization now uses an advisory lock, shared with owner-only commands.
REVOKE UPDATE(active) ON staff_profiles FROM mcr_api;

-- migrate:down
DELETE FROM auth_sessions WHERE mode = 'native_pending';
DELETE FROM auth_flows;
ALTER TABLE auth_flows DROP COLUMN mode;
ALTER TABLE auth_sessions DROP CONSTRAINT auth_sessions_mode_check;
ALTER TABLE auth_sessions ADD CONSTRAINT auth_sessions_mode_check
  CHECK (mode IN ('native', 'web_pending', 'web'));
GRANT UPDATE(active) ON staff_profiles TO mcr_api;
