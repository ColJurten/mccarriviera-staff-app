# US-015 · Sign in to the web app with a second factor, and sign out when idle

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E1 · Access, security and monitoring | Must | P1 | M | To do |

- **Depends on:** [US-010](US-010-sign-in-and-sign-out.md)
- **Decisions:** [ADR-0012](../adr/0012-authentication-and-authorisation.md) · [ADR-0021](../adr/0021-web-app.md) · [ADR-0013](../adr/0013-personal-device-data-protection.md)
- **Open points:** T-03 (see [open questions](../discovery/open-questions.md))

## Story

As the company, I want the web app's sign-in to need more than a password, and idle sessions to end, so that a stolen password or a computer left open doesn't expose client data.

## Acceptance criteria

- [ ] On the web, every sign-in asks for the password, then a one-time code from an authenticator app (TOTP, better-auth's two-factor support) (F-19).
- [ ] Each staff member sets up the authenticator at the first sign-in on the web, and receives backup codes to keep safe.
- [ ] The session ends after 30 minutes without activity and after 12 hours in any case (`RECOMMENDED`). The screen then returns to sign-in, and in-memory data is cleared.
- [ ] Code attempts are rate-limited like password attempts. A wrong code says nothing about which factor failed.
- [ ] The developer can reset a staff member's second factor with a script, recorded in the audit trail.
- [ ] The iPhone app is unchanged: password and Face ID lock ([US-011](US-011-app-lock-with-face-id.md)).
