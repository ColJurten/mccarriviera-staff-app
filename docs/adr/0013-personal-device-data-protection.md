# ADR-0013: Protect client data on staff phones, laptops and the agency computer

| Status | Date | Decided by | Based on |
|---|---|---|---|
| **Accepted** | 2026-10-07 (updated 2026-11-03) | Developer, with the client's answers | B-02, B-03 · default for T-05 · F-03 · L-03 |

## Context

- The phones are personal (B-02): no device management and no remote wipe.
- Staff also use the web app on their personal laptops and on the company computer at the agency (F-19).
- Client ID documents, licences, signatures and contracts pass through them.
- The app works online only ([ADR-0005](0005-online-only.md)).

## Decision

- **No business data at rest:** data stays in memory only (TanStack Query, no persister).
- **Images** that show personal data use expo-image with a memory-only cache. Its default cache is on disk.
- **Photos:**
  - taken inside the app and **not saved to the photo library**;
  - re-encoded before upload, which removes location metadata;
  - temporary files are deleted after upload, and leftovers are deleted at the next launch.
- **Client documents** open through **presigned links valid for at most 5 minutes**, in an in-app viewer, without being saved to the phone.
- **Signing page:** Documenso's page opens in an in-app web view as a private session, and keeps no cookies, cache or local storage once closed ([ADR-0020](0020-signatures-with-documenso.md)).
- **Generated PDFs** are the only files the app keeps:
  - they are downloaded from the API into the **app cache** and handed to the share sheet;
  - they are deleted at sign-out, and after 7 days (default for T-05);
  - copies that staff save elsewhere (Files, Mail, messaging) are outside the app's control. They are covered by the company's device-use rule (L-03).
- **Session:** the session token is stored in the Keychain ([ADR-0012](0012-authentication-and-authorisation.md)).
- **App lock** ([ADR-0012](0012-authentication-and-authorisation.md)), and the app's snapshot is covered in the app switcher.
- **Lost phone:** staff report it, and the developer disables the account and revokes the sessions ([US-012](../stories/US-012-revoke-a-staff-members-access.md)). The data stays safe on the server.
- **No personal data** in logs or crash reports ([ADR-0017](0017-crash-reporting.md)).
- **Web app** (F-19, [ADR-0021](0021-web-app.md)): the same rules in the browser. Data in memory only, nothing in browser storage, images and documents not cached, PDFs opened in the browser's viewer, sign-out after 30 minutes idle. On the shared agency computer, each person uses their own account, signs out at the end, and never lets the browser save the password. The device rule (L-03) also covers laptops and the agency computer, including downloaded PDFs.

## Consequences

**Positive**

- Little to leak from a lost phone.
- No device management needed.

**Negative / risks**

- PDFs that staff share are beyond the app's reach, so the written rule matters (L-03).
- Photos not yet uploaded are lost if the app is closed. Staff retake them.

## Alternatives considered

| Option | Why not chosen |
|---|---|
| Device management with User Enrollment through Apple Business | It protects a managed container, but needs Apple Business, a D-U-N-S number and enrolling personal phones. Disproportionate for two people today |

## Revisit when

More staff join, or the company provides phones.

## Changes

- 2026-11-03: PDFs now come from the API, and the client signs in a private web view (ADR-0019, ADR-0020).
- 2026-11-03 (later): the web app's rules added (F-19, ADR-0021).

## Implemented by

- [US-010](../stories/US-010-sign-in-and-sign-out.md): Sign in and sign out
- [US-011](../stories/US-011-app-lock-with-face-id.md): Lock the app with Face ID
- [US-012](../stories/US-012-revoke-a-staff-members-access.md): Revoke a staff member's access (lost phone or departure)
- [US-013](../stories/US-013-minimum-local-data-on-phones.md): Keep client data on staff phones to a minimum
- [US-014](../stories/US-014-crash-reporting.md): Report crashes without personal data
- [US-015](../stories/US-015-web-sign-in-second-factor.md): Sign in to the web app with a second factor, and sign out when idle
- [US-016](../stories/US-016-client-data-in-the-browser.md): Keep client data out of the browser on laptops and the agency computer
- [US-026](../stories/US-026-guided-reference-photo-capture.md): Guided reference photo capture
- [US-033](../stories/US-033-client-documents.md): Attach and view client documents
- [US-042](../stories/US-042-archive-and-share-pdfs.md): Archive, download and share contract PDFs
- [US-044](../stories/US-044-sign-in-documenso-from-the-app.md): Preview a contract PDF and have it signed in Documenso from the app
- [US-092](../stories/US-092-legal-and-privacy-checklist.md): Send the legal and privacy questions, and close them before go-live
