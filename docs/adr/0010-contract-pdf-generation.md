# ADR-0010: Generate the contract PDF on the phone from versioned HTML templates

| Status | Date | Decided by | Based on |
|---|---|---|---|
| **Accepted** | 2026-10-07 (updated 2026-11-02) | Developer, with the client's answers | B-04, B-06, B-07 · F-08 (partly answered) · R-01 Q2, R-02, R-19 Q1 (answered) · defaults for R-01, R-18, R-19, F-08 · R-17, L-02 |

## Context

- The contract follows the model's presentation and contains every field of the current form (instruction from the client), plus every field of the model (R-02, answered 2026-11-02).
- It is produced in French or English, with a signature on every page.
- Staff must be able to save and share it from the phone.
- The app works online only, and there is no Mac.
- Supabase Edge Functions run on Deno and don't include a browser engine to render HTML.

## Decision

- **Rendering:** HTML/CSS templates are rendered **in the app** and converted to an A4 PDF with **expo-print** (iOS's WebKit print engine).
- **Versioning:** templates are versioned code in the repository. Each generated PDF records its template version and terms version. Old template versions stay in the code.
- **Page layout:** template v1, in [`docs/contract-template/`](../contract-template/README.md) (2026-11-02; the parts of R-01 and F-08 not yet answered stay defaults):
  1. **Contrat de location**, as signed at the Départ (the model's page 1): places, dates, number of days, flight or train, intermediary; the renter; the additional driver; services included and the deposit; the vehicle; the pick-up agent; a summary of the key general terms; a declaration next to the signature.
  2. **Conditions financières** (the current form's financial parts): rates, deductible, payment method and card; the charges as typed at the Départ next to the « Décompte final » completed at the Retour; the acceptance text next to the signature.
  3. **État du véhicule** (the model's page 2): a contract summary; Départ and Retour columns with date and time, agent, km out / in / driven / included / billed, fuel in eighths with its percentage, and a car papers / clean inside / clean outside / GPS checklist; reference photo thumbnails, dashboard and extra photos, damage open at the Départ, new damage or « RAS »; a declaration next to the signature.
  4. **General terms** in the chosen language.
  5. **Amendments**, one page each: each change as before → after, the reason, the date, and the amendment signature or « Sans signature du client ».
  6. **Photo annex:** every photo at full size, two per page.
- **Fields:** every field of the current form and every field of the model template (R-02, answered 2026-11-02). [`field-map.md`](../contract-template/field-map.md) lists each one with its source, its stage and its column. Each value is printed in the section of the stage that produced it ([ADR-0009](0009-signatures.md)). The model's own wording (its rules, liability and traffic-violation paragraphs, its Swiss terms) is not copied: page 1 summarises MC Car Riviera's own terms instead, and the two declarations are new wording adapted from the model. The lawyer reviews all three (L-02).
- **Pagination:**
  - Every page is an explicit A4 block.
  - Sections that can grow (photos, terms, amendments) continue on extra pages. Every page, including continuation pages, repeats the header, the footer with « page x/y » and the signature block at the bottom right, in the same place in French and English.
  - Fixed sections never overflow, because free-text fields have maximum lengths ([US-006](../stories/US-006-core-database-schema-and-rls.md)).
  - The general terms are stored already split into pages ([US-041](../stories/US-041-general-terms-per-language.md)).
- **Signature block:** at the bottom right of every page, with the « Signature départ » and « Signature retour » boxes (F-08). Amendment pages carry the amendment's own signature there instead of the departure signature (default for F-08, [ADR-0009](0009-signatures.md)).
- **Photos:** compressed thumbnails on page 3, and every photo at full size in the photo annex (R-01 Q2, answered 2026-11-02). Each full-size photo adds roughly 0.2–0.4 MB ([ADR-0014](0014-file-storage.md) sizes).
- **Staff and company:** the staff member's name is printed as « Agent au départ » and « Agent au retour », like the model's "Pick-up driver" (R-19 Q1, answered 2026-11-02). There is no company signature or stamp, as on both forms (default for R-19 Q2).
- **Company details:** name, address, SIRET, APE code, phone numbers and logo come from one configuration file, filled with details the client has confirmed. Fonts and logo are bundled in the app. The brand palette uses placeholders until the assets arrive (default for R-18).
- **Output:** written to the app cache, uploaded to the `contract-pdfs` bucket with its SHA-256 ([ADR-0014](0014-file-storage.md)), then opened in the iOS share sheet.
- **Regeneration:** any PDF can be regenerated with the same content: the same data, template version and terms version. The new file's bytes and hash can differ, so the archived original stays the reference.
- **Tests:**
  - HTML snapshot tests in CI cover synthetic cases: empty optional fields, maximum-length fields, an additional driver, 30 photos, 5 amendments, French and English.
  - Every template change is also checked as a PDF on a real iPhone.

## Consequences

**Positive**

- No PDF server to run or pay for.
- HTML/CSS makes it easy to follow the model's look.
- One template serves both languages.

**Negative / risks**

- WebKit print CSS has quirks, and repeated footers must be built as explicit page blocks. This is proven in the spike [US-009](../stories/US-009-spike-signature-and-pdf-on-iphone.md) and checked on a real iPhone.
- PDFs with many photos take longer on older phones, so thumbnails are kept small. The photo annex makes the final PDF several megabytes, still within e-mail attachment limits.
- The layout places return values in the Retour section rather than on page 1 as on paper. The client confirms this (F-08).

## Alternatives considered

| Option | Why not chosen |
|---|---|
| Server-side rendering with a headless browser | Needs a separate, always-on service |
| Drawing the PDF with pdf-lib on the phone | Tedious layout and text flow |
| Filling a fixed PDF form | Can't follow the model's presentation, or switch language easily |

## Revisit when

Rendering on the phone proves too slow or unreliable (spike US-009), or the PDF must be produced without a phone.

## Changes

- 2026-10-09: the signature block sits at the bottom right of every page (F-08), and the final PDF always carries the return signature (F-04).
- 2026-11-02: R-02, R-19 Q1 and R-01 Q2 answered. Template v1 keeps every field of both templates, prints the staff name and adds a full-size photo annex. The page layout above is template v1 (`docs/contract-template/`), with specimens.

## Implemented by

- [US-009](../stories/US-009-spike-signature-and-pdf-on-iphone.md): Spike: prove signature capture and PDF generation on a real iPhone
- [US-040](../stories/US-040-contract-pdf-template.md): Contract PDF template in French and English, with the signature block at the bottom right
- [US-041](../stories/US-041-general-terms-per-language.md): Manage the general terms (CGV) per language
- [US-042](../stories/US-042-archive-and-share-pdfs.md): Archive, download and share contract PDFs
- [US-055](../stories/US-055-departure-pdf.md): Generate the departure PDF in French or English
- [US-063](../stories/US-063-reopen-or-regenerate-a-pdf.md): Re-open, re-share or regenerate a contract PDF
- [US-064](../stories/US-064-amendment-pages-in-the-pdf.md): Amendment pages in the PDF
- [US-075](../stories/US-075-final-pdf.md): Generate the final PDF in French or English
