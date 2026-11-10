# ADR-0023: Signatures captured in the app: one drawing stamped on every page, the PDF sealed by the API

| Status | Date | Decided by | Based on |
|---|---|---|---|
| **Accepted** | 2026-11-10 | Developer, with the client's answers | B-06, B-07, B-08 · F-04, F-17, F-18, F-19, F-26, F-27, F-28 (answered) · F-08 (answered by F-22) · L-01 |

## Context

- This ADR supersedes [ADR-0020](0020-signatures-with-documenso.md) (Documenso). What ADR-0020 and [ADR-0009](0009-signatures.md) decided about where signatures appear is carried over below. What changes is who captures the signature and who seals the PDF.
- **The spike [US-009](../stories/US-009-spike-signature-and-pdf-on-iphone.md), part 1** (ticket #5, PR #21, Documenso v2.20.0, 2026-11-05):
  - One drawing did **not** fill the signature fields. A 10-page contract needed 10 taps.
  - Documenso's source code lists name, initials, e-mail and date as fields it can fill by itself, but not the signature (`packages/lib/constants/autosign.ts`). The taps are built in, not a setting the spike missed.
  - The developer confirmed it by hand (2026-11-10): the signer draws once, then has to validate each page where the signature goes. F-17 asked for one signature on every page at once: "we need automation, one signature pasted on all pages instantly".
- **Client meeting, November 2026** (reported by the developer on 2026-11-10):
  - **F-26:** a Départ or a Retour waiting for the client's signature can need changes before it is signed: damage that wasn't recorded, or a client who disagrees and asks for new photos. Staff add them to the draft, then the client signs.
  - **F-28:** at the Retour, a client may have no time to wait until the inspection is finished and the draft is ready to sign. They want to record the client's signature at the drop-off, then use it to sign the finished Retour later.
- **F-27** (2026-11-10): the developer chose to capture the signature in the app and have the API seal the PDF, instead of DocuSeal or a hosted signing service.
- **F-28 answers** (2026-11-10):
  - the stored signature is a feature that can be switched on or off, because of the dispute risk. It is on for MC Car Riviera and possibly for other rental companies later, if they agree;
  - the switch sits in the company configuration file, one deployment per company;
  - the signature is valid for **one contract's Retour**, used once, after the client has signed an authorisation text, which the lawyer reviews;
  - it has **no time limit**: it stays usable until it is applied, or until the Retour is signed another way or the contract is voided;
  - staff share the final PDF as today, with no automatic e-mail.
- **Kept from ADR-0020 and ADR-0009:**
  - a signature on every page, at the bottom right, in the same place in French and English (B-06, B-07, F-08);
  - the return signature is mandatory (F-04);
  - the language is chosen in the preview and can be switched until the client signs (F-17);
  - the contract number is reserved at the preview, and a contract never signed is kept as « Annulé avant signature » (F-18);
  - the final PDF repeats the image of the departure signature (F-17);
  - a self-signed company certificate to start (F-17).
- The three things the brief asked to keep apart:

| | What it is | Here |
|---|---|---|
| **Signature image on several pages** | The drawn signature, shown on each page | The API stamps the client's one drawing into the signature box of every page |
| **Digitally signed PDF (PAdES)** | A certificate-based seal embedded in the file; any change is detectable | The API seals every signed PDF with the company's certificate, with a timestamp |
| **Electronic signature (legal notion)** | eIDAS levels (simple, advanced, qualified); French Civil Code art. 1366–1367 | A **simple** electronic signature with an audit trail and a sealed file, as with Documenso. The stored signature (F-28) is weaker evidence. The lawyer confirms both (L-01) |

## Decision

- **Capture in the app:**
  - The preview screen shows the PDF the API rendered, with the French/English switch ([ADR-0010](0010-contract-pdf-generation.md)).
  - « Faire signer le client » opens a full-screen signature pad: on the iPhone, a pad component chosen in the spike; in the web app, an HTML canvas ([ADR-0021](0021-web-app.md)). The client draws **once** and confirms.
  - The app sends the drawing (PNG image and stroke points), the preview's ID and the SHA-256 of the previewed PDF to the API.
- **Stamping and sealing on the API:**
  1. The API checks that the preview is the current one for this contract and that its SHA-256 matches. The client therefore signs exactly the file they were shown.
  2. It stamps the drawing into the signature box of **every page** of that preview, at the positions the template gives ([ADR-0010](0010-contract-pdf-generation.md)): « Signature départ » at the Départ, « Signature retour » at the Retour. The pages are not rendered again (`RECOMMENDED`).
  3. It appends a **signature certificate page**: the contract and revision, the signer's name as printed, the staff user, the server times, the device model, the operating-system and app versions, the IP address seen by the API, the signing mode (in person or stored), and the SHA-256 of the preview, of the drawing and of the data snapshot. « Page n / N » counts the contract's pages only.
  4. It applies one **PAdES** signature to the whole file with the company certificate, with a timestamp from an RFC 3161 timestamping authority. The library is chosen in the spike US-009, part 2: pyHanko, called as a command in the API's image, or a maintained Node library (`RECOMMENDED`). The timestamping authority is chosen there too.
  5. It stores the sealed PDF in `contract-pdfs` with its SHA-256, and the drawing in `signatures` ([ADR-0014](0014-file-storage.md)). It then runs the transaction that activates the contract at the Départ ([US-057](../stories/US-057-sign-departure-server-function.md)) or closes it at the Retour. **The status changes only once the sealed PDF is stored.**
- **Previews:** each preview is stored, so that the API stamps exactly the file the client saw. A preview that is replaced, by a language switch or by a change (F-26), is never signed; it stays stored and in the audit trail.
- **Changing a draft waiting for signature** (F-26), at the Départ and at the Retour:
  - staff reopen it from the preview or from the Contrats tab, change values, take new photos, or record a damage the client points out ([ADR-0024](0024-vehicle-condition-four-angles-estimates.md));
  - the API renders a new preview with the same contract number;
  - the client signs only the new preview.
- **A Départ never signed** (F-18): kept with its number as « Annulé avant signature ».
- **Retour:** the same flow, with the final PDF. The signature is **mandatory** (F-04). If the client isn't there, the Retour waits « en attente de signature », and the vehicle stays « En cours » (`RECOMMENDED`). How the company reaches the client is outside the app (B-08), except for the stored signature below.
- **Stored Retour signature** (F-28):
  - **Switch:** `signature.storedReturnSignature` in the company configuration ([ADR-0010](0010-contract-pdf-generation.md)), `false` by default and `true` for MC Car Riviera. When it is off, the app doesn't offer it and the API refuses it.
  - **When:** at the Retour, before the inspection or the pricing is finished, with the client present.
  - **Capture:**
    1. The app shows the authorisation text in the contract's language. The text is versioned like the general terms, and the lawyer reviews it (L-01). It names the contract, the vehicle, the time, and the km and fuel if staff have entered them.
    2. The client draws once and confirms.
    3. The API renders the authorisation page, stamps the drawing on it, seals it at once, and stores it. The stored-signature record starts as `pending`.
  - **Use:** when the Retour is finished, staff open its preview and choose « Apposer la signature enregistrée ».
    1. The API stamps the stored drawing into the « Signature retour » boxes.
    2. It adds the authorisation page to the PDF, before the general terms.
    3. Its certificate page records the stored mode, the capture time and the time it was applied.
    4. It seals the PDF as above. The record becomes `applied`.
  - **Limits:**
    - one contract's Retour, once; the API refuses any other use;
    - no time limit (F-28);
    - if the client signs in person after all, or the contract is voided, the record becomes `cancelled` and can't be used;
    - status changes go only through SQL functions ([ADR-0007](0007-contract-lifecycle-and-audit.md));
    - the drawing and the record are kept as evidence, never deleted before the retention rules allow it (L-03, L-07).
  - **The final PDF:** the « Signature retour » boxes show the drawing with « Enregistrée le … · apposée le … ». Staff share the PDF from the app as today (F-28, [US-042](../stories/US-042-archive-and-share-pdfs.md)).
- **The departure signature on later PDFs** (F-17): the app captured the drawing, so the API already has it. There is nothing to read back. It is printed in the « Signature départ » boxes of the final PDF and of any later copy.
  - This copy is an image, not a new act of signing. The sealed departure PDF remains the proof of the departure signature (L-01).
- **A signature only appears next to values that existed when it was given** (`RECOMMENDED`, kept from ADR-0009):
  - page 1 shows the contract as signed at the Départ;
  - changes during the rental are no longer printed as amendment pages (F-22). They show in the final statement;
  - return values and final amounts sit in the Retour column and the final statement.
- **Evidence record** for each signature, insert-only:
  - the drawing and its stroke points, with their SHA-256;
  - the signing mode (in person or stored), and for a stored signature, its record;
  - the server time;
  - the staff user;
  - the device model, the operating-system and app versions;
  - the IP address seen by the API;
  - the contract and revision;
  - the SHA-256 of the preview, of the data snapshot and of the sealed PDF;
  - the IDs of the terms versions, and of the authorisation text version for a stored signature.
- **Certificate** (F-17): a **self-signed** company certificate in .p12 form, protected by a passphrase, now held by the API. Production and staging have different ones.
  - It is kept in the server's secrets and in the developer's password manager, with a sealed copy for the company, like the backup keys ([ADR-0015](0015-backups.md)).
  - Adobe Reader shows the seal as intact, but the signer's identity as unverified, until a trusted certificate is used.
  - Upgrade paths, decided with the lawyer (L-01): a certificate from a certification authority on Adobe's trust list, a qualified timestamp, or a qualified electronic seal from a trust service provider, through its remote signing API.
- **No e-mail for signing:** nothing sends e-mail to signers, and the client's e-mail stays optional. The placeholder address of F-16 is no longer needed.
- **No Documenso:** no `documenso` database, no Documenso bucket, no `sign.` subdomains ([ADR-0019](0019-backend-own-api-postgres-s3.md)).

## Consequences

**Positive**

- One drawing fills every page at once, as the client asked (F-17).
- Changing a draft (F-26) and the stored signature (F-28) are flows the app controls, rather than limits of a third-party tool.
- One less application to run, upgrade, back up and secure. No AGPL component and no `sign.` subdomain.
- The same flow on the iPhone and in the web app, with no web view session or third-party cookies.

**Negative / risks**

- The pad, the stamping, the certificate page, the sealing and the timestamp are ours to build and get right. The spike US-009, part 2, proves them first.
- No independent signing platform's audit trail: our evidence record, the certificate page, the timestamp and the seal are the proof.
- **The stored signature is weaker evidence** than a signature given on the finished document: the client did not see the new damage or the final amounts when they signed. Disputes are likely to come when new damage is billed. Hence the switch, the authorisation text, the single use and the lawyer's review (L-01).
- The departure image repeated on the final PDF is weaker evidence than a signature given on that PDF (L-01).
- Signing needs the server and the network ([ADR-0005](0005-online-only.md)).

## Alternatives considered

| Option | Why not chosen |
|---|---|
| Documenso, self-hosted ([ADR-0020](0020-signatures-with-documenso.md)) | One tap per page (spike US-009, part 1); no way to store a signature for later |
| DocuSeal, self-hosted | One field can be placed on several pages, which might fill every page from one drawing. Still another application to run, its embedded signing form is a paid feature, it needed its own spike, and a stored signature doesn't fit its model |
| A hosted signing service (for example Yousign) | Fees per signature; one signature for every page not confirmed; a stored signature is contrary to how these services work. Worth a look if the lawyer requires an advanced or qualified signature (L-01) |
| A pad in the app with only the image placed in the PDF ([ADR-0009](0009-signatures.md)) | No tamper-evident file and no timestamp |

## Revisit when

The spike US-009, part 2, fails on stamping or sealing; the lawyer's answer to L-01 requires a stronger signature or rules out the stored signature; or a dispute shows the stored signature doesn't hold up.

## Changes

- 2026-11-10: written. Supersedes ADR-0020, after the spike US-009, part 1, and the client meeting (F-26, F-27, F-28).

## Implemented by

- [US-009](../stories/US-009-spike-signature-and-pdf-on-iphone.md): Spike: prove in-app signing, stamping and sealing, and server-rendered PDFs, in a browser and on a real iPhone
- [US-040](../stories/US-040-contract-pdf-template.md): Contract PDF template in French and English, with the signature block at the bottom right
- [US-042](../stories/US-042-archive-and-share-pdfs.md): Archive, download and share contract PDFs
- [US-043](../stories/US-043-pdf-sealing-and-signature-certificate.md): Seal signed PDFs with the company certificate, a timestamp and a signature certificate page
- [US-044](../stories/US-044-client-signs-in-the-app.md): Preview a contract PDF and have the client sign it in the app
- [US-054](../stories/US-054-client-signs-the-depart.md): Client signs the Départ
- [US-055](../stories/US-055-departure-pdf.md): Preview and deliver the departure PDF in French or English
- [US-056](../stories/US-056-resume-or-discard-a-draft.md): Resume or discard a draft Départ
- [US-057](../stories/US-057-sign-departure-server-function.md): API: sign a Départ in one database transaction
- [US-058](../stories/US-058-change-a-contract-awaiting-signature.md): Change a Départ or a Retour waiting for signature: new photos, damage, values
- [US-063](../stories/US-063-reopen-or-regenerate-a-pdf.md): Re-open, re-share or regenerate a contract PDF
- [US-074](../stories/US-074-client-signs-the-retour.md): Client signs the Retour and the rental is closed
- [US-075](../stories/US-075-final-pdf.md): Generate the final PDF in French or English
- [US-076](../stories/US-076-stored-return-signature.md): Record the client's signature at the drop-off and apply it to the finished Retour
- [US-092](../stories/US-092-legal-and-privacy-checklist.md): Send the legal and privacy questions, and close them before go-live
- [US-093](../stories/US-093-operations-runbook.md): Write the operations runbook
- [US-094](../stories/US-094-retention-and-erasure.md): Apply retention and erasure rules
