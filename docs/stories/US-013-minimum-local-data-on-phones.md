# US-013 · Keep client data on staff phones to a minimum

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E1 · Access, security and monitoring | Must | P7 | S | To do |

- **Depends on:** [US-026](US-026-guided-reference-photo-capture.md) · [US-033](US-033-client-documents.md) · [US-042](US-042-archive-and-share-pdfs.md)
- **Decisions:** [ADR-0013](../adr/0013-personal-device-data-protection.md) · [ADR-0014](../adr/0014-file-storage.md)
- **Open points:** T-05 (see [open questions](../discovery/open-questions.md))

## Story

As the company, I want the app to leave as little client data as possible on staff personal phones, so that a lost phone exposes as little as possible.

## Acceptance criteria

- [ ] Photos taken in the app are never saved to the phone's photo library.
- [ ] Photos are re-encoded before upload, so location metadata (EXIF GPS) is removed. This is tested with a geotagged sample photo.
- [ ] Images that show personal data are cached in memory only (expo-image `cachePolicy: 'memory'`; its default caches on disk).
- [ ] Temporary photo files are deleted after upload, and any leftovers are deleted at the next launch.
- [ ] PDFs are the only files the app keeps: in the app cache, deleted at sign-out and after 7 days (default for T-05).
- [ ] No personal data is written to logs or crash reports (code review checklist, US-014).
- [ ] Client documents are fetched with presigned links valid for 5 minutes or less, and are never written to persistent storage.
- [ ] The client's drawing isn't kept on the device once the API has accepted it ([ADR-0023](../adr/0023-signatures-in-the-app-sealed-by-the-api.md)).
- [ ] A debug screen in development builds lists the app's files. After a full Départ and Retour, it shows no client data other than cached PDFs.

## Notes

- The web app's counterpart is [US-016](US-016-client-data-in-the-browser.md).

- Since 2026-11-14 this story belongs to the iPhone phase (P7, [ADR-0025](../adr/0025-web-app-first.md)): it covers the installed app. In the web phase, phones use the browser under the rules of [US-016](US-016-client-data-in-the-browser.md).
