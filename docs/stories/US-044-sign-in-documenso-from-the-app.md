# US-044 · Preview a contract PDF and have it signed in Documenso from the app

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E4 · Contract document | Must | P2 | L | To do |

- **Depends on:** [US-043](US-043-deploy-documenso.md) · [US-040](US-040-contract-pdf-template.md) · [US-042](US-042-archive-and-share-pdfs.md) · [US-009](US-009-spike-signature-and-pdf-on-iphone.md)
- **Decisions:** [ADR-0020](../adr/0020-signatures-with-documenso.md) · [ADR-0010](../adr/0010-contract-pdf-generation.md) · [ADR-0021](../adr/0021-web-app.md) · [ADR-0014](../adr/0014-file-storage.md) · [ADR-0013](../adr/0013-personal-device-data-protection.md) · [ADR-0005](../adr/0005-online-only.md)
- **Open points:** F-16, L-01 (see [open questions](../discovery/open-questions.md))

## Story

As a staff member, I want to show the client the contract in their language and have them sign it once on my phone, so that the company gets a sealed PDF signed on every page.

## Acceptance criteria

- [ ] An API route renders the PDF for a contract revision and stage (`departure`, `amendment`, `final`) in French or English ([US-040](US-040-contract-pdf-template.md)), and creates a Documenso envelope from it: one signer (the client, with their e-mail or the placeholder address of F-16), a signature field in the stage's box on every page, e-mails off, and the contract and revision as external ID.
- [ ] The preview screen shows the PDF with a French/English switch (F-17). The default is the language of the recap screen. Switching renders a new PDF and replaces the waiting envelope; the old one is deleted in Documenso and the replacement is recorded. This works until the client signs.
- [ ] Before the envelope is created, the API checks that the vehicle is still free. The contract becomes `awaiting_signature` (« En attente de signature »), with its number reserved, and no other Départ can start on that vehicle (F-18).
- [ ] « Annuler avant signature » turns a contract waiting for its signature into `void` (« Annulé avant signature »), with a reason. It keeps its number and is never deleted; the envelope is deleted in Documenso and the vehicle is free again (F-18).
- [ ] « Faire signer le client » opens Documenso's signing page in an in-app web view, as a private session. The client draws once, and the drawing fills every page (F-17). When signing ends, the web view closes and keeps no cookies, cache or local storage. In the web app, the signing page is embedded or opened in a new tab, as settled in the spike ([ADR-0021](../adr/0021-web-app.md)).
- [ ] The API's webhook route checks Documenso's secret, and is idempotent. It downloads the sealed PDF, stores it in `contract-pdfs` with its SHA-256, records the evidence (envelope and signer IDs, hashes, server times), then calls the stage's transaction: sign a Départ ([US-057](US-057-sign-departure-server-function.md)), close a Retour ([US-074](US-074-client-signs-the-retour.md)) or save a signed amendment ([US-061](US-061-extend-or-amend-a-rental.md)).
- [ ] If the webhook doesn't arrive, the app's status check makes the API ask Documenso, and completes the same steps.
- [ ] After a Départ is signed, the API reads the image of the client's signature back from Documenso and stores it in `signatures` with its SHA-256 (F-17), for the final PDF.
- [ ] If Documenso can't be reached, the screen says so, and nothing is marked signed.
- [ ] API tests run against a mock of Documenso's API. One end-to-end test runs on staging with the real Documenso.

## Notes

- The legal level is a simple electronic signature with an audit trail, in a PDF sealed with the company's certificate. The lawyer confirms it is enough (L-01).
