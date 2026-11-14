# US-095 · Release the iPhone app from the shared code

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E9 · Go-live | Must | P7 | L | To do |

- **Depends on:** [US-091](US-091-pilot-with-the-staff.md) · [US-001](US-001-apple-developer-account-and-devices.md) · [US-005](US-005-eas-builds-and-internal-distribution.md)
- **Decisions:** [ADR-0025](../adr/0025-web-app-first.md) · [ADR-0021](../adr/0021-web-app.md) · [ADR-0002](../adr/0002-mobile-stack-expo.md) · [ADR-0003](../adr/0003-ios-distribution-ad-hoc.md) · [ADR-0018](../adr/0018-development-and-test-devices.md)
- **Open points:** T-08, F-01, F-03 (see [open questions](../discovery/open-questions.md))

## Story

As a staff member, I want the app installed on my iPhone, so that handovers at the car no longer go through the browser.

## Acceptance criteria

- [ ] T-08 is answered before this story starts: how the iPhone app keeps its session (better-auth's Expo integration, or the API's own native routes with the Keychain).
- [ ] Each platform module has its native implementation ([ADR-0021](../adr/0021-web-app.md)): the session in the Keychain, the camera and the photo library, the file picker, the share sheet, the PDF viewer, and the signature pad chosen in the spike ([US-009](US-009-spike-signature-and-pdf-on-iphone.md), iPhone half).
- [ ] The Face ID lock ([US-011](US-011-app-lock-with-face-id.md)) and the rules for data on the phones ([US-013](US-013-minimum-local-data-on-phones.md)) are done.
- [ ] Sentry's React Native SDK reports crashes under the rules of [US-014](US-014-crash-reporting.md).
- [ ] Every screen and flow already accepted on the web is checked on the test iPhone, with the real-iPhone checklist of [`testing.md`](../testing.md). Each difference is logged and fixed, without changing how the web app behaves.
- [ ] A full Départ and a full Retour, in French and in English, are done on the test iPhone against staging: camera photos, the signature, and the sealed PDF through the share sheet.
- [ ] The production build is installed on both staff iPhones ([US-005](US-005-eas-builds-and-internal-distribution.md)), each with its owner's account. The go/no-go for the iPhone app is recorded with the client.
- [ ] The device rule (L-03) and the runbook ([US-093](US-093-operations-runbook.md)) are updated for the iPhones: a lost phone, the yearly renewal, a new phone.

## Notes

- The web app stays in use; the iPhone app is the second release ([ADR-0025](../adr/0025-web-app-first.md)).
- This story can be split per screen group when P7 starts.
