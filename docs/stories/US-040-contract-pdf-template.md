# US-040 · Contract PDF template in French and English, with the signature block at the bottom right

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E4 · Contract document | Must | P2 | L | To do |

- **Depends on:** [US-009](US-009-spike-signature-and-pdf-on-iphone.md) · [US-041](US-041-general-terms-per-language.md) · [US-004](US-004-api-server-and-environments.md)
- **Decisions:** [ADR-0010](../adr/0010-contract-pdf-generation.md) · [ADR-0023](../adr/0023-signatures-in-the-app-sealed-by-the-api.md) · [ADR-0011](../adr/0011-localisation.md) · [ADR-0006](../adr/0006-contract-only-scope.md)
- **Open points:** R-18, R-19, L-02, L-04 (see [open questions](../discovery/open-questions.md))

## Story

As the company, I want a contract that looks like the model template and holds every field of both our current contract and the model, in French or English, so that the PDF replaces the paper form.

## Acceptance criteria

- [ ] The template is TypeScript code in `packages/shared`, rendered by the API with headless Chromium (Playwright) into A4 PDFs (F-13, answered 2026-11-03). Each generated PDF records its template version.
- [ ] The pages follow template v2 ([`docs/contract-template/`](../contract-template/README.md), [ADR-0010](../adr/0010-contract-pdf-generation.md); F-22, F-24):
  1. Contrat de location, as signed at the Départ, with the pricing: rates, deductible and deposit, payment, the charges at the Départ and the « Décompte final »;
  2. État du véhicule: the Départ and Retour columns, with photos; in the final PDF, the new damage first with its estimates, or « RAS »;
  3. in the final PDF, an annex of the damage already present at the Départ, when there is any;
  4. in the final PDF, the authorisation page when the stored Retour signature was used (F-28);
  5. general terms;
  6. a photo annex, new damage first in the final PDF.
- [ ] There are no amendment pages, no « Services inclus » and no key-terms box (F-22).
- [ ] Pages are explicit A4 blocks. Sections that can grow (photos, damage, terms) continue on extra pages. Every page repeats the header, the footer and the signature block, at the same position in French and English (B-06, B-07).
- [ ] The signature block sits at the bottom right of every page, with the « Signature départ » and « Signature retour » boxes (F-08). The template gives the API the position of each box on each page, where it stamps the client's drawing ([ADR-0023](../adr/0023-signatures-in-the-app-sealed-by-the-api.md)).
- [ ] The card fields are printed as on the current form: the imprint area shows the card brand and the last four digits, then the expiry date if entered, and an empty CVV box (F-09).
- [ ] Every field of the current form and of the model template is printed, as listed in [`field-map.md`](../contract-template/field-map.md) (R-02, answered 2026-11-02). The staff member's name is printed as « Agent au départ » and « Agent au retour » (R-19 Q1, answered 2026-11-02).
- [ ] The company's details (name, address, SIRET, APE code, phone numbers, logo) come from one configuration file, filled with details the client has confirmed are current.
- [ ] Empty optional fields show as blank cells, never as « null » or « undefined » (« Champ vide ✓ »).
- [ ] Every label comes from the `fr` and `en` catalogues. Switching language changes labels, fixed sentences, date and number formats and the terms, never the data.
- [ ] The vehicle-condition page shows compressed thumbnails, and a photo annex shows every photo at full size, two per page (R-01 Q2, answered 2026-11-02). A contract with 9 reference photos and 4 damage photos stays under 8 MB.
- [ ] PDF tests in CI render synthetic cases with Chromium: empty optional fields, every page-1 field at its maximum length, an additional driver, 30 photos, 10 damage records with estimates, « RAS », a stored signature, French and English. A test fails when any page's content is larger than the page, since a fixed A4 block would cut it without notice. Each template change is also opened on a real iPhone.
- [ ] The style follows the model, as in template v2: full-width label/value tables, shaded label cells, logo at the top right, gold/black palette (placeholders until the brand assets arrive: default for R-18).

## Notes

- The title stays « CONTRAT / FACTURE LOCATION » unless the accountant says otherwise (L-04, ADR-0006).
- Template v2 (2026-11-10) is the reference: HTML/CSS, catalogues, field map and specimen PDFs in `docs/contract-template/`. This story ports it to TypeScript in the API and adds what the prototype lacks, such as continuation pages when photos or damage overflow the vehicle-condition page.
