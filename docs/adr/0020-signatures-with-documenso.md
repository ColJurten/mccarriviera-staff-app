# ADR-0020: Signatures through a self-hosted Documenso: one signature fills every page, sealed with the company's certificate

| Status | Date | Decided by | Based on |
|---|---|---|---|
| **Accepted** | 2026-11-03 (updated 2026-11-03) | Developer, with the client's answers | B-06, B-07, B-08 · F-04, F-16, F-17, F-18, F-19 (answered) · F-08 (partly answered) · default for R-11 · L-01 |

## Context

- This ADR supersedes [ADR-0009](0009-signatures.md). ADR-0009's rules on where signatures appear are kept below; what changes is how the signature is captured and sealed.
- On 2026-11-03, the developer chose **Documenso**, an open-source document-signing application, hosted next to the API and called by it ([ADR-0019](0019-backend-own-api-postgres-s3.md)).
- **F-17** (answers of 2026-11-03):
  - the client is asked for **one signature**, which fills every page at once;
  - the language is chosen in the **PDF preview** before signing, and can still be changed while the contract waits for the signature;
  - the final PDF **repeats the image of the departure signature** in the « Signature départ » boxes;
  - the PDFs are sealed with a **self-signed company certificate** to start.
- **F-16** (2026-11-03): the client's e-mail stays optional. A placeholder address is used when there is none.
- Earlier answers still apply:
  - B-06: a signature on every page;
  - B-07: the signature sits in the same place in French and English;
  - F-04: the return signature is mandatory;
  - F-08: the signature block sits at the bottom right;
  - B-08: a client absent at the Retour is the company's matter.
- **Documenso, as documented (checked 2026-11-03):**
  - The Community Edition is open source under AGPL-3.0. Its documentation says it is enough when Documenso runs unmodified.
  - It needs PostgreSQL 14 or later, an SMTP server, and a signing certificate in .p12 form: without one, it starts but every signing fails. S3-compatible storage is recommended. The production minimum is 2 CPUs and 2 GB of RAM.
  - When every signer has signed, it appends a signing certificate page and applies one PAdES digital signature to the whole PDF, so any later change is detectable.
  - Its API (v2) creates an "envelope" from a PDF with signers and fields (page and position), returns signing links, sends webhooks (`DOCUMENT_COMPLETED`), and serves the signed PDF.
  - The embedded document *editor* and qualified signing through a remote signing service (CSC) are in the paid editions. Neither is needed here.
- The three things the brief asked to keep apart still apply:

| | What it is | Here |
|---|---|---|
| **Signature image on several pages** | The drawn signature, shown on each page | Documenso places the client's drawing in each signature field. The departure image is also repeated on the final PDF |
| **Digitally signed PDF (PAdES)** | A certificate-based seal embedded in the file; any change is detectable | Documenso seals every signed PDF with the company's certificate |
| **Electronic signature (legal notion)** | eIDAS levels (simple, advanced, qualified); French Civil Code art. 1366–1367 | Still a **simple** electronic signature, now with a standard audit trail and a sealed file. The lawyer confirms it is enough (L-01) |

## Decision

- **Where it runs:** Documenso Community Edition, **unmodified**, pinned to an exact version, on the production server at `sign.mcr.developerworkshop.online` ([ADR-0019](0019-backend-own-api-postgres-s3.md)).
  - It has its own database (`documenso`), its own bucket, and sends any e-mail through the provider of F-15.
  - Public sign-up is disabled. There is one team, and one API token, held only by the API.
  - Staging has its own instance on the homelab, with its own certificate.
