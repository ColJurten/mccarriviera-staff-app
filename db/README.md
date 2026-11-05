# Database migrations

US-004 local foundation; ADR-0016/0019/0022. PostgreSQL 17.11 locally and in CI,
with separate database owners for `mcr` and `documenso`. The first dbmate migration
has empty up/down sections. No business or staff/session tables exist yet.

Load the external local configuration as described in [deploy](../deploy/README.md).
From the repository root:

```sh
pnpm db:migrate
pnpm db:generate
pnpm db:check
```

`db:migrate` runs dbmate up without a schema dump. `db:generate` introspects the
app database with kysely-codegen, formats the result and writes
`api/src/db/generated.ts`. `db:check` regenerates into an external temporary
directory, compares, and fails on drift without changing the committed file.
Only dbmate's `schema_migrations` metadata is present now. CI migrates a disposable
PostgreSQL 17 database before checking types and real API driver queries.
Never run destructive tests against staging or production.
