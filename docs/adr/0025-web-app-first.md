# ADR-0025: Deliver the web app first; the iPhone app follows from the same code

| Status | Date | Decided by | Based on |
|---|---|---|---|
| **Accepted** | 2026-11-14 | Developer | F-29, F-30 (answered) · F-19 · B-01, B-02 |

## Context

- **F-19** (2026-11-03): the web app does everything the iPhone app does, and both go live together ([ADR-0021](0021-web-app.md)).
- The build order of 2026-11-03 put the whole back end first, then the front end, with every screen checked on the iPhone and in a browser.
- **F-29** (2026-11-14): the developer builds the web app before the iPhone app.
  - The web app goes live first; the iPhone app is a second release.
  - Until then, the web app must work fully in a phone's browser, for handovers at the car.
  - One Expo codebase stays.
  - Tickets are built feature by feature.
- **F-30** (2026-11-14): the client signs on the pad only. The « Envoyer un lien au client » of the web design isn't in the MVP.
- The iPhone app needs Apple's enrolment (a week or more), EAS builds and a borrowed test iPhone ([ADR-0003](0003-ios-distribution-ad-hoc.md), [ADR-0018](0018-development-and-test-devices.md)). The web app needs none of them.
- The design now has a « Web Desktop » page next to the phone screens ([`design/`](../design/README.md)).

## Decision

- **Order of delivery:**
  1. the **web app**, used in production by the staff;
  2. the **iPhone app**, a second release from the same code ([ADR-0021](0021-web-app.md)).

  Phases P0 to P5 are built and accepted on the web. P6 is the web go-live. P7 is the iPhone app ([stories](../stories/README.md)).
- **One codebase** (F-29). These rules keep the screens reusable by the iPhone app:
  - screens use React Native components and Expo Router only: no DOM elements and no web-only UI library in a screen;
  - what differs per platform sits behind the platform modules of ADR-0021, with a web implementation now and a native one in P7: session storage, camera, file picking, sharing a PDF, PDF viewer, signature pad, app lock;
  - CI bundles the iOS target (`expo export --platform ios`) on every pull request, so a web-only import fails early (`RECOMMENDED`);
  - no native build, EAS project or Apple account is needed before P7.
- **Devices in the web phase** (F-29):
  - laptops and the agency computer (F-19): the current versions of Chrome, Edge, Firefox and Safari;
  - **phones, in the browser:** the current versions of Safari on iOS and Chrome on Android. Staff do a Départ or a Retour at the car on their phone, in the browser. It stands in for the iPhone app until P7;
  - nothing is installed. The web app isn't a PWA: no service worker and no offline cache ([ADR-0005](0005-online-only.md), [ADR-0013](0013-personal-device-data-protection.md)).
- **Layouts:** the same routes at every width.
  - Narrow screens follow the phone screens of the design, with a tab bar at the bottom.
  - Wide screens follow the « Web Desktop » screens, with a sidebar on the left.
  - One breakpoint, set in the theme (800 px, `RECOMMENDED`).
- **Handovers in a browser:**
  - **Camera:** an in-page camera view, using the rear camera on a phone, is the app's camera. Reference photos come only from it ([ADR-0024](0024-vehicle-condition-four-angles-estimates.md)), so a reference set is taken on a phone or a tablet, not at a desktop computer.
  - **Files:** damage photos and documents can also be chosen from files or from the phone's photo library. They are flagged « importée » ([ADR-0014](0014-file-storage.md)).
  - **Before upload:** photos are resized to 1600 px and re-encoded in the browser, which removes location metadata ([ADR-0013](0013-personal-device-data-protection.md)).
  - **Signature:** the client signs once on the pad, on the staff member's screen (F-30). At a laptop, staff reopen the contract waiting for signature on their phone, so the client signs with a finger (`RECOMMENDED` for the device rule, L-03). A mouse or a trackpad still works. There is no signing link.
  - **PDF:** opened in the browser's viewer, downloaded, or shared with the browser's share function where it exists ([US-042](../stories/US-042-archive-and-share-pdfs.md)).
  - **Evidence record on the web** ([ADR-0023](0023-signatures-in-the-app-sealed-by-the-api.md); `RECOMMENDED`): the device model is the browser's name and version, the operating system is the one the browser reports, and the app version is the web build's identifier.
