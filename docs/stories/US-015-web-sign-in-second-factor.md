# US-015 · Sign in to the web app with a second factor, and sign out when idle

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E1 · Access, security and monitoring | Must | P1 | M | In progress |

- **Depends on:** [US-010](US-010-sign-in-and-sign-out.md)
- **Decisions:** [ADR-0012](../adr/0012-authentication-and-authorisation.md) · [ADR-0021](../adr/0021-web-app.md) · [ADR-0013](../adr/0013-personal-device-data-protection.md)
- **Open points:** T-03 (see [open questions](../discovery/open-questions.md))

## Story

As the company, I want the web app's sign-in to need more than a password, and idle sessions to end, so that a stolen password or a computer left open doesn't expose client data.

## Acceptance criteria

- [ ] On the web, every sign-in asks for the password, then a one-time code from an authenticator app (TOTP, better-auth's two-factor support) (F-19).
- [ ] Each staff member sets up the authenticator at the first sign-in on either native or web, together with the developer (also after reset-factor), and receives backup codes to keep safe.
- [ ] The session ends after 30 minutes without activity and after 12 hours in any case (`RECOMMENDED`). The screen then returns to sign-in, and in-memory data is cleared.
- [ ] The same sign-in works in a phone's browser, which staff use at the car until the iPhone app exists ([ADR-0025](../adr/0025-web-app-first.md)). The set-up screen shows the authenticator's QR code and its text key, so that the authenticator app on the same phone can be set up.
- [ ] Password attempts are limited per IP address, with no per-account lockout: a correct password always goes on to the code (F-33). Code attempts keep a per-account limit, which only someone who knows the password can reach. A wrong code says nothing about which factor failed.
- [ ] The developer can reset a staff member's second factor with a script; recording the event in the audit trail is deferred to [US-007](US-007-audit-trail-and-immutability.md) and remains open in ticket #7.
- [ ] The iPhone app also requires password and TOTP (or a one-use backup code) at every new server sign-in (developer decision, PR #25); Face ID remains its local unlock ([US-011](US-011-app-lock-with-face-id.md)).

## API implementation (ticket #7)

The [API](../../api/README.md) exposes first-login TOTP enrollment with backup
codes, factor verification on every native/web login and developer factor reset. Pending
flows cannot access protected routes. Complete web cookies expire after 30 minutes
idle or 12 hours from password authentication, with immediate server revocation.
HTTP factor attempts are rate-limited. Screens, QR rendering and browser memory
cleanup remain frontend work. Audit persistence waits for [US-007](US-007-audit-trail-and-immutability.md)'s event contract; this PR does not close that criterion.

Settled on 2026-11-14 (F-33): a follow-up ticket removes the per-account lockout of the password step.
