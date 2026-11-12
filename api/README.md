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
Run `pnpm format` after generation, then `pnpm check`, so the committed JSON
also satisfies the repository's formatting checks.
There is no Swagger UI route. `test` runs injected unit requests;
`test:integration` requires the migrated disposable Postgres 17 and initialized
Garage described in the deployment guide, and fails on missing configuration.

Pino logs contain a generated timestamp, event, normalized method and HTTP status
only for requests. Request bodies, headers, URLs, query strings, IPs, caller
request IDs and raw errors are excluded. Configuration errors are sanitized.
The registered-route audit enumerates GET and automatically generated HEAD
routes. Health and the six exact sign-in/continuation POST routes below are
public. Every other route attaches the actual `requireSession` preHandler.
A global guard resolves the session and active profile from Postgres on every
request; a metadata flag cannot satisfy the audit. It fails closed on database
errors with a sanitized `auth_storage_unavailable` event and 503 (so clients can
retain their credentials during an outage). `request.staff` supplies the staff/user/session IDs to later routes.

## Authentication contract

Better Auth is pinned to 1.7.20. Its password hashing, database adapter, sessions
and two-factor plugin run internally; its wildcard handler, signup, e-mail
reset, factor disabling, trusted-device bypass and administration endpoints
are never mounted. Account commands are in [the runbook](../docs/runbook.md).

| Method/path                     | Input                                             | Result                                                                 |
| ------------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------- |
| POST `/api/auth/native/sign-in` | `{ email, password }`                             | `{ next: "enrollment" \| "challenge", flowToken }`; no active session  |
| POST `/api/auth/native/enroll`  | `{ flowToken, password }`                         | `{ totpURI, backupCodes }`; first enrollment only                      |
| POST `/api/auth/native/verify`  | `{ flowToken, kind: "totp" \| "backup", code }`   | `{ token, session }`; native bearer (see integration open point below) |
| POST `/api/auth/web/sign-in`    | `{ email, password }`                             | `{ next: "enrollment" \| "challenge" }` and a restricted flow cookie   |
| POST `/api/auth/web/enroll`     | `{ password }`, flow cookie                       | `{ totpURI, backupCodes }`; first enrollment only                      |
| POST `/api/auth/web/verify`     | `{ kind: "totp" \| "backup", code }`, flow cookie | Public session shape and the complete web-session cookie               |
| GET `/api/auth/session`         | Active native bearer or web cookie                | `{ staffId, displayName, mode, expiresAt }`                            |
| POST `/api/auth/sign-out`       | `{}`, active session                              | Revokes current session; clears web cookies                            |

Enrollment must verify a TOTP before any business access. Backup codes are
delivered during enrollment and each is consumable once after enrollment.
Render the URI/QR locally; it contains a secret. Every new native or web sign-in
needs a factor. Native body flow tokens and web flow cookies authorize only enrollment/
verification and expire after 10 minutes. A new sign-in replaces that identity's
pending flow in the same mode. Completing first enrollment invalidates all other
pending enrollment contexts in both modes.
All auth responses use `Cache-Control: no-store`. No web token is returned in
JSON or a bearer response header. Only successful native factor verification
returns an active token.

Native requests use `Authorization: Bearer <token>`, without cookies, Origin or
browser fetch headers. Native sessions renew to 30 days from each use, capped at
90 days from immutable
`authenticated_at` (the original password authentication). Factor completion does
not reset that time. An expired session requires password and factor again. Web uses
`__Host-mcr-session`: HttpOnly, Secure, SameSite=Strict, Path=/, no Domain.
Every request renews its 30-minute idle limit, capped at 12 hours from password
authentication. The web and native contexts share credentials but sessions
cannot be substituted between transports. Mixed credentials are refused.

Serve browser and API under the same HTTPS origin. Set `AUTH_BASE_URL` and
comma-separated `AUTH_TRUSTED_ORIGINS` to exact HTTPS origins, and a random,
server-only `AUTH_SECRET` of at least 32 characters. Browser POSTs must carry a
trusted Origin; GET/HEAD may omit it. Cross-site fetches are refused. CORS is
not enabled, and native token responses are not exposed to browser origins.
Missing browser headers do not attest an iPhone or replace a second factor.
Every native sign-in also requires MFA. Face ID only unlocks the local app. The
explicit API routes do not serve Better Auth's Expo plugin protocol. This is an
open point: ADR-0012 and US-010 AC3 still require that integration. The developer
must reconcile the mismatch before the front-end ticket. Direct bearer storage
with expo-secure-store is an option for that decision, not an approved mechanism.
Screens and device integration remain their own stories.

Passwords need 12–128 characters when provisioned/reset. Unknown e-mail and
wrong password return the same `401 { error: "invalid_credentials" }`; factor
failures return `invalid_factor`. Password entry points share a persisted
3-per-10-second limit per client IP; enrollment/TOTP/backup entry points share a
separate per-IP limit, returning `429 { error: "rate_limited" }`. A shared
native/web account budget permits at most three failed passwords per 10-second
window, including unknown/inactive accounts and enrollment password checks.
Normalization is case-insensitive, with HMAC keys instead of stored e-mails/IPs.
Correct passwords do not consume the account failure budget. Counters survive
app restarts and failed authentication work. Failures may temporarily lock an
account even from another IP; attempts during lockout do not extend the account
window. Once the attacker stops, the account budget recovers within 10 seconds.
A continuing attacker can restart the lockout every window: one anonymous client
sending three wrong passwords every 10 seconds can keep a named staff account
locked out indefinitely, even with correct Caddy configuration. A distributed
guesser still gets about 25,920 password guesses per account per day at this
limit; a guessed password still requires TOTP. These residual risks need developer
review when tuning the window. Per-IP limits count all attempts, including
successes. IPs/user agents are not stored on sessions.

`TRUSTED_PROXY_IP` is optional: unset/empty means Fastify trusts no forwarding.
Behind Caddy set it to the single literal address the API sees as its immediate
peer. Only that peer at hop zero is trusted; earlier entries in a forged
X-Forwarded-For chain cannot replace the rightmost client supplied by Caddy.
Caddy's default reverse_proxy forwarding appends the connection client address
and ignores untrusted incoming X-Forwarded-* values. Restrict API ingress to the
proxy in deployed environments and update the setting if its address changes.
Do not set a subnet, hostname, hop count or `true`. Direct local mode remains
usable without this variable. Leaving it unset behind a shared proxy combines
all clients into one IP bucket: an anonymous request every ~3 seconds can deny
staff sign-in continuously. Configuring/verifying the Caddy peer is a staging
and production prerequisite (US-004).
Better Auth's server API bypasses its HTTP limiter, so wrappers apply these
limits explicitly, including in development/tests. See its
[rate-limit documentation](https://better-auth.com/docs/concepts/rate-limit).

Cookie caching and library refresh are disabled. The session resolver performs
a conditional database UPDATE to check and renew the current session, preserving
the hard cap. Account/factor operations share a per-identity advisory transaction lock,
serializing challenge completion with deactivation/reset. Library runtime schema
introspection is disabled for transaction-bound Kysely instances (its connection
helper does not support transactions); migrations, `db:check` and integration
tests validate the mapped storage. Health and offline OpenAPI generation do not
connect to authentication storage.

Better Auth 1.7.20 stores raw session tokens; it has no supported session hashing
option across creation, lookup and MFA. A database reader could replay a complete
session token until expiry/revocation. Keep database access restricted, tokens out
of logs, session caches disabled and expiry/revocation enforced; see the explicit
trade-off in [ADR-0012](../docs/adr/0012-authentication-and-authorisation.md).
