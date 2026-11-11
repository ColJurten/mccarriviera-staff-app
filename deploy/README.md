# Local backend (US-004, part 1)

WSL2 with Docker Engine/Compose v2, OpenSSL, Node 22.21.1 and pnpm 12.16.1.
Use synthetic data only. This implements the local slice of US-004 under
ADR-0012, ADR-0014, ADR-0016, ADR-0019, ADR-0020 and ADR-0022. Staging,
production and signing integration come later. Business tables and server-side
staff sessions are now implemented by US-006 and US-010/012/015.

## First start

From the repository root, choose a private directory outside **every checkout**
(no spaces or shell characters in the path). Never copy `.env.example` into a
usable configuration: its values are intentionally fake. Never print `local.env`
or run Compose `config` without `--quiet` on a secret-bearing configuration.

```sh
export LOCAL_SECRETS_DIR="$HOME/.local/state/mcr-local"
bash scripts/local-secrets.sh
export LOCAL_ENV_FILE="$LOCAL_SECRETS_DIR/local.env"
docker compose --env-file "$LOCAL_ENV_FILE" -f deploy/compose.local.yml config --quiet
docker compose --env-file "$LOCAL_ENV_FILE" -f deploy/compose.local.yml up -d --build --wait
curl --fail http://localhost:3001/api/health
curl --fail http://localhost:3000/api/certificate-status
```

The first command creates mode-600 local configuration and a one-year,
passphrase-protected, synthetic self-signed `.p12`. The parent directory is 700.
The certificate alone is 644 so Documenso's unmodified UID 1001 can read the
individual read-only bind mount; its private parent prevents other host users
from reaching it. Its passphrase stays 600. Generation refuses to overwrite
existing material. To check it independently:

```sh
bash scripts/local-signing-certificate.sh --check
```

Documenso's `/api/certificate-status` must return `isAvailable: true`; this
checks that the mounted certificate opens with its configured passphrase and
is in date. A local self-signed certificate is for development, never an
assertion of trusted identity. To renew, stop Documenso, move the old external
certificate and passphrase to protected backup, generate new ones, update the
passphrase in external `local.env`, and recreate Documenso.

| Service        | Local URL / port                 |
| -------------- | -------------------------------- |
| API health     | http://localhost:3001/api/health |
| Documenso      | http://localhost:3000            |
| Mailpit web UI | http://localhost:8025            |
| Mailpit SMTP   | localhost:1025                   |
| PostgreSQL     | localhost:5432                   |
| Garage S3      | http://localhost:3900            |

Published ports bind only to loopback. Keep these ports free. PostgreSQL
17.11 has separate `mcr` and `documenso` owners; PUBLIC connection privileges
are revoked on both databases. Documenso applies its own upstream migrations.
Garage 2.1.0 initializes a single-node layout, imports the externally generated
key and creates five private buckets repeatably. The API key gets read/write
access to four app buckets, **no access** to `documenso`. Documenso stores
files in its database locally; that fifth bucket is reserved and unused.
Garage does not implement Scaleway bucket policies/versioning equivalently;
evidence immutability and upload endpoints are US-006 work, tested against
Scaleway on staging. Do not use this local stack for production evidence.

## Staff authentication configuration

The external generator now creates `AUTH_SECRET`, `AUTH_BASE_URL` and
`AUTH_TRUSTED_ORIGINS`; Compose passes them only to the API. Existing external
configurations need a fresh random auth secret (at least 32 characters) and exact
trusted HTTPS origins added in the protected file. Never print their values.
Keep the secret stable across restarts and instances. `.env.example` is inert
and deliberately fails auth validation.

Secure cookies are required locally too. Health and native injected tests can
use HTTP, but a browser needs a trusted local HTTPS reverse proxy serving the
web app and `/api/` under the same origin. Set the two URL settings to that
origin; the API's internal Compose listener remains HTTP behind the proxy.
There is no development switch to weaken cookie security. The future frontend
slice supplies browser screens and HTTPS development integration. The API does
not trust caller forwarding headers; rate limits use its connection address.
Behind a proxy the two staff share the conservative request budget.

Create/revoke/reset staff with [the account runbook](../docs/runbook.md). Only
the developer process loads the owner URL; do not add it to the API container.

## Local Documenso administrator and mail check

Public sign-up stays disabled throughout. After Documenso is healthy, create
only the synthetic local administrator in its own database:

```sh
docker compose --env-file "$LOCAL_ENV_FILE" -f deploy/compose.local.yml exec -T postgres \
  psql -U postgres -d documenso -v ON_ERROR_STOP=1 < deploy/postgres/bootstrap-documenso.sql
```