- **Sign-in on a phone's browser:** the web sign-in, unchanged: password, then the authenticator code; a cookie session that ends after 30 minutes idle and after 12 hours ([ADR-0012](0012-authentication-and-authorisation.md)). A browser has no Face ID lock: the idle sign-out plays that role.
- **Build order** (F-29). It replaces the order of 2026-11-03:
  1. the shared foundations of the back end: audit trail, file storage, the signing spike;
  2. the web skeleton and sign-in;
  3. each feature as an API ticket followed by its web ticket, in phase order;
  4. staging as soon as the skeleton exists, so that every feature is checked in a desktop browser and on a phone;
  5. the web go-live (P6): backups, legal checklist, runbook, pilot;
  6. the iPhone app (P7).
- **Definition of Done in the web phase:** a story with a screen is demonstrated in a desktop browser and in a phone's browser, on staging. End-to-end tests drive the web app in CI. Each screen's iPhone check belongs to P7 ([US-095](../stories/US-095-iphone-release.md)).
- **What waits for P7:**
  - the Apple membership and the phone registrations ([US-001](../stories/US-001-apple-developer-account-and-devices.md)). The free D-U-N-S request can be made at any time; the enrolment starts at least a month before P7;
  - EAS builds and over-the-air updates ([US-005](../stories/US-005-eas-builds-and-internal-distribution.md));
  - the Face ID lock ([US-011](../stories/US-011-app-lock-with-face-id.md)) and the rules for data on the phones ([US-013](../stories/US-013-minimum-local-data-on-phones.md));
  - the iPhone half of the spike ([US-009](../stories/US-009-spike-signature-and-pdf-on-iphone.md)), the session in the Keychain (T-08, open) and Sentry's React Native SDK ([US-014](../stories/US-014-crash-reporting.md));
  - Developer Mode and the yearly reinstall on the staff phones (F-03).

## Consequences

**Positive**

- Staff can use the app sooner. The go-live no longer depends on Apple's enrolment or on a test iPhone.
- The fastest development loop: a browser, the local stack and end-to-end tests in CI.
- The client sees working screens early, on a laptop and on a phone.
- In the web phase, any phone with a current browser works: no registration and no Developer Mode.

**Negative / risks**

- A phone's browser is weaker than an installed app:
  - no app lock, only the idle sign-out;
  - the browser asks for the camera permission, and may ask again;
  - no share sheet in every browser;
  - the browser's history, password saving and downloads are outside the app's control. The device rule (L-03) now covers phone browsers too.
- The iPhone app is only proven in P7. The rules and the iOS bundle check in CI reduce the rework, but can't rule it out.
- Two widths to build and test from the first screen.
- The client asked for an iPhone app (B-02). It comes second.

## Alternatives considered

| Option | Why not chosen |
|---|---|
| Both targets live together (F-19) | Replaced by F-29: the web app can be ready sooner |
| The iPhone app first | Needs Apple's enrolment, EAS and the test iPhone before any screen can be accepted |
| The web app only | The iPhone app stays in the scope, as the second release |
| A separate web front end (for example React with Vite) | Two front ends to maintain; one Expo codebase is kept (F-29) |
| Signing through a link sent to the client (e-mail, SMS, QR code) | Not in the MVP (F-30): it needs a public signing page, sending e-mail or SMS, and the lawyer's view on remote signing. Listed as post-MVP |

## Revisit when

A phone's browser proves inadequate at the car (camera, signature, session), or bringing the iPhone app up costs much more than planned.

## Changes

- 2026-11-14: written, from the answers to F-29 and F-30.

## Implemented by

- [US-003](../stories/US-003-expo-app-skeleton.md): Create the Expo app skeleton, for the web first
- [US-004](../stories/US-004-api-server-and-environments.md): Create the API server and its environments: local, homelab staging, Scaleway production
- [US-010](../stories/US-010-sign-in-and-sign-out.md): Sign in and sign out
- [US-015](../stories/US-015-web-sign-in-second-factor.md): Sign in to the web app with a second factor, and sign out when idle
- [US-016](../stories/US-016-client-data-in-the-browser.md): Keep client data out of the browser on laptops, phones and the agency computer
- [US-026](../stories/US-026-guided-reference-photo-capture.md): Guided reference photo capture
- [US-042](../stories/US-042-archive-and-share-pdfs.md): Archive, download and share contract PDFs
- [US-044](../stories/US-044-client-signs-in-the-app.md): Preview a contract PDF and have the client sign it in the app
- [US-091](../stories/US-091-pilot-with-the-staff.md): Pilot with the two staff members
- [US-095](../stories/US-095-iphone-release.md): Release the iPhone app from the shared code
