# API

US-004 skeleton and US-010/012/015 server-side authentication;
ADR-0012/0013/0016/0019/0021/0022. Fastify with shared zod request
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
routes. Health and the four exact sign-in/continuation POST routes below are
public. Every other route attaches the actual `requireSession` preHandler.
A global guard resolves the session and active profile from Postgres on every
request; a metadata flag cannot satisfy the audit. It fails closed on database
errors. `request.staff` supplies the staff/user/session IDs to later routes.

## Authentication contract

Better Auth is pinned to 1.7.20. Its password hashing, database adapter, sessions
and two-factor plugin run internally; its wildcard handler, signup, e-mail
reset, factor disabling, trusted-device bypass and administration endpoints
are never mounted. Account commands are in [the runbook](../docs/runbook.md).

| Method/path                     | Input                                             | Result                                                               |
| ------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------- |
| POST `/api/auth/native/sign-in` | `{ email, password }`                             | `{ token, session }`; store token in Keychain in the native client   |
| POST `/api/auth/web/sign-in`    | `{ email, password }`                             | `{ next: "enrollment" \| "challenge" }` and a restricted flow cookie |
| POST `/api/auth/web/enroll`     | `{ password }`, flow cookie                       | `{ totpURI, backupCodes }`; first web enrollment only                |
| POST `/api/auth/web/verify`     | `{ kind: "totp" \| "backup", code }`, flow cookie | Public session shape and the complete web-session cookie             |
| GET `/api/auth/session`         | Active native bearer or web cookie                | `{ staffId, displayName, mode, expiresAt }`                          |
| POST `/api/auth/sign-out`       | `{}`, active session                              | Revokes current session; clears web cookies                          |

Enrollment must verify a TOTP before any business access. Backup codes are
delivered during enrollment and each is consumable once after enrollment.
Render the URI/QR locally; it contains a secret. Every new web sign-in needs a
factor. Flow cookies authorize only enrollment/verification and expire after
10 minutes. Starting a new web sign-in replaces that identity's pending flow.
All auth responses use `Cache-Control: no-store`. No web token is returned in
JSON or a bearer response header. Only the native endpoint returns a token.

Native requests use `Authorization: Bearer <token>`, without cookies, Origin or
browser fetch headers. Native sessions renew to 30 days from each use. Web uses
`__Host-mcr-session`: HttpOnly, Secure, SameSite=Strict, Path=/, no Domain.
Every request renews its 30-minute idle limit, capped at 12 hours from password
authentication. The web and native contexts share credentials but sessions
cannot be substituted between transports. Mixed credentials are refused.

Serve browser and API under the same HTTPS origin. Set `AUTH_BASE_URL` and
comma-separated `AUTH_TRUSTED_ORIGINS` to exact HTTPS origins, and a random,
server-only `AUTH_SECRET` of at least 32 characters. Browser POSTs must carry a
trusted Origin; GET/HEAD may omit it. Cross-site fetches are refused. CORS is
not enabled, and native token responses are not exposed to browser origins.
The API does not attest a physical iPhone; the frontend's Keychain/Face ID and
browser flows remain their own stories.

Passwords need 12–128 characters when provisioned/reset. Unknown e-mail and
wrong password return the same `401 { error: "invalid_credentials" }`; factor
failures return `invalid_factor`. Password entry points share a persisted
3-per-10-second limit per connection address; enrollment/TOTP/backup entry
points share a separate limit, returning `429 { error: "rate_limited" }`.
Counters use keyed address hashes; IPs/user agents are not stored on sessions.
Fastify does not trust forwarding headers. A reverse proxy therefore shares
one counter across its clients; changing this requires an explicit trusted
proxy configuration. The two-person MVP can use the conservative shared limit.
Better Auth's server API bypasses its HTTP limiter, so wrappers apply these
limits explicitly, including in development/tests. See its
[rate-limit documentation](https://better-auth.com/docs/concepts/rate-limit).

Cookie caching and library refresh are disabled. The session resolver performs
a conditional database UPDATE to check and renew the current session, preserving
the hard cap. Account/factor operations lock the profile in a transaction,
serializing challenge completion with deactivation/reset. Library runtime schema
introspection is disabled for transaction-bound Kysely instances (its connection
helper does not support transactions); migrations, `db:check` and integration
tests validate the mapped storage. Health and offline OpenAPI generation do not
connect to authentication storage.
