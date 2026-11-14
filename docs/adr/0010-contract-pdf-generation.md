# ADR-0010: Generate the contract PDF on the API server from versioned HTML templates

| Status | Date | Decided by | Based on |
|---|---|---|---|
| **Accepted** | 2026-10-07 (updated 2026-11-14) | Developer, with the client's answers | B-04, B-06, B-07 · F-08, F-13, F-17, F-22, F-24, F-28, R-01, R-02, R-19 Q1 (answered) · defaults for R-18, R-19 · R-17, L-02 |

## Context

- The contract follows the model's presentation and contains every field of the current form (instruction from the client), plus every field of the model (R-02, answered 2026-11-02).
- It is produced in French or English, with a signature on every page.
- Staff must be able to save and share it from the phone.
- The app works online only, and there is no Mac.
- The back end is now the developer's own API server, which can run a headless browser ([ADR-0019](0019-backend-own-api-postgres-s3.md)).
- The API stamps the client's signature into the PDF and seals it ([ADR-0023](0023-signatures-in-the-app-sealed-by-the-api.md)), and the final PDF embeds every photo at full size, which the server reads straight from storage.
- **F-22** (client meeting, November 2026, reported on 2026-11-10): page 1 becomes a summary of the contract **with the pricing**; « Services inclus » and the key-terms box are dropped; the deposit moves into the pricing block; there are **no amendment pages**.
- **F-24** (same meeting): the final PDF puts new damage first, or « RAS », and moves the damage already present at the Départ to an annex.
- **F-13** (2026-11-03): the PDF is rendered on the API server.

## Decision

