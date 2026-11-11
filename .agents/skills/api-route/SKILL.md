---
name: api-route
description: Use when adding or changing a route in the Fastify API (api/src/routes), its zod schemas in packages/shared, its session check, file links, logging or its tests.
---

# API routes

The source of truth is [ADR-0012](../../../docs/adr/0012-authentication-and-authorisation.md),
[ADR-0014](../../../docs/adr/0014-file-storage.md),
[ADR-0017](../../../docs/adr/0017-crash-reporting.md),
[ADR-0019](../../../docs/adr/0019-backend-own-api-postgres-s3.md) and
[api/README.md](../../../api/README.md). This skill is a checklist; when it
disagrees with them, they win: say so in the PR.

## Shape of a route

- One file per area in `api/src/routes/`, registered from `buildApp` in
  `api/src/app.ts`, under `/api/`. Follow `routes/health.ts`.
- Request and response schemas are **zod schemas in `packages/shared/src/`**,
  exported from its `index.ts`, so the app validates the same shapes. Declare a
  response schema for every status the route returns, `400` and `401` included,
  and an `operationId`.
- Errors are `{ "error": "<code>" }`, as the global handlers already send.
- `buildApp` sets `bodyLimit: 1024`. A route that needs a larger body sets its
  own limit; files never go through the API (below).

## Access

- Every route except health and the sign-in routes attaches the
  **`requireSession` preHandler** from `api/src/route-policy.ts`. The route audit
  fails `app.ready()` and `api/test/route-audit.test.ts` otherwise, and a global
  guard denies non-public requests. Never add a route to `publicRoutes` without
  a story that says so.
- Business rules on data the API can't trust come from the database: state
  changes call the SQL functions ([db-migrations](../db-migrations/SKILL.md)),
  never an UPDATE of a status column.
- **Files:** the API checks the session, what the file belongs to, its kind and
  its size, then returns a presigned S3 link valid for 5 minutes at most. The
  phone uploads and downloads directly; the API confirms the upload and records
  its metadata row. Evidence buckets are never deleted from.
- Signing routes are idempotent: the same drawing for the same preview returns
  the first result ([US-044](../../../docs/stories/US-044-client-signs-in-the-app.md)).

## Logging and errors

- Logs never contain request bodies, headers, URLs, query strings, IP
  addresses, tokens or personal data. Log an event name and a status, as the
  existing `onResponse` hook does.
- Errors sent to Sentry follow the same rule; identify a user by the staff
  profile ID only.

## After the change

```sh
pnpm --filter @mccarriviera/api openapi   # regenerates api/openapi.json; a test compares it
pnpm --filter @mccarriviera/api test      # injected requests, no database needed
pnpm check
```

- Unit tests use `app.inject()` in `api/test/`. Cover: no session (401), bad
  input (400), the success path, and the refusals the story lists.
- Tests that need Postgres and Garage go in `api/integration/` and run with
  `pnpm --filter @mccarriviera/api test:integration` against the local stack.
- Synthetic data only.

## Stop and ask

If a story needs a public route, a new kind of file access, or data the docs
don't describe, stop and ask instead of choosing.
