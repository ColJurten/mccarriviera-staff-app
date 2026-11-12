# US-012 · Revoke a staff member's access (lost phone or departure)

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E1 · Access, security and monitoring | Must | P1 | S | To do |

- **Depends on:** [US-010](US-010-sign-in-and-sign-out.md)
- **Decisions:** [ADR-0012](../adr/0012-authentication-and-authorisation.md) · [ADR-0013](../adr/0013-personal-device-data-protection.md)
- **Open points:** L-03 (see [open questions](../discovery/open-questions.md))

## Story

As the company, I want to cut access from a lost phone or a departing employee within minutes, so that client data can't be read from that device.

## Acceptance criteria

- [ ] A runbook procedure and a script, run by the developer, set the staff profile to inactive and revoke all of that user's sessions (better-auth).
- [ ] After revocation, every request from that phone is refused immediately, since the API checks the session and the profile on every request. The app shows « Compte désactivé » and deletes its cached files.
- [ ] The developer can re-enable the account, or create a new one for a new phone.
- [ ] The revocation is recorded in the audit trail (deferred to [US-007](US-007-audit-trail-and-immutability.md); ticket #7 supplies only the integration hook).
- [ ] The staff device-use rule (L-03) tells staff to report a lost phone immediately.

## API implementation (ticket #7)

[Developer commands](../runbook.md) deactivate/reactivate profiles and revoke
all sessions and pending native/web challenges transactionally. Every protected request
reads the session and active profile again. Commands invoke one attributed audit
hook; persistent event wiring awaits [US-007](US-007-audit-trail-and-immutability.md), so the audit criterion remains open. Device messaging/cache deletion and
the L-03 policy remain separate work; acceptance checkboxes are unchanged.

Frontend open point: generic 401 responses cannot distinguish deactivation
from an expired/revoked session after all sessions are deleted. The specific
« Compte désactivé » message needs a later revocation-reason design decision.
