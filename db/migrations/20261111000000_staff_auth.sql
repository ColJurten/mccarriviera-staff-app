-- migrate:up
-- Better Auth 1.7.20 core + two-factor storage. Business grants stay unchanged.
CREATE TABLE auth_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(80) NOT NULL,
  email varchar(254) NOT NULL UNIQUE CHECK (email = lower(email)),
  email_verified boolean NOT NULL DEFAULT false,
  image varchar(2048),
  two_factor_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE auth_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  account_id varchar(254) NOT NULL,
  provider_id varchar(80) NOT NULL,
  password varchar(512),
  access_token varchar(4096),
  refresh_token varchar(4096),
  id_token varchar(4096),
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope varchar(1024),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(provider_id, account_id)
);
CREATE INDEX auth_accounts_user ON auth_accounts(user_id);
CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  token varchar(256) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  ip_address varchar(128),
  user_agent varchar(512),
  mode varchar(20) NOT NULL CHECK (mode IN ('native', 'web_pending', 'web')),
  authenticated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX auth_sessions_user ON auth_sessions(user_id);
CREATE TABLE auth_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier varchar(512) NOT NULL,
  value varchar(4096) NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX auth_verifications_identifier ON auth_verifications(identifier);
CREATE TABLE auth_two_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth_users(id) ON DELETE CASCADE,
  secret varchar(2048) NOT NULL,
  backup_codes varchar(4096) NOT NULL,
  verified boolean NOT NULL DEFAULT true,
  failed_verification_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz
);
-- Browser receives only an opaque flow token. Library cookies stay encrypted here.
CREATE TABLE auth_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash varchar(64) NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  state varchar(20) NOT NULL CHECK (state IN ('enrollment', 'challenge')),
  internal_cookie varchar(8192) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX auth_flows_user ON auth_flows(user_id);
CREATE TABLE auth_rate_limits (
  key varchar(64) PRIMARY KEY,
  count integer NOT NULL,
  window_started_at timestamptz NOT NULL
);
ALTER TABLE staff_profiles ADD COLUMN active boolean NOT NULL DEFAULT true;
-- Keep the nullable historical varchar link; new accounts use UUID strings.
GRANT SELECT, INSERT, UPDATE, DELETE ON auth_users, auth_accounts, auth_sessions,
  auth_verifications, auth_two_factors, auth_flows, auth_rate_limits TO mcr_api;
GRANT UPDATE(active) ON staff_profiles TO mcr_api;

-- migrate:down
ALTER TABLE staff_profiles DROP COLUMN active;
DROP TABLE auth_rate_limits, auth_flows, auth_two_factors, auth_verifications,
  auth_sessions, auth_accounts, auth_users;
