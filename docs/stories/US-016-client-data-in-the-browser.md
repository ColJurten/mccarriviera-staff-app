# US-016 · Keep client data out of the browser on laptops, phones and the agency computer

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E1 · Access, security and monitoring | Must | P2 | S | To do |

- **Depends on:** [US-015](US-015-web-sign-in-second-factor.md) · [US-033](US-033-client-documents.md) · [US-042](US-042-archive-and-share-pdfs.md)
- **Decisions:** [ADR-0021](../adr/0021-web-app.md) · [ADR-0013](../adr/0013-personal-device-data-protection.md) · [ADR-0014](../adr/0014-file-storage.md)
- **Open points:** L-03 (see [open questions](../discovery/open-questions.md))

## Story

As the company, I want the web app to leave nothing behind in the browser, so that a personal laptop, a personal phone or the shared agency computer exposes as little as possible.

## Acceptance criteria

- [ ] Business data stays in memory. Nothing is written to local storage, session storage, IndexedDB or a service worker cache. A test inspects the browser's storage after a full Départ and Retour.
- [ ] Images and documents come through presigned links, with headers that stop the browser from caching them.
- [ ] PDFs open in the browser's viewer. Downloading one is a deliberate action, labelled as leaving the app.
- [ ] Signing out, or the idle sign-out, clears everything in memory.
- [ ] Photos taken in the browser's camera view are held in memory until uploaded, and are never saved to the phone's photo library.
- [ ] The device rule (L-03) covers the web app, on computers and in phone browsers ([ADR-0025](../adr/0025-web-app-first.md)): own account on the shared computer, sign out at the end, never let the browser save the password, delete downloaded PDFs, keep a passcode on the phone.
