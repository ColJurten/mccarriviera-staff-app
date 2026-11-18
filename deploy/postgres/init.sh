#!/bin/sh
set -eu
# psql quotes values as SQL literals, even if a generated password changes format.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  --set=api_password="$MCR_API_DB_PASSWORD" --set=mcr_password="$MCR_DB_PASSWORD" <<'SQL'
CREATE ROLE mcr LOGIN PASSWORD :'mcr_password';
CREATE ROLE mcr_api NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
CREATE ROLE mcr_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT PASSWORD :'api_password';
GRANT mcr_api TO mcr_runtime;
CREATE DATABASE mcr OWNER mcr;
REVOKE ALL ON DATABASE mcr FROM PUBLIC;
GRANT CONNECT ON DATABASE mcr TO mcr_api;
SQL
