# Shared schemas

US-004 / ADR-0019. `src/index.ts` exports zod schemas and inferred types for both
API and future app consumers. Health has an empty strict query schema and a
strict response with `database` and `storage`, each `ok` or `error`. Sanitized
error responses have a fixed error-code enum. No dependency messages or personal
data enter these contracts. The API uses these same schemas for validation,
serialization and its generated OpenAPI artifact.

`pnpm --filter @mccarriviera/shared test` checks accepted and rejected contracts.
