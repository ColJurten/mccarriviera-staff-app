#!/bin/sh
set -eu
# psql quotes values as SQL literals, even if a generated password changes format.
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
  --set=mcr_password="$MCR_DB_PASSWORD" --set=documenso_password="$DOCUMENSO_DB_PASSWORD" <<'SQL'
CREATE ROLE mcr LOGIN PASSWORD :'mcr_password';
CREATE ROLE documenso LOGIN PASSWORD :'documenso_password';
CREATE DATABASE mcr OWNER mcr;
CREATE DATABASE documenso OWNER documenso;
REVOKE ALL ON DATABASE mcr FROM PUBLIC;
REVOKE ALL ON DATABASE documenso FROM PUBLIC;
SQL
