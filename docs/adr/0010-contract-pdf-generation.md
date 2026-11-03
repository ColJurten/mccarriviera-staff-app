# ADR-0010: Generate the contract PDF on the API server from versioned HTML templates

| Status | Date | Decided by | Based on |
|---|---|---|---|
| **Accepted** | 2026-10-07 (updated 2026-11-03) | Developer, with the client's answers | B-04, B-06, B-07 · F-08 (partly answered) · F-13, F-17, R-01 Q2, R-02, R-19 Q1 (answered) · defaults for R-01, R-18, R-19, F-08 · R-17, L-02 |

## Context

- The contract follows the model's presentation and contains every field of the current form (instruction from the client), plus every field of the model (R-02, answered 2026-11-02).
- It is produced in French or English, with a signature on every page.
- Staff must be able to save and share it from the phone.
- The app works online only, and there is no Mac.
- The back end is now the developer's own API server, which can run a headless browser ([ADR-0019](0019-backend-own-api-postgres-s3.md)).
- Documenso needs the PDF on the server to have it signed ([ADR-0020](0020-signatures-with-documenso.md)), and the final PDF embeds every photo at full size, which the server reads straight from storage.
- **F-13** (2026-11-03): the PDF is rendered on the API server.

## Decision

- **Rendering:** HTML/CSS templates are rendered **on the API server** by headless **Chromium** (Playwright) into A4 PDFs (F-13), the same engine as template v1's prototype. The template is TypeScript code in the package shared with the app ([ADR-0016](0016-repository-environments-ci.md)).
- **Language:** chosen in the preview before the client signs, and changeable until they sign (F-17, [ADR-0020](0020-signatures-with-documenso.md)).
- **Versioning:** templates are versioned code in the repository. Each generated PDF records its template version and terms version. Old template versions stay in the code.
- **Page layout:** template v1, in [`docs/contract-template/`](../contract-template/README.md) (2026-11-02; the parts of R-01 and F-08 not yet answered stay defaults):
  1. **Contrat de location**, as signed at the Départ (the model's page 1): places, dates, number of days, flight or train, intermediary; the renter; the additional driver; services included and the deposit; the vehicle; the pick-up agent; a summary of the key general terms; a declaration next to the signature.
  2. **Conditions financières** (the current form's financial parts): rates, deductible, payment method and card; the charges as typed at the Départ next to the « Décompte final » completed at the Retour; the acceptance text next to the signature.
  3. **État du véhicule** (the model's page 2): a contract summary; Départ and Retour columns with date and time, agent, km out / in / driven / included / billed, fuel in eighths with its percentage, and a car papers / clean inside / clean outside / GPS checklist; reference photo thumbnails, dashboard and extra photos, damage open at the Départ, new damage or « RAS »; a declaration next to the signature.
  4. **General terms** in the chosen language.
  5. **Amendments**, one page each: each change as before → after, the reason, the date, and the amendment signature or « Sans signature du client ».
  6. **Photo annex:** every photo at full size, two per page.
- **Fields:** every field of the current form and every field of the model template (R-02, answered 2026-11-02). [`field-map.md`](../contract-template/field-map.md) lists each one with its source, its stage and its column. Each value is printed in the section of the stage that produced it ([ADR-0020](0020-signatures-with-documenso.md)). The model's own wording (its rules, liability and traffic-violation paragraphs, its Swiss terms) is not copied: page 1 summarises MC Car Riviera's own terms instead, and the two declarations are new wording adapted from the model. The lawyer reviews all three (L-02).
- **Pagination:**
  - Every page is an explicit A4 block.
  - Sections that can grow (photos, terms, amendments) continue on extra pages. Every page, including continuation pages, repeats the header, the footer with « page x/y » and the signature block at the bottom right, in the same place in French and English.
  - Fixed sections never overflow, because free-text fields have maximum lengths ([US-006](../stories/US-006-core-database-schema-and-storage.md)).
  - The general terms are stored already split into pages ([US-041](../stories/US-041-general-terms-per-language.md)).
- **Signature block:** at the bottom right of every page, with the « Signature départ » and « Signature retour » boxes (F-08). Amendment pages carry the amendment's own signature there instead of the departure signature (default for F-08, [ADR-0020](0020-signatures-with-documenso.md)).
  - The template gives the API the position of each box on each page, where Documenso places its signature fields.
  - In the final PDF and later copies, the « Signature départ » boxes show the image of the departure signature read back from Documenso (F-17).
- **Photos:** compressed thumbnails on page 3, and every photo at full size in the photo annex (R-01 Q2, answered 2026-11-02). Each full-size photo adds roughly 0.2–0.4 MB ([ADR-0014](0014-file-storage.md) sizes).
- **Staff and company:** the staff member's name is printed as « Agent au départ » and « Agent au retour », like the model's "Pick-up driver" (R-19 Q1, answered 2026-11-02). There is no company signature or stamp, as on both forms (default for R-19 Q2).
- **Company details:** name, address, SIRET, APE code, phone numbers and logo come from one configuration file, filled with details the client has confirmed. Fonts and logo are bundled in the API's image. The brand palette uses placeholders until the assets arrive (default for R-18).
- **Output:**
  - a PDF to be signed is shown as a preview, then sent to Documenso; the **sealed PDF** that comes back is archived in `contract-pdfs` with its SHA-256 ([ADR-0014](0014-file-storage.md));
  - a PDF without a client signature (an amendment « Sans signature du client ») is archived as rendered;
  - the app downloads the archived PDF into its cache and opens the iOS share sheet.
- **Thumbnails:** made by the API from the stored photos at render time.
- **Copies:** a PDF can be rendered again from the same data, template version and terms version, for example in the other language. A copy isn't signed by the client: it carries the signature images and a line « Copie du … — original signé : … », with the original's file name and the start of its SHA-256. The sealed original stays the reference (`RECOMMENDED`; L-01).
- **Tests:**
  - PDF tests in CI render synthetic cases with Chromium: empty optional fields, maximum-length fields, an additional driver, 30 photos, 5 amendments, French and English. A test fails when a page's content is larger than the page.
  - Every template change is also opened on a real iPhone, in the preview and through the share sheet.

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
- The layout places return values in the Retour section rather than on page 1 as on paper. The client confirms this (F-08).

## Alternatives considered

| Option | Why not chosen |
|---|---|
| Rendering on the phone with expo-print (the plan until 2026-11-03) | WebKit print quirks; the phone would download every full-size photo and upload a multi-megabyte PDF over mobile data, and Documenso needs the file on the server anyway (F-13) |
| A separate rendering service (for example Gotenberg) | One more container; Playwright inside the API is enough at this volume |
| Drawing the PDF with pdf-lib on the phone | Tedious layout and text flow |
| Filling a fixed PDF form | Can't follow the model's presentation, or switch language easily |

## Revisit when

Rendering on the server proves too slow or too heavy for the server (spike US-009).

## Changes

- 2026-10-09: the signature block sits at the bottom right of every page (F-08), and the final PDF always carries the return signature (F-04).
- 2026-11-02: R-02, R-19 Q1 and R-01 Q2 answered. Template v1 keeps every field of both templates, prints the staff name and adds a full-size photo annex. The page layout above is template v1 (`docs/contract-template/`), with specimens.
- 2026-11-03: F-13 answered: rendering moves from the phone (expo-print) to the API server (Chromium). The language is chosen in the preview before signing (F-17), signed PDFs are sealed by Documenso, and copies carry the signature images (ADR-0020).

## Implemented by

- [US-009](../stories/US-009-spike-signature-and-pdf-on-iphone.md): Spike: prove Documenso signing and server-rendered PDFs, in a browser and on a real iPhone
- [US-040](../stories/US-040-contract-pdf-template.md): Contract PDF template in French and English, with the signature block at the bottom right
- [US-041](../stories/US-041-general-terms-per-language.md): Manage the general terms (CGV) per language
- [US-042](../stories/US-042-archive-and-share-pdfs.md): Archive, download and share contract PDFs
- [US-044](../stories/US-044-sign-in-documenso-from-the-app.md): Preview a contract PDF and have it signed in Documenso from the app
- [US-055](../stories/US-055-departure-pdf.md): Preview and deliver the departure PDF in French or English
- [US-063](../stories/US-063-reopen-or-regenerate-a-pdf.md): Re-open, re-share or regenerate a contract PDF
- [US-064](../stories/US-064-amendment-pages-in-the-pdf.md): Amendment pages in the PDF
- [US-075](../stories/US-075-final-pdf.md): Generate the final PDF in French or English
