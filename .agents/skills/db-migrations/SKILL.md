---
name: db-migrations
description: Use when adding or changing database tables, constraints, grants, triggers, SQL functions or seeds in db/ (dbmate migrations on PostgreSQL 17), or when regenerating the Kysely types.
---

# Database migrations and SQL rules

The source of truth is [US-006](../../../docs/stories/US-006-core-database-schema-and-storage.md),
[US-007](../../../docs/stories/US-007-audit-trail-and-immutability.md),
[ADR-0007](../../../docs/adr/0007-contract-lifecycle-and-audit.md),
[ADR-0019](../../../docs/adr/0019-backend-own-api-postgres-s3.md) and
[ADR-0022](../../../docs/adr/0022-postgresql-17.md). This skill is a checklist;
when it disagrees with them, they win: say so in the PR.

## Writing a migration

- One file per change in `db/migrations/`, named
  `YYYYMMDDHHMMSS_short_name.sql`, with a `-- migrate:up` and a
  `-- migrate:down` section (dbmate).
- Never edit a migration that has been merged: add a new one.
- PostgreSQL 17 only. Nothing that needs an extension the managed Scaleway
  database doesn't offer.
- Then, from the repository root, with the local stack running
  ([deploy/README.md](../../../deploy/README.md)):

  ```sh
  pnpm db:migrate    # dbmate up
  pnpm db:generate   # rewrites api/src/db/generated.ts
  pnpm db:check      # fails on type drift; CI runs it too
  ```

## Rules the schema must enforce in the database, not only in the API

- **Status changes only through SQL functions**, each in one transaction:
  `contracts.status`, `vehicles.status`, `damages.status`,
  `stored_signatures.status`. Column grants keep these columns read-only for the
  API's database role.
- **Insert-only** (UPDATE and DELETE rejected by grants and triggers): signed
  revisions, completed inspections, `signatures`, `condition_baselines`,
  `photos`, `contract_documents` (previews included), `audit_events`. Unsigned
  draft revisions can be updated. Damage descriptions and photos never change;
  only the repair fields change, through the maintenance function, and an
  estimate only while its Retour waits for the signature (F-26).
- **One active contract per vehicle:** a partial unique index, plus the checks in
  the transition functions.
- **Contract numbers** (`MCR-YYYY-NNNN`, no gaps): internal, transaction-composable
  reservation and confirmation helpers, **not executable by the API role**. The
  preview transition (number reserved, contract to `awaiting_signature`, vehicle
  held) belongs to US-044, and the signing transaction to US-057. Never expose
  number allocation on its own.
- **Audit:** a trigger on every business table appends to `audit_events` (server
  time, user, action, row, before and after).
- **Values:** codes, never labels (`fuel_type = 'unleaded_95'`); fuel in eighths
  0–8; amounts `numeric(10,2)` in euros; `timestamptz` in UTC; free-text columns
  with maximum lengths, since page 1 of the PDF is dense
  ([ADR-0010](../../../docs/adr/0010-contract-pdf-generation.md),
  [ADR-0011](../../../docs/adr/0011-localisation.md)).
- **Photos** are of kind reference, dashboard or damage; a reference set needs
  front, rear, left and right
  ([ADR-0024](../../../docs/adr/0024-vehicle-condition-four-angles-estimates.md)).

## Tests

- Database tests run against a throwaway PostgreSQL 17 (local stack or CI),
  never staging or production.
- Test what the database refuses, not only what works: an UPDATE of a status
  column as the API role, an UPDATE or DELETE on an insert-only table, a second
  active contract for one vehicle, calling a numbering helper as the API role.
- Seeds and fixtures use synthetic data only: invented people, `example.com`
  e-mails, numbers from ranges reserved for fiction. Never data from the scanned
  contracts.

## Stop and ask

If a story needs a table, a column or a rule that the docs don't describe, or
would change one an ADR fixes, stop and ask instead of choosing.