- **Rendering:** HTML/CSS templates are rendered **on the API server** by headless **Chromium** (Playwright) into A4 PDFs (F-13), the same engine as template v1's prototype. The template is TypeScript code in the package shared with the app ([ADR-0016](0016-repository-environments-ci.md)).
- **Language:** chosen in the preview before the client signs, and changeable until they sign (F-17, [ADR-0023](0023-signatures-in-the-app-sealed-by-the-api.md)).
- **Versioning:** templates are versioned code in the repository. Each generated PDF records its template version and terms version. Old template versions stay in the code.
- **Page layout:** template v2, in [`docs/contract-template/`](../contract-template/README.md) (2026-11-10, F-22 and F-24):
  1. **Contrat de location**, as signed at the Départ, with the pricing: places, dates, number of days, flight or train, intermediary; the renter; the additional driver and the pick-up agent; the vehicle; rates; deductible and deposit; payment method and card; the charges as typed at the Départ next to the « Décompte final » completed at the Retour; the declaration and the acceptance text next to the signature.
  2. **État du véhicule** (the model's page 2): a contract summary; Départ and Retour columns with date and time, agent, km out / in / driven / included / billed, fuel in eighths with its percentage, and a car papers / clean inside / clean outside / GPS checklist; reference photo thumbnails.
     - In the Départ PDF: the dashboard photo and the damage already present, including damage found at this Départ ([ADR-0024](0024-vehicle-condition-four-angles-estimates.md)).
     - In the final PDF: **the new damage first**, with photos and estimates, or « RAS »; then the dashboard photos, the comments, and a line pointing to the annex of damage already present.
     - A declaration next to the signature.
  3. **Annexe · Dommages déjà présents au départ** (final PDF, when there are any): each damage with its photo, comment, and where and when it was found.
  4. **Autorisation de signature** (final PDF, only when the stored signature was used, [ADR-0023](0023-signatures-in-the-app-sealed-by-the-api.md)): the authorisation text, when it was signed and applied, and the client's drawing.
  5. **General terms** in the chosen language.
  6. **Photo annex:** every photo at full size, two per page. In the final PDF, the new damage comes first.
  - Dropped from template v1: the « Conditions financières » page (now on page 1), « Services inclus », the key-terms box and the amendment pages (F-22).
- **Fields:** every field of the current form and every field of the model template (R-02, answered 2026-11-02). [`field-map.md`](../contract-template/field-map.md) lists each one with its source, its stage and its column. Each value is printed in the section of the stage that produced it ([ADR-0023](0023-signatures-in-the-app-sealed-by-the-api.md)), except « Services inclus », dropped by F-22. The model's own wording (its rules, liability and traffic-violation paragraphs, its Swiss terms) is not copied. The two declarations are new wording adapted from the model, and the authorisation text of the stored signature is new too. The lawyer reviews them (L-01, L-02).
- **Pagination:**
  - Every page is an explicit A4 block.
  - Sections that can grow (photos, damage, terms) continue on extra pages. Every page, including continuation pages, repeats the header, the footer with « page x/y » and the signature block at the bottom right, in the same place in French and English.
  - Fixed sections never overflow, because free-text fields have maximum lengths ([US-006](../stories/US-006-core-database-schema-and-storage.md)). Page 1 is now dense (F-22): the maximum lengths are checked against it.
  - The general terms are stored already split into pages ([US-041](../stories/US-041-general-terms-per-language.md)).
- **Signature block:** at the bottom right of every page, with the « Signature départ » and « Signature retour » boxes (F-08).
  - The template gives the API the position of each box on each page, where it stamps the client's drawing ([ADR-0023](0023-signatures-in-the-app-sealed-by-the-api.md)).
  - In the final PDF and later copies, the « Signature départ » boxes show the departure drawing (F-17). With a stored signature, the « Signature retour » boxes say when it was recorded and applied (F-28).
- **Photos:** compressed thumbnails on the vehicle-condition page, and every photo at full size in the photo annex (R-01 Q2, answered 2026-11-02). Each full-size photo adds roughly 0.2–0.4 MB ([ADR-0014](0014-file-storage.md) sizes).
- **Staff and company:** the staff member's name is printed as « Agent au départ » and « Agent au retour », like the model's "Pick-up driver" (R-19 Q1, answered 2026-11-02). There is no company signature or stamp, as on both forms (default for R-19 Q2).
- **Company details:** name, address, SIRET, APE code, phone numbers and logo come from one configuration file, filled with details the client has confirmed. The same file holds the stored-signature switch (F-28, [ADR-0023](0023-signatures-in-the-app-sealed-by-the-api.md)). Fonts and logo are bundled in the API's image. The brand palette uses placeholders until the assets arrive (default for R-18).
- **Output:**
  - a PDF to be signed is stored and shown as a preview; once the client signs, the API stamps and seals that file, and archives the **sealed PDF** in `contract-pdfs` with its SHA-256 ([ADR-0014](0014-file-storage.md), [ADR-0023](0023-signatures-in-the-app-sealed-by-the-api.md));
  - the web app opens the archived PDF in the browser's viewer, downloads it or shares it; the iPhone app downloads it into its cache and opens the iOS share sheet ([US-042](../stories/US-042-archive-and-share-pdfs.md)).
- **Thumbnails:** made by the API from the stored photos at render time.
- **Copies:** a PDF can be rendered again from the same data, template version and terms version, for example in the other language. A copy isn't signed by the client: it carries the signature images and a line « Copie du … — original signé : … », with the original's file name and the start of its SHA-256. The sealed original stays the reference (`RECOMMENDED`; L-01).
- **Tests:**
  - PDF tests in CI render synthetic cases with Chromium: empty optional fields, maximum-length fields on page 1, an additional driver, 30 photos, 10 damage records with estimates, « RAS », a stored signature, French and English. A test fails when a page's content is larger than the page.
  - Every template change is also opened in a desktop browser and in a phone's browser, and on a real iPhone from the iPhone phase ([ADR-0025](0025-web-app-first.md)).

## Consequences

**Positive**

- The same engine as template v1's prototype, and the PDFs CI tests are the ones production makes.
- The phone doesn't download full-size photos or upload a multi-megabyte PDF over mobile data.
- HTML/CSS makes it easy to follow the model's look.
- One template serves both languages.

**Negative / risks**

- Chromium in the API's image needs memory (counted in the 4 GB server, [ADR-0019](0019-backend-own-api-postgres-s3.md)), and rendering takes a few seconds. Measured in the spike [US-009](../stories/US-009-spike-signature-and-pdf-on-iphone.md).
- Repeated footers must still be built as explicit page blocks.
- The photo annex makes the final PDF several megabytes, still within e-mail attachment limits.
- The layout places return values in the Retour section rather than on page 1 as on paper, and changes during the rental appear only in the final statement (F-22).
- Page 1 holds the contract and the pricing, so its rows are dense and long values can wrap. The maximum-length tests guard it.

## Alternatives considered

| Option | Why not chosen |
|---|---|
| Rendering on the phone with expo-print (the plan until 2026-11-03) | WebKit print quirks; the phone would download every full-size photo and upload a multi-megabyte PDF over mobile data, and the server needs the file to stamp and seal it anyway (F-13) |
| A separate rendering service (for example Gotenberg) | One more container; Playwright inside the API is enough at this volume |
| Drawing the PDF with pdf-lib on the phone | Tedious layout and text flow |
| Filling a fixed PDF form | Can't follow the model's presentation, or switch language easily |

## Revisit when

Rendering on the server proves too slow or too heavy for the server (spike US-009).

## Changes

- 2026-10-09: the signature block sits at the bottom right of every page (F-08), and the final PDF always carries the return signature (F-04).
- 2026-11-02: R-02, R-19 Q1 and R-01 Q2 answered. Template v1 keeps every field of both templates, prints the staff name and adds a full-size photo annex. The page layout above is template v1 (`docs/contract-template/`), with specimens.
- 2026-11-03: F-13 answered: rendering moves from the phone (expo-print) to the API server (Chromium). The language is chosen in the preview before signing (F-17), signed PDFs are sealed by Documenso, and copies carry the signature images (ADR-0020).
- 2026-11-10: F-22 and F-24 answered (client meeting), which also answers the rest of R-01 and the default part of F-08: template v2, with page 1 holding the pricing, no « Services inclus », no key-terms box, the deposit in the pricing block, no amendment pages, new damage first and the damage already present in an annex. Signing moves from Documenso to the app and the API ([ADR-0023](0023-signatures-in-the-app-sealed-by-the-api.md)), with an authorisation page when the stored signature is used (F-28).
- 2026-11-14: the web app comes first (F-29, [ADR-0025](0025-web-app-first.md)): PDFs are opened and checked in browsers, then on the iPhone.

## Implemented by

- [US-009](../stories/US-009-spike-signature-and-pdf-on-iphone.md): Spike: prove in-app signing, stamping and sealing, and server-rendered PDFs, in a browser and on a real iPhone
- [US-040](../stories/US-040-contract-pdf-template.md): Contract PDF template in French and English, with the signature block at the bottom right
- [US-041](../stories/US-041-general-terms-per-language.md): Manage the general terms (CGV) per language
- [US-042](../stories/US-042-archive-and-share-pdfs.md): Archive, download and share contract PDFs
- [US-044](../stories/US-044-client-signs-in-the-app.md): Preview a contract PDF and have the client sign it in the app
- [US-055](../stories/US-055-departure-pdf.md): Preview and deliver the departure PDF in French or English
- [US-063](../stories/US-063-reopen-or-regenerate-a-pdf.md): Re-open, re-share or regenerate a contract PDF
- [US-075](../stories/US-075-final-pdf.md): Generate the final PDF in French or English
- [US-076](../stories/US-076-stored-return-signature.md): Record the client's signature at the drop-off and apply it to the finished Retour
