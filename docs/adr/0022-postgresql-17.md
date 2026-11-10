# ADR-0022: PostgreSQL 17 in every environment

| Status | Date | Decided by | Based on |
|---|---|---|---|
| **Accepted** | 2026-11-05 (updated 2026-11-10) | Developer | F-21 (answered) |

## Context

- [ADR-0019](0019-backend-own-api-postgres-s3.md) puts production on Scaleway Managed Database for PostgreSQL. [ADR-0016](0016-repository-environments-ci.md) and ADR-0019 require local, CI and staging to run the same major version as production, but no version was chosen. The coding agent stopped on ticket #4 (US-004, local stack) for that reason (F-21).
- Checked on 2026-11-05:
  - upstream support: PostgreSQL 16 until 9 November 2028, 17 until 8 November 2029, 18 until 14 November 2030. PostgreSQL 14 reaches its end of life on 12 November 2026. PostgreSQL 19 is a release candidate;
  - Scaleway's Managed Database documentation lists PostgreSQL 16 and 17. PostgreSQL 18 could not be confirmed there;

## Decision

- **PostgreSQL 17** is the major version in every environment (F-21):
  - production: Scaleway Managed Database for PostgreSQL, engine version 17, chosen when the instance is created;
  - staging: the official `postgres` image, version 17, on the homelab VM;
  - local: the same image in `deploy/compose.local.yml`;
  - CI: a throwaway PostgreSQL 17 for the database and API tests.
- Container images are pinned to an exact minor version (`postgres:17.N`), never `latest` or a bare major. Minor versions are updated regularly in every environment without a new ADR (`RECOMMENDED`).
- The `mcr` database runs on the PostgreSQL 17 server of each environment (ADR-0019). Documenso, which also used it, was removed on 2026-11-10 ([ADR-0023](0023-signatures-in-the-app-sealed-by-the-api.md)).

## Consequences

**Positive**

- One version to build and test against, everywhere.
- Supported upstream until November 2029.

**Negative / risks**

- A major upgrade is needed before November 2029. It means a new ADR and a planned upgrade of production, staging, local and CI together.
- PostgreSQL 18 features are not available until that upgrade.

## Alternatives considered

| Option | Why not chosen |
|---|---|
| PostgreSQL 18 | Supported a year longer, but not confirmed on Scaleway Managed Database on 2026-11-05 |
| PostgreSQL 16 | Offered by Scaleway, but its support ends a year earlier (November 2028) |
| PostgreSQL 19 | Release candidate only |
| No pinned version (whatever the provider offers when ordering) | Local, CI and staging couldn't be matched to production in advance, as ADR-0016 and ADR-0019 require |

## Revisit when

Scaleway offers PostgreSQL 18 or later and an upgrade is worth it, or by early 2029 at the latest, before PostgreSQL 17's support ends.

## Changes

- 2026-11-05: written, from the answer to F-21.
- 2026-11-10: Documenso is removed ([ADR-0023](0023-signatures-in-the-app-sealed-by-the-api.md)), so only the `mcr` database remains.

## Implemented by

- [US-004](../stories/US-004-api-server-and-environments.md): Create the API server and its environments: local, homelab staging, Scaleway production (ticket #4 for the local stack)
