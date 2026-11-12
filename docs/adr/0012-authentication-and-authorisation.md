# ADR-0012: Authentication and authorisation: personal accounts, invite-only, every request checked by the API

| Status | Date | Decided by | Based on |
|---|---|---|---|
| **Accepted** | 2026-10-07 (updated 2026-11-12) | Developer, with the client's answers and PR #25 security decisions | B-02 · defaults for T-03, R-16 · F-03 · F-11, F-12, F-19 (answered) |

## Context

- Two employees, each using a personal phone (B-02).
- Every action must be traceable to a person.
- Nobody else may read client data.
- The back end is the developer's own API ([ADR-0019](0019-backend-own-api-postgres-s3.md)), so logins and permission checks are the API's job.

## Decision

- **better-auth**, in the API, with e-mail and password (default for T-03). Public sign-up is disabled; the developer creates the accounts with a script.
- **One account per person.** No shared login.
- **Passwords:** at least 12 characters, hashed by better-auth. Sign-in attempts are rate-limited.
- **On both the iPhone and web apps:** every new sign-in requires a password followed by a TOTP from an authenticator app (better-auth's two-factor support), or a one-use recovery backup code after enrollment. The developer and staff member perform first sign-in and TOTP enrollment together, including after a factor reset. Pending enrollment/challenge credentials grant no business access. Missing browser headers never prove a request came from an iPhone.
- **On the web app** (F-19, [ADR-0021](0021-web-app.md)):
  - the session is an `HttpOnly`, `Secure`, `SameSite=Strict` cookie, which JavaScript can't read;
  - it ends after 30 minutes without activity, and after 12 hours in any case (`RECOMMENDED`).

- **Sessions:**
  - sessions are stored in Postgres, and every request checks them, so a revoked session stops working at once;
  - a native session expires after 30 days without use, renewed on activity but never beyond 90 days from its original password authentication (`authenticated_at`); factor completion and renewal never reset that timestamp. A new sign-in after expiry requires both factors again;
  - on the phone, the bearer token is stored in the iOS Keychain with expo-secure-store. The API exposes explicit routes rather than the Better Auth wildcard handler, so the client stores the token directly instead of using the Expo plugin's HTTP protocol;
  - Better Auth 1.7.20 has no supported session-token hashing option: its `internal-adapter` creates a raw `token`, looks sessions up by that same value, and the two-factor plugin returns/consumes it. The `storeIdentifier: 'hashed'` option applies to verification identifiers, not sessions. Keep library-compatible raw session tokens rather than a custom adapter/fork. A database read exposing a complete session token permits replay until expiry/revocation. Mitigations are restricted database access, no token logging or cookie cache, transport isolation, bounded lifetimes and immediate server revocation. Opaque flow tokens are hashed; internal library cookies and factor material are encrypted.
- **App lock:** Face ID or Touch ID, with the device passcode as fallback, when the app opens and after 5 minutes in the background (default for T-03). It needs a device passcode (F-03).
- **No e-mail from the app in the MVP:** password resets are done by the developer. The e-mail provider chosen in F-15 can be used to switch on resets by e-mail later.
- **Roles:** one `staff` role with full access to business functions in the MVP, since there are two employees (default for R-16). Administrative tasks (creating or disabling accounts, fixing data, erasure) are done by the developer, with scripts.
- **Authorisation in the API:**
  - every route requires an active staff session, except the health check and the sign-in routes. Access is denied by default, and a test lists every route;
  - the database protects append-only data and status changes through grants, triggers and SQL functions ([ADR-0007](0007-contract-lifecycle-and-audit.md));
  - files are reached only through presigned links that the API issues after its checks ([ADR-0014](0014-file-storage.md));
  - database credentials, storage keys, the signing certificate and its passphrase live only on the servers and in protected CI environments. None of them ships in the app.
- **Revocation:** the developer marks the staff profile inactive and revokes its sessions. The next request from that phone is refused ([US-012](../stories/US-012-revoke-a-staff-members-access.md)).
- **Multi-factor authentication:** required at every new native and web sign-in. Face ID remains a local app unlock; it does not replace the server's second-factor check.

## Consequences

**Positive**

- Every action is traceable to one person.
- Access can be cut immediately from the server, without touching the phone.

**Negative / risks**

- The permission checks are code, so a forgotten check exposes data. The route test and the database's own rules are the safety nets.
- With a single role, both employees can do everything the app allows, including deleting client documents uploaded by mistake. Signed evidence stays protected by the database rules.
- The developer handles all account administration, including password resets.

## Alternatives considered

| Option | Why not chosen |
|---|---|
| Supabase Auth | Left with Supabase (ADR-0019) |
| A self-hosted identity server (Keycloak, Zitadel, Authentik) | Another service to run, for two users |
| Hand-written sessions and password handling | Easy to get wrong; better-auth covers it |
| A shared company login | No accountability |
| Google or Microsoft single sign-on | Unknown whether the client uses either (T-03) |
| Magic link or one-time code by e-mail | Possible later with the e-mail provider (F-15, T-03) |

## Revisit when

The company hires more staff, or different access levels are needed (R-16).

## Changes

- 2026-11-12: developer-approved revision from PR #25: mandatory native and web MFA, local-only Face ID, a 90-day native absolute lifetime, paired enrollment/reset procedure, direct Keychain storage for explicit API routes, and the pinned Better Auth session-token storage trade-off. This supersedes the original native password-only exception; the historical F-19 client answer is retained in discovery.
- 2026-11-03: Supabase Auth and row-level security replaced by better-auth and permission checks in the API, after F-11 and F-12 ([ADR-0019](0019-backend-own-api-postgres-s3.md)).
- 2026-11-03 (later): F-19 answered: on the web app, a second factor at every sign-in and a cookie session with an idle timeout.
- 2026-11-10: Documenso is removed ([ADR-0023](0023-signatures-in-the-app-sealed-by-the-api.md)): no Documenso API token; the API holds the signing certificate.

## Implemented by

- [US-003](../stories/US-003-expo-app-skeleton.md): Create the Expo app skeleton, for iOS and the web
- [US-004](../stories/US-004-api-server-and-environments.md): Create the API server and its environments: local, homelab staging, Scaleway production
- [US-006](../stories/US-006-core-database-schema-and-storage.md): Create the core database schema, access rules and storage
- [US-007](../stories/US-007-audit-trail-and-immutability.md): Record an audit trail and protect signed data
- [US-010](../stories/US-010-sign-in-and-sign-out.md): Sign in and sign out
- [US-011](../stories/US-011-app-lock-with-face-id.md): Lock the app with Face ID
- [US-012](../stories/US-012-revoke-a-staff-members-access.md): Revoke a staff member's access (lost phone or departure)
- [US-015](../stories/US-015-web-sign-in-second-factor.md): Sign in to the web app with a second factor, and sign out when idle
