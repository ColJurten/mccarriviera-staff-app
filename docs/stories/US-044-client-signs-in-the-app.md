# US-044 · Preview a contract PDF and have the client sign it in the app

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E4 · Contract document | Must | P2 | L | To do |

- **Depends on:** [US-043](US-043-pdf-sealing-and-signature-certificate.md) · [US-040](US-040-contract-pdf-template.md) · [US-042](US-042-archive-and-share-pdfs.md) · [US-009](US-009-spike-signature-and-pdf-on-iphone.md)
- **Decisions:** [ADR-0023](../adr/0023-signatures-in-the-app-sealed-by-the-api.md) · [ADR-0010](../adr/0010-contract-pdf-generation.md) · [ADR-0021](../adr/0021-web-app.md) · [ADR-0014](../adr/0014-file-storage.md) · [ADR-0013](../adr/0013-personal-device-data-protection.md) · [ADR-0005](../adr/0005-online-only.md)
- **Open points:** L-01 (see [open questions](../discovery/open-questions.md))

## Story

As a staff member, I want to show the client the contract in their language and have them sign it once on my phone, so that the company gets a sealed PDF signed on every page.

## Acceptance criteria

- [ ] An API route renders the preview for a contract revision and stage (`departure` or `final`) in French or English ([US-040](US-040-contract-pdf-template.md)), and stores it with its SHA-256 as the contract's current preview.
- [ ] The preview screen shows the PDF with a French/English switch (F-17). The default is the language of the recap screen. Switching renders a new preview, which replaces the current one; the replaced one is kept and recorded. This works until the client signs.
- [ ] Before the first Départ preview is stored, the API checks that the vehicle is still free. The contract becomes `awaiting_signature` (« En attente de signature »), with its number reserved, and no other Départ can start on that vehicle (F-18).
- [ ] « Annuler avant signature » turns a contract waiting for its signature into `void` (« Annulé avant signature »), with a reason. It keeps its number and is never deleted, and the vehicle is free again (F-18).
- [ ] « Faire signer le client » opens a full-screen signature pad. On the iPhone it uses the pad component chosen in the spike; in the web app, a canvas that works with a mouse, a trackpad or a touch screen ([ADR-0021](../adr/0021-web-app.md)). The client draws **once**, can clear and redraw, and confirms (F-17). There is no signing link: the client signs on the staff member's screen (F-30).
- [ ] A contract waiting for signature can be reopened on another device from « Contrats » ([US-065](US-065-contrats-list-and-contract-detail.md)), so that staff working at a laptop let the client sign with a finger on their phone ([ADR-0025](../adr/0025-web-app-first.md)).
- [ ] The app sends the drawing (PNG and stroke points), the preview's ID and its SHA-256. On the web, the evidence record holds the browser's name and version, the operating system it reports and the web build's identifier ([ADR-0023](../adr/0023-signatures-in-the-app-sealed-by-the-api.md)). The API refuses a preview that isn't the current one, or whose SHA-256 doesn't match.
- [ ] The API stamps the drawing into the stage's box on every page, appends the signature certificate page and seals the file ([US-043](US-043-pdf-sealing-and-signature-certificate.md)). It stores the sealed PDF in `contract-pdfs` and the drawing in `signatures`, each with its SHA-256. Then it calls the stage's transaction: sign a Départ ([US-057](US-057-sign-departure-server-function.md)) or close a Retour ([US-074](US-074-client-signs-the-retour.md)).
- [ ] The route is idempotent: sending the same drawing for the same preview twice returns the first result.
- [ ] The drawing isn't kept on the device once the API has accepted it ([ADR-0013](../adr/0013-personal-device-data-protection.md)).
- [ ] If the API can't be reached, the screen says so, keeps the drawing until it is sent or the screen is closed, and nothing is marked signed.
- [ ] API tests cover: signing a Départ and a Retour; a stale preview (refused); a language switch after the preview; a repeated request; a sealing failure (nothing marked signed).

## Notes

- Until 2026-11-10 the client signed in Documenso. The spike showed one tap per page, so signing moved to the app ([ADR-0023](../adr/0023-signatures-in-the-app-sealed-by-the-api.md)).
- The legal level is a simple electronic signature with an audit trail, in a PDF sealed with the company's certificate. The lawyer confirms it is enough (L-01).