- **Signature fields:** the API places a Documenso signature field in the signature box of **every page**: « Signature départ » at the Départ, « Signature retour » at the Retour. The boxes sit at the same position in French and English (B-06, B-07, F-08), and the template gives the API their coordinates ([ADR-0010](0010-contract-pdf-generation.md)).
- **One signature for every page** (F-17): the client draws once, and the drawing fills every field. Whether Documenso can do this without a tap on each page is proven in the spike [US-009](../stories/US-009-spike-signature-and-pdf-on-iphone.md) before anything is built on it. If it can't, the fallback (for example, one tap per page after the first drawing) is agreed with the client.
- **Départ:**
  1. When the recap is complete, the app asks the API for the **preview**. The API renders the PDF in the chosen language ([ADR-0010](0010-contract-pdf-generation.md)) and creates a Documenso envelope with one signer (the client), the fields, e-mail sending switched off, and the contract and revision as its external ID. The contract becomes « En attente de signature », with its number reserved, since the sealed PDF carries it (F-18).
  2. The preview screen shows the PDF with a French/English switch. Switching renders a new PDF and replaces the waiting envelope; the old one is deleted in Documenso, and the replacement is recorded. This is possible until the client signs (F-17).
  3. « Faire signer le client » opens Documenso's signing page for that envelope in an in-app web view, as a private session that keeps no cookies or cache ([ADR-0013](0013-personal-device-data-protection.md)). In the web app, the page is embedded or opened in a new tab ([ADR-0021](0021-web-app.md)). The client reads the document, draws once and confirms.
  4. Documenso seals the PDF and calls the API's webhook (`DOCUMENT_COMPLETED`), checked with a shared secret. The API downloads the sealed PDF, stores it in `contract-pdfs` with its SHA-256, then runs the sign-departure transaction ([US-057](../stories/US-057-sign-departure-server-function.md)). **The contract becomes active only once the sealed PDF is stored.** If the webhook is late, the app asks the API, which asks Documenso.
