# US-010 · Sign in and sign out

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E1 · Access, security and monitoring | Must | P1 | M | In progress |

- **Depends on:** [US-004](US-004-api-server-and-environments.md) · [US-003](US-003-expo-app-skeleton.md) · [US-006](US-006-core-database-schema-and-storage.md)
- **Decisions:** [ADR-0012](../adr/0012-authentication-and-authorisation.md) · [ADR-0013](../adr/0013-personal-device-data-protection.md) · [ADR-0021](../adr/0021-web-app.md)
- **Open points:** T-03 (see [open questions](../discovery/open-questions.md))

## Story

As a staff member, I want to sign in with my own account, so that the app knows who does each action and nobody else can open client data.

## Acceptance criteria

- [ ] Sign-in with e-mail, password and a TOTP (or one-use backup code after enrollment) on both iPhone and web, handled by better-auth in the API (default for T-03). There is no self-registration screen, and sign-up is disabled on the server.
- [ ] Wrong credentials show a generic error, with no hint about whether the e-mail exists. Repeated failures are rate-limited per IP address; the password step has no per-account lockout (F-33).
- [ ] In the iPhone app (P7, [US-095](US-095-iphone-release.md)): the session token is stored in the iOS Keychain (expo-secure-store). T-08 decides whether this goes through better-auth's Expo integration or the API's own native routes. The session survives restarts until sign-out, expiry (30 days without use, at most 90 days from original authentication) or revocation.
- [ ] On the web, the session is an `HttpOnly`, `Secure`, `SameSite=Strict` cookie, never in local storage. The second factor and the idle sign-out are in [US-015](US-015-web-sign-in-second-factor.md).
- [ ] Sign-out (in Settings) ends the session on the server, clears in-memory data and the app's cached files (photos, PDFs), and returns to Sign-in.
- [ ] A deactivated staff profile is refused by the API on its next request. The app returns to Sign-in with « Session terminée. Reconnectez-vous. », as for any session that ended, and sign-in on a deactivated account fails with the generic error (F-33).
- [ ] Password resets and new accounts are handled by the developer, with a script. The app sends no e-mail in the MVP (`RECOMMENDED`).

## API implementation (ticket #7)

The server provides invite-only Better Auth password login, Postgres sessions,
native bearer and strict web-cookie modes, active-profile checks and sign-out.
See [API contract](../../api/README.md) and [developer commands](../runbook.md).
Server acceptance tests cover credentials, HTTP rate limits and revocation.
Screens, Keychain integration and client cache cleanup remain frontend work;
the story checkboxes await review of the complete story.

Every new native and web sign-in requires MFA (developer decision on PR #25).
Face ID remains the local unlock of the iPhone app.

Settled on 2026-11-14:

- **F-33:** the password step loses its per-account lockout, keeping the limits per IP address, and the app shows a generic message when a session ends. A follow-up ticket changes the API.
- **T-08** (open, needed before the iPhone app): the API's native routes don't serve better-auth's Expo protocol, which ADR-0012 and the Keychain criterion assumed. The web app isn't concerned.
- The web screens come first ([ADR-0025](../adr/0025-web-app-first.md)); the Keychain part belongs to the iPhone phase.