This password-null, verified account follows the pinned release's
[`createAdminUser`](https://github.com/documenso/documenso/blob/v2.20.0/packages/lib/server-only/user/create-admin-user.ts)
model. The database `ADMIN` role assignment is the upstream
[administration mechanism](https://docs.documenso.com/docs/self-hosting/getting-started/quick-start).
The local SQL bootstrap is maintained here; upstream's normal initial signup
instructions require temporarily opening registration, so they are not used.
Open http://localhost:3000/forgot-password, enter `admin@example.test`, then
open Mailpit and follow the reset link to choose a local password. This tests
Documenso → Mailpit SMTP delivery without creating API tokens or webhooks.
Sign in and use the admin UI to create local organisations/accounts as needed.
Confirm `/signup` offers no working public registration. No upstream image
patch or application seed is installed.

Configuration and certificate guidance were checked against the unmodified
[Documenso v2.20.0 deployment](https://github.com/documenso/documenso/blob/v2.20.0/docker/production/compose.yml)
and [certificate status implementation](https://github.com/documenso/documenso/blob/v2.20.0/packages/lib/server-only/cert/cert-status.ts).
Other image pins: PostgreSQL 17.11-bookworm, Garage v2.1.0, Mailpit v1.33.0;
Garage's one-shot initializer adds a shell from Alpine 3.22.2, leaving the
service image unchanged. Update pins deliberately and repeat runtime checks.

## Migrations and host development

```sh
set -a
source "$LOCAL_ENV_FILE"
set +a
pnpm db:migrate
pnpm db:generate
pnpm db:check
pnpm --filter @mccarriviera/api test:integration
```

The initial foundation migration stays empty; US-006 adds the 18 business tables,
constraints, runtime grants and number-reservation helpers. `db:check` compares
freshly generated, formatted Kysely types with the committed file. Run migrations
before starting features that need them. To run the API on the host, stop its
Compose service first, then `pnpm --filter @mccarriviera/api start`; external
configuration contains loopback endpoints for this use.

## Stop, restart, reset

```sh
# Stop without deleting local data.
docker compose --env-file "$LOCAL_ENV_FILE" -f deploy/compose.local.yml stop
# Restart/reconcile services; initialization preserves the existing layout/key/buckets.
docker compose --env-file "$LOCAL_ENV_FILE" -f deploy/compose.local.yml up -d --build --wait
# Remove containers/network, retain volumes.
docker compose --env-file "$LOCAL_ENV_FILE" -f deploy/compose.local.yml down
# DESTRUCTIVE local reset: deletes BOTH databases and ALL Garage objects.
docker compose --env-file "$LOCAL_ENV_FILE" -f deploy/compose.local.yml down -v
```

Reset keeps external secrets/certificate. Start again and reapply migrations and
synthetic administrator bootstrap. Existing PostgreSQL passwords are not changed
by editing the env file: retain the generated file for existing volumes. Never
rotate Garage keys by simply replacing the file; its old grants persist. Reset
disposable volumes before generating a new local identity.

For dependency-failure checks, stop `postgres` or `garage` separately and request
health: expect HTTP 503 and only `ok`/`error` statuses. Restart and expect HTTP
200 with both `ok`. The API's generated OpenAPI file is `api/openapi.json`;
there are no public documentation routes. See [testing](../docs/testing.md).

## Database role separation (US-006 part 1)

Generate new local configuration with `scripts/local-secrets.sh` into a new
external directory. It now contains `MIGRATION_DATABASE_URL` for the database
owner, `DATABASE_URL` for `mcr_runtime`, and a separate `MCR_API_DB_PASSWORD`.
The API container uses the runtime password; migration, seed and code generation
require the owner URL. Never give the owner connection to the API.

On a new volume, `postgres/init.sh` provisions `mcr_api` (NOLOGIN privileges) and
`mcr_runtime` (LOGIN, inherits only `mcr_api`) and grants database CONNECT. The
owner applies schema grants through migrations. Keep Documenso's separate
owner/database unchanged until its removal ticket.

Existing PostgreSQL volumes do not rerun initialization. Preserve the volume,
regenerate external configuration in a new directory (carry over existing owner,
administrator and service credentials privately), and recreate the postgres/API
containers with that configuration. Before migrating, provision the runtime
roles once as the PostgreSQL administrator. In an interactive `psql` session in
the recreated postgres container (`docker compose ... exec postgres psql -U
postgres -d postgres`), use its externally supplied environment variable:

```sql
\getenv api_password MCR_API_DB_PASSWORD
CREATE ROLE mcr_api NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
CREATE ROLE mcr_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT PASSWORD :'api_password';
GRANT mcr_api TO mcr_runtime;
GRANT CONNECT ON DATABASE mcr TO mcr_api;
```

If these roles already exist, inspect their attributes and memberships instead
of recreating them; ensure neither inherits `mcr` or administrator privileges.
Load the external configuration, run `pnpm db:migrate` and restart the API.
`DB_DISPOSABLE=1 pnpm db:seed` and `DB_DISPOSABLE=1 pnpm test --filter db` are
only for isolated synthetic local databases. CI runs both with PostgreSQL 17.