- **A Départ that is never signed** (F-18): the contract isn't deleted. It is kept with its number as « Annulé avant signature », and its envelope is deleted in Documenso. The numbering therefore has no gaps.
- **Retour:** the same, with the final PDF and the fields in the « Signature retour » boxes. The signature is **mandatory** (F-04). If the client isn't there, the envelope waits and the Retour stays « en attente de signature »; the vehicle stays « En cours » until then (`RECOMMENDED`). How the company reaches the client is outside the app (B-08).
- **The departure signature on later PDFs** (F-17): once the Départ is signed, the API reads the image of the client's departure signature back from Documenso and stores it in `signatures`, with its SHA-256, linked to the evidence record. It is printed in the « Signature départ » boxes of the final PDF and of any later copy, except on amendment pages.
  - How to read it back (Documenso's API, or its database) is settled in the spike US-009.
  - This copy is an image, not a new act of signing. The sealed Départ PDF remains the proof of the departure signature. The lawyer reviews this (L-01).
- **Amendments:** with the client present, the amendment PDF is signed in Documenso like a handover, with the fields in the amendment's own box. Without the client, the page says « Sans signature du client » (default for R-11).
- **A signature only appears next to values that existed when it was given** (kept from ADR-0009; `RECOMMENDED`, default for F-08):
  - page 1 always shows the contract as signed at the Départ;
  - changes appear on amendment pages;
  - return values and final amounts appear in the Retour section;
  - the departure signature isn't placed on amendment pages.
- **The client's e-mail** (F-16): Documenso signers carry an e-mail address. The client's e-mail is used when it is known. Otherwise, a placeholder is used, made from the contract number on a subdomain of the company's domain that has no mail server, for example `mcr-2026-0042@nomail.mcr.developerworkshop.online` (`RECOMMENDED`).
  - Documenso's e-mails to signers (requests, reminders, completed copies) are switched off. Staff share the PDF from the app, as before ([US-042](../stories/US-042-archive-and-share-pdfs.md)).
  - That these e-mails can be switched off for each document is checked in the spike US-009.
- **Evidence:**
  - Documenso's audit trail and signing certificate page stay in the sealed PDF: times, the signing device's IP address and browser, and the document's hashes.
  - The API keeps its own record for each signature: Documenso's envelope and signer IDs, the staff user, the device model, the iOS and app versions, the contract and revision, the SHA-256 of the data snapshot, the terms versions, the SHA-256 of the sealed PDF, and the server times.
- **Certificate** (F-17): a **self-signed** company certificate in .p12 form, protected by a passphrase. Production and staging have different ones.
  - It is kept in the server's secrets and in the developer's password manager, with a sealed copy for the company, like the backup keys ([ADR-0015](0015-backups.md)).
  - Adobe Reader shows the seal as intact, but the signer's identity as unverified, until a trusted certificate is used.
  - Upgrade paths, decided with the lawyer (L-01): a certificate from a certification authority on Adobe's trust list, or a qualified electronic seal from a trust service provider. The second needs Documenso's paid Enterprise edition (CSC signing).
- **Licence:** Documenso runs unmodified, as the Community Edition (AGPL-3.0). Any change to its code would have to be published under the same licence. The app and the API are separate programs that call it over HTTP.

## Consequences

**Positive**

- Every signed PDF is tamper-evident, sealed with the company's certificate. ADR-0009 had no seal in the MVP.
- A standard audit trail is attached to each signed PDF.
- No per-signature fees, and no signature pad to build in the app.

**Negative / risks**

- A second web application to run and upgrade. It migrates its database at every start, so the database is backed up before each upgrade.
- Several behaviours must be proven on an iPhone first (spike US-009): signing in an in-app web view, one drawing for every field, e-mails switched off, the placeholder address, and reading the signature image back. Each has a fallback, but some fallbacks change the flow.
- Documenso appends its own certificate page after the contract's numbered pages. « Page n / N » counts the contract's pages only.
- Signing needs the server and the network ([ADR-0005](0005-online-only.md)). A server incident stops handovers.
- The departure image repeated on the final PDF is weaker evidence than a signature given on that PDF (L-01).
- Documenso's database and bucket also hold client personal data (names, signatures, PDFs). Backups ([ADR-0015](0015-backups.md)) and erasure ([US-094](../stories/US-094-retention-and-erasure.md)) cover them.

## Alternatives considered

| Option | Why not chosen |
|---|---|
| A signature pad in the app, with the image placed in the PDF (ADR-0009) | Superseded: no tamper-evident PDF, and no standard audit trail |
| A pad in the app, plus a PAdES seal applied by the API | Possible, but the audit trail and the sealing would be ours to build and get right |
| DocuSeal (open source, self-hosted) | A close alternative, with a documented React Native integration. Kept as the fallback if the spike fails |
| A hosted e-signature service (for example Yousign or Docusign) | Fees per signature or per month, and another processor. Worth a look if the lawyer requires a qualified signature (L-01) |

## Revisit when

The spike US-009 fails on a point that matters, the lawyer's answer to L-01 requires a stronger signature or a trusted certificate, or Documenso's licence or editions change.

## Changes

- 2026-11-03: written. Supersedes ADR-0009, with the answers to F-16 and F-17.
- 2026-11-03 (later): F-18 answered (a contract never signed is kept as « Annulé avant signature », with its number) and F-19 (signing from the web app). The public names are on the developer's domain (F-14).

## Implemented by

- [US-009](../stories/US-009-spike-signature-and-pdf-on-iphone.md): Spike: prove Documenso signing and server-rendered PDFs, in a browser and on a real iPhone
- [US-040](../stories/US-040-contract-pdf-template.md): Contract PDF template in French and English, with the signature block at the bottom right
- [US-042](../stories/US-042-archive-and-share-pdfs.md): Archive, download and share contract PDFs
- [US-043](../stories/US-043-deploy-documenso.md): Deploy Documenso and connect it to the API
- [US-044](../stories/US-044-sign-in-documenso-from-the-app.md): Preview a contract PDF and have it signed in Documenso from the app
- [US-054](../stories/US-054-client-signs-the-depart.md): Client signs the Départ
- [US-055](../stories/US-055-departure-pdf.md): Preview and deliver the departure PDF in French or English
- [US-056](../stories/US-056-resume-or-discard-a-draft.md): Resume or discard a draft Départ
- [US-057](../stories/US-057-sign-departure-server-function.md): API: sign a Départ in one database transaction
- [US-061](../stories/US-061-extend-or-amend-a-rental.md): Extend a rental or amend allowed fields
- [US-063](../stories/US-063-reopen-or-regenerate-a-pdf.md): Re-open, re-share or regenerate a contract PDF
- [US-064](../stories/US-064-amendment-pages-in-the-pdf.md): Amendment pages in the PDF
- [US-074](../stories/US-074-client-signs-the-retour.md): Client signs the Retour and the rental is closed
- [US-075](../stories/US-075-final-pdf.md): Generate the final PDF in French or English
- [US-092](../stories/US-092-legal-and-privacy-checklist.md): Send the legal and privacy questions, and close them before go-live
- [US-093](../stories/US-093-operations-runbook.md): Write the operations runbook
- [US-094](../stories/US-094-retention-and-erasure.md): Apply retention and erasure rules
