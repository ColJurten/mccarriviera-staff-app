# US-011 · Lock the app with Face ID

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E1 · Access, security and monitoring | Must | P7 | S | To do |

- **Depends on:** [US-010](US-010-sign-in-and-sign-out.md)
- **Decisions:** [ADR-0012](../adr/0012-authentication-and-authorisation.md) · [ADR-0013](../adr/0013-personal-device-data-protection.md)
- **Open points:** T-03 (see [open questions](../discovery/open-questions.md))

## Story

As a staff member using my personal phone, I want the app to lock itself, so that someone holding my unlocked phone can't browse client data.

## Acceptance criteria

- [ ] When the app opens, and when it returns after 5 minutes or more in the background, it asks for Face ID or Touch ID, with the device passcode as fallback (default for T-03).
- [ ] While the app is locked, no client, vehicle or contract data is visible.
- [ ] In the app switcher, the app's snapshot is covered (logo or blur) whenever the app is inactive.
- [ ] If the phone has no passcode, Face ID can't be used. The app explains that a passcode is required (F-03) and stays locked.

## Notes

- iPhone only. On the web, the idle sign-out of [US-015](US-015-web-sign-in-second-factor.md) plays this role.

- Since 2026-11-14 this story belongs to the iPhone phase (P7, [ADR-0025](../adr/0025-web-app-first.md)). In a browser, the idle sign-out of [US-015](US-015-web-sign-in-second-factor.md) plays this role.
