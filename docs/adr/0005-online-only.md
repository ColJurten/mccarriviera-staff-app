# ADR-0005: Online-only operation: no offline mode

| Status | Date | Decided by | Based on |
|---|---|---|---|
| **Accepted** | 2026-10-07 (updated 2026-11-10) | Developer, with the client's answers | B-03 |

## Context

- B-03 rules out an offline mode: contracts are read and written in the shared database.
- The two phones must never rent the same car at the same time.
- Offline support would need a local database, a sync queue and conflict rules, and would keep client data on personal phones ([ADR-0013](0013-personal-device-data-protection.md)).

## Decision

- **Every read and write goes to the backend.**
  - These actions need a connection: starting, signing and closing a Départ or a Retour, recording or applying a stored Retour signature, amendments, and status changes. The database enforces the rules ([ADR-0007](0007-contract-lifecycle-and-audit.md)).
  - Without a connection, the app shows a banner and disables the actions that change data.
- **Uploads:**
  - During a handover, photo uploads retry automatically while the app is open.
  - Signing needs the connection too: the app sends the drawing to the API, which stamps and seals the PDF. A contract is marked signed only once the sealed PDF is stored ([ADR-0023](0023-signatures-in-the-app-sealed-by-the-api.md)).
  - Photos wait in the app's temporary folder until they are uploaded. If the app is closed before that, the step isn't complete and the photos have to be retaken. Leftover files are deleted at the next launch ([ADR-0013](0013-personal-device-data-protection.md)).
- **PDFs:** rendered and archived by the API ([ADR-0010](0010-contract-pdf-generation.md)). If the phone loses the connection while downloading one for sharing, it downloads it again.
- **No local data:** there is no local database and no persisted cache of business data. TanStack Query keeps data in memory only.

## Consequences

**Positive**

- The simplest architecture: no conflicts, and little client data on personal phones.

**Negative / risks**

- No signal means no handover in the app. The fallback (for example a paper contract) is the company's decision.
- Uploads on weak mobile data can be slow, so photos are compressed before upload ([ADR-0014](0014-file-storage.md)).

## Alternatives considered

| Option | Why not chosen |
|---|---|
| Background upload queue that survives an app restart | Keeps client data and photos on the phone between sessions. Not needed given B-03 |
| Full offline mode with sync | Much more work, plus conflict handling. Ruled out by B-03 |

## Revisit when

Handovers regularly fail for lack of signal.

## Changes

- 2026-11-03: signing (Documenso, ADR-0020) and PDF rendering (API, ADR-0010) happen on the server, so the phone no longer uploads a signature image or a PDF.
- 2026-11-10: signing moves from Documenso to the app and the API ([ADR-0023](0023-signatures-in-the-app-sealed-by-the-api.md)). The phone sends the drawing, not a PDF.

## Implemented by

- [US-020](../stories/US-020-home-screen.md): Home screen: Départ, Retour and the fleet
- [US-026](../stories/US-026-guided-reference-photo-capture.md): Guided reference photo capture
- [US-042](../stories/US-042-archive-and-share-pdfs.md): Archive, download and share contract PDFs
- [US-044](../stories/US-044-client-signs-in-the-app.md): Preview a contract PDF and have the client sign it in the app
- [US-050](../stories/US-050-start-a-depart.md): Start a Départ by choosing an available vehicle
- [US-052](../stories/US-052-fill-in-rental-details.md): Fill in the rental details
- [US-054](../stories/US-054-client-signs-the-depart.md): Client signs the Départ
- [US-074](../stories/US-074-client-signs-the-retour.md): Client signs the Retour and the rental is closed
