# US-040 · Contract PDF template in French and English, with the signature block at the bottom right

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E4 · Contract document | Must | P2 | L | To do |

- **Depends on:** [US-009](US-009-spike-signature-and-pdf-on-iphone.md) · [US-041](US-041-general-terms-per-language.md)
- **Decisions:** [ADR-0010](../adr/0010-contract-pdf-generation.md) · [ADR-0009](../adr/0009-signatures.md) · [ADR-0011](../adr/0011-localisation.md) · [ADR-0006](../adr/0006-contract-only-scope.md)
- **Open points:** R-01, R-18, R-19, F-08, L-02 (see [open questions](../discovery/open-questions.md))

## Story

As the company, I want a contract that looks like the model template and holds every field of both our current contract and the model, in French or English, so that the PDF replaces the paper form.

## Acceptance criteria

- [ ] HTML/CSS templates are rendered to an A4 PDF with expo-print. Each generated PDF records its template version.
- [ ] The pages follow template v1 ([`docs/contract-template/`](../contract-template/README.md), [ADR-0010](../adr/0010-contract-pdf-generation.md); default for the rest of R-01 and F-08):
  1. Contrat de location, as signed at the Départ;
  2. Conditions financières: rates, deductible, payment, the charges at the Départ and the « Décompte final »;
  3. État du véhicule: the Départ and Retour columns, with photos;
  4. general terms;
  5. one page per amendment;
  6. a photo annex.
- [ ] Pages are explicit A4 blocks. Sections that can grow (photos, terms, amendments) continue on extra pages. Every page repeats the header, the footer and the signature block, at the same position in French and English (B-06, B-07).
- [ ] The signature block sits at the bottom right of every page, with the « Signature départ » and « Signature retour » boxes (F-08). Amendment pages carry the amendment's own signature there instead of the departure signature (default for F-08).
- [ ] The card fields are printed as on the current form: the imprint area shows the card brand and the last four digits, then the expiry date if entered, and an empty CVV box (F-09).
- [ ] Every field of the current form and of the model template is printed, as listed in [`field-map.md`](../contract-template/field-map.md) (R-02, answered 2026-11-02). The staff member's name is printed as « Agent au départ » and « Agent au retour » (R-19 Q1, answered 2026-11-02).
- [ ] The company's details (name, address, SIRET, APE code, phone numbers, logo) come from one configuration file, filled with details the client has confirmed are current.
- [ ] Empty optional fields show as blank cells, never as « null » or « undefined » (« Champ vide ✓ »).
- [ ] Every label comes from the `fr` and `en` catalogues. Switching language changes labels, fixed sentences, date and number formats and the terms, never the data.
- [ ] Page 3 shows compressed thumbnails, and a photo annex shows every photo at full size, two per page (R-01 Q2, answered 2026-11-02). A contract with 9 reference photos and 4 damage photos stays under 8 MB.
- [ ] HTML snapshot tests in CI cover synthetic cases: empty optional fields, maximum-length fields, an additional driver, 30 photos, 5 amendments, French and English. A test fails when any page's content is larger than the page, since a fixed A4 block would cut it without notice. Each template change is also checked as a PDF on a real iPhone.
- [ ] The style follows the model, as in template v1: full-width label/value tables, shaded label cells, logo at the top right, gold/black palette (placeholders until the brand assets arrive: default for R-18).

## Notes

- The title stays « CONTRAT / FACTURE LOCATION » unless the accountant says otherwise (L-04, ADR-0006).
- Template v1 (2026-11-02) is the reference: HTML/CSS, catalogues, field map and specimen PDFs in `docs/contract-template/`. This story ports it to the app and adds what the prototype lacks, such as continuation pages when photos overflow page 3.
