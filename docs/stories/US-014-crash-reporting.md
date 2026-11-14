# US-014 · Report crashes without personal data

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E1 · Access, security and monitoring | Should | P0 | S | To do |

- **Depends on:** [US-003](US-003-expo-app-skeleton.md) · [US-004](US-004-api-server-and-environments.md)
- **Decisions:** [ADR-0017](../adr/0017-crash-reporting.md) · [ADR-0013](../adr/0013-personal-device-data-protection.md)
- **Open points:** L-03 (see [open questions](../discovery/open-questions.md))

## Story

As the developer, I want crashes on the staff phones reported to me without any client data, so that I can fix problems without a Mac.

## Acceptance criteria

- [ ] The API (Sentry's Node SDK) and the web app (its browser SDK) report first ([ADR-0025](../adr/0025-web-app-first.md)), without request bodies or personal data. The organisation uses the EU (Germany) data storage location, chosen at creation, and is the developer's (F-02).
- [ ] `sendDefaultPii` is off, with no screenshots and no session replay. Events and breadcrumbs are cleaned of request bodies, URLs with query strings, and text typed by staff. The user is identified by the staff profile ID only.
- [ ] Each event carries the version of the web build or of the API. Source maps are uploaded when the web app is built, so stack traces are readable.
- [ ] A test error in the web app on staging shows up with a readable stack trace and no personal data.
- [ ] In the iPhone phase ([US-095](US-095-iphone-release.md)): `@sentry/react-native` with its Expo config plugin reports to the same organisation, under the same rules. Each event carries the app version, build number and update ID, and source maps are uploaded during EAS builds and updates.
- [ ] The data processing agreement is tracked in [US-092](US-092-legal-and-privacy-checklist.md).
