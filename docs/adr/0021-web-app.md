# ADR-0021: A web app from the same Expo code, with the iPhone app's features, for staff laptops and the agency computer

| Status | Date | Decided by | Based on |
|---|---|---|---|
| **Accepted** | 2026-11-03 (updated 2026-11-14) | Developer, with the client's answers | F-19, F-29, F-30 (answered) · B-01, B-02 · L-03 |

## Context

- **F-19** (2026-11-03): the web app does everything the iPhone app does, Départ and Retour included, and both go live together. Staff use it on their personal laptops and on the company computer at the agency. On the web, sign-in needs a password and a second factor.
- Later, outside the MVP: analytics pages (revenue per car and per client) and an administration panel for the company (users, their activity, contracts signed and assigned). See N-04.
- **F-29** (2026-11-14): the web app is built and goes live first, and it must also work in a phone's browser until the iPhone app exists ([ADR-0025](0025-web-app-first.md)).
- The app is built with Expo in TypeScript ([ADR-0002](0002-mobile-stack-expo.md)). Expo has a web target (React Native for Web, with Expo Router), so the same screens and the same code can run in a browser.
- A browser has no Face ID lock and no Keychain, a sign-in page on the web is reachable from the whole internet, and the agency computer may be shared.

## Decision

- **One codebase, two targets:** the Expo app also builds for the web. Screens adapt to phone and laptop widths. Code that only exists on one platform (Face ID, the Keychain, the share sheet, the camera module) sits behind small platform-specific modules, so screens don't test the platform themselves (`RECOMMENDED`).
- **Hosting:** the web build is static files, served by Caddy on the production server, on the same address as the API: the web app at `/`, the API at `/api/` ([ADR-0019](0019-backend-own-api-postgres-s3.md)). One origin means no cross-origin requests and simpler cookies (`RECOMMENDED`). Staging serves its own build.
- **Sign-in on the web** (F-19; [ADR-0012](0012-authentication-and-authorisation.md)):
  - password plus a second factor at every sign-in: a one-time code from an authenticator app (TOTP), with backup codes. A passkey can replace the code later;
  - the session is an `HttpOnly`, `Secure`, `SameSite=Strict` cookie, never readable by JavaScript and never in local storage;
  - the session ends after 30 minutes without activity and after 12 hours in any case (`RECOMMENDED`). This replaces the iPhone's Face ID lock.
- **Security headers:** a strict Content Security Policy, HSTS, no framing of the app by other sites, and no caching of API responses (`RECOMMENDED`).
- **Client data in the browser** ([ADR-0013](0013-personal-device-data-protection.md)):
  - business data stays in memory only. Nothing goes into local storage, IndexedDB or a service worker cache;
  - images and documents are fetched through presigned links and aren't cached by the browser;
  - PDFs open in the browser's viewer. A PDF that staff download lands in the computer's downloads, outside the app's control: the written device rule (L-03) covers laptops and the agency computer;
  - on the shared agency computer, each person signs in with their own account and signs out at the end; the browser must not save the passwords.
- **Handovers on the web:**
  - photos come from an in-page camera view, which uses the rear camera on a phone, or from files. Files are flagged « importée », as for the iPhone's photo library. Reference photos come from the camera view only ([ADR-0024](0024-vehicle-condition-four-angles-estimates.md), [ADR-0025](0025-web-app-first.md));
  - the client signs on a canvas in the web app, with a mouse, a trackpad or a touch screen, and the API stamps and seals the PDF as for the iPhone ([ADR-0023](0023-signatures-in-the-app-sealed-by-the-api.md)). There is no signing link (F-30). The spike [US-009](../stories/US-009-spike-signature-and-pdf-on-iphone.md) checks it in a browser;
  - the PDF is downloaded, or shared through the browser's share function where it exists, instead of the iOS share sheet.
- **Errors:** the web app reports to the same Sentry organisation, with the same rules: no personal data, no request bodies, no session replay ([ADR-0017](0017-crash-reporting.md)).
- **Supported browsers:** the current versions of Chrome, Edge, Firefox and Safari on computers, and of Safari on iOS and Chrome on Android on phones (F-29). Every story with a screen is checked in a desktop browser and in a phone's browser. Its iPhone check comes with the iPhone app ([ADR-0025](0025-web-app-first.md)).

## Consequences

**Positive**

- Staff can work from a laptop or the agency computer, with a larger screen for data entry.
- The web build is the fastest development loop: no build to install, no phone needed for most screens.
- End-to-end tests can drive the web app in CI with a headless browser.

**Negative / risks**

- More work than an iPhone-only MVP: layouts for two screen sizes, the second factor, web sessions and headers, and testing in browsers as well as on the iPhone.
- A sign-in page on the public internet. The second factor, rate limiting and short sessions reduce the risk.
- Client data shown on personal laptops and on a shared computer. Downloads and screenshots are outside the app's control; the device rule matters (L-03).
- A signature drawn with a laptop's touchpad or mouse is hard to do well. On the web, a touchscreen or the staff member's phone suits the client better (`RECOMMENDED` for the device rule).
- Some Expo modules behave differently on the web, or not at all (Keychain, Face ID, share sheet). Each needs a web counterpart.

## Alternatives considered

| Option | Why not chosen |
|---|---|
| iPhone only (the plan until 2026-11-03) | Replaced by F-19 |
| A separate web front end (for example Next.js) | Two codebases for the same screens |
| Web app as a back office only, without handovers | Not what F-19 asks |
| Password only on the web | Ruled out by F-19 |

## Revisit when

The analytics or administration pages are wanted (after the MVP), or staff stop using one of the two targets.

## Changes

- 2026-11-03: written, from the answers to F-19.
- 2026-11-10: the client signs on a canvas in the web app instead of Documenso's page ([ADR-0023](0023-signatures-in-the-app-sealed-by-the-api.md)); vehicle condition now follows ADR-0024.
- 2026-11-14: F-29 and F-30 answered: the web app is built and goes live first, phone browsers are supported, and signing stays on the pad ([ADR-0025](0025-web-app-first.md)). This replaces « both go live together » (F-19).

## Implemented by

- [US-003](../stories/US-003-expo-app-skeleton.md): Create the Expo app skeleton, for the web first
- [US-004](../stories/US-004-api-server-and-environments.md): Create the API server and its environments: local, homelab staging, Scaleway production
- [US-009](../stories/US-009-spike-signature-and-pdf-on-iphone.md): Spike: prove in-app signing, stamping and sealing, and server-rendered PDFs, in a browser and on a real iPhone
- [US-010](../stories/US-010-sign-in-and-sign-out.md): Sign in and sign out
- [US-015](../stories/US-015-web-sign-in-second-factor.md): Sign in to the web app with a second factor, and sign out when idle
- [US-016](../stories/US-016-client-data-in-the-browser.md): Keep client data out of the browser on laptops, phones and the agency computer
- [US-044](../stories/US-044-client-signs-in-the-app.md): Preview a contract PDF and have the client sign it in the app
