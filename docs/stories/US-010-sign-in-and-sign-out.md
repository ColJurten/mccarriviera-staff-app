# US-010 · Sign in and sign out

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E1 · Access, security and monitoring | Must | P1 | M | To do |

- **Depends on:** [US-004](US-004-api-server-and-environments.md) · [US-005](US-005-eas-builds-and-internal-distribution.md) · [US-006](US-006-core-database-schema-and-storage.md)
- **Decisions:** [ADR-0012](../adr/0012-authentication-and-authorisation.md) · [ADR-0013](../adr/0013-personal-device-data-protection.md) · [ADR-0021](../adr/0021-web-app.md)
- **Open points:** T-03 (see [open questions](../discovery/open-questions.md))

## Story

As a staff member, I want to sign in with my own account, so that the app knows who does each action and nobody else can open client data.

## Acceptance criteria

- [ ] Sign-in with e-mail and password, handled by better-auth in the API (default for T-03). There is no self-registration screen, and sign-up is disabled on the server.
- [ ] Wrong credentials show a generic error, with no hint about whether the e-mail exists. Repeated failures are rate-limited.
- [ ] The session token is stored in the iOS Keychain (expo-secure-store), through better-auth's Expo integration. The session survives restarts until sign-out, expiry (30 days without use, `RECOMMENDED`) or revocation.
- [ ] On the web, the session is an `HttpOnly`, `Secure`, `SameSite=Strict` cookie, never in local storage. The second factor and the idle sign-out are in [US-015](US-015-web-sign-in-second-factor.md).
- [ ] Sign-out (in Settings) ends the session on the server, clears in-memory data and the app's cached files (photos, PDFs), and returns to Sign-in.
- [ ] A deactivated staff profile is refused by the API on its next request, and the app shows « Compte désactivé ».
- [ ] Password resets and new accounts are handled by the developer, with a script. The app sends no e-mail in the MVP (`RECOMMENDED`).
