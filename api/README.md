# API

US-004 local skeleton; ADR-0012/0016/0019/0022. Fastify with shared zod request
and response schemas, Kysely/pg and an authenticated S3 HeadBucket probe.
`GET /api/health` (and generated HEAD) returns `{ database, storage }`, each
`ok` or `error`: 200 only when both succeed, otherwise 503. Each parallel probe
has a bounded timeout; database connection/query/statement timeouts and S3
abort prevent dependency failures from holding requests open.

Run the [local stack](../deploy/README.md), or load its external environment and
run `pnpm --filter @mccarriviera/api start`. The host port defaults to 3001.
Shutdown closes database connections and the S3 client.

`pnpm --filter @mccarriviera/api openapi` regenerates `openapi.json` from the
shared schemas. A unit test compares the artifact with runtime generation.
There is no Swagger UI route. `test` runs injected unit requests;
`test:integration` requires the migrated disposable Postgres 17 and initialized
Garage described in the deployment guide, and fails on missing configuration.

Pino logs contain a generated timestamp, event, normalized method and HTTP status
only for requests. Request bodies, headers, URLs, query strings, IPs, caller
request IDs and raw errors are excluded. Configuration errors are sanitized.
The registered-route audit enumerates GET and automatically generated HEAD
routes. Only health is public; other routes must attach the actual
`requireSession` preHandler. It denies all access until US-010 supplies sessions.
A global guard also denies nonpublic requests by default; a metadata flag
cannot satisfy the audit. No login or session table is introduced here.
