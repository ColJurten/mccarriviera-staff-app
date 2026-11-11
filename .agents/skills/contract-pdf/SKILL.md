---
name: contract-pdf
description: Use when working on the rental contract PDF: its template, labels, fields, pagination, signature boxes, photos or specimens (docs/contract-template, and its TypeScript port in the API).
---

# Contract PDF

The source of truth is [ADR-0010](../../../docs/adr/0010-contract-pdf-generation.md),
[ADR-0011](../../../docs/adr/0011-localisation.md),
[ADR-0023](../../../docs/adr/0023-signatures-in-the-app-sealed-by-the-api.md),
[US-040](../../../docs/stories/US-040-contract-pdf-template.md) and the
reference design in [docs/contract-template/](../../../docs/contract-template/README.md)
(template v2), with its [field map](../../../docs/contract-template/field-map.md).
This skill is a checklist; when it disagrees with them, they win: say so in the PR.

## Pages, in order (template v2)

1. **Contrat de location**, as signed at the Départ, with the pricing: places
   and dates, renter, additional driver and pick-up agent, vehicle, rates,
   deductible and deposit, payment, the charges at the Départ next to the
   « Décompte final », the declaration and the acceptance text.
2. **État du véhicule**: Départ and Retour columns, reference photos. In the
   final PDF, **the new damage first** with photos and estimates, or « RAS ».
3. Final PDF only, when there is any: **annex of the damage already present** at
   the Départ.
4. Final PDF only, when the stored Retour signature was used: the
   **authorisation page**.
5. General terms in the chosen language.
6. Photo annex, two photos per page; new damage first in the final PDF.

Never: amendment pages, « Services inclus », a key-terms box (F-22).

## Rules

- Every page is an explicit A4 block with the header, the footer
  (« page n / N », template and terms versions) and the **signature block at the
  bottom right, in the same place in French and English**. The template exports
  each box's position on each page: the API stamps the client's drawing there
  and seals the file. The appended signature certificate page isn't counted in
  « page n / N ».
- Nothing is ever cut off. Page 1 is dense: test it with every field at its
  maximum length. Sections that grow (photos, damage, terms) continue on
  extra pages.
- An empty field prints an empty cell, never `null`, `undefined` or a dash.
- Labels and fixed texts come from the catalogues `i18n/fr.json` and
  `i18n/en.json`, with **identical keys**; free text typed by staff is printed
  as typed. English PDFs are refused until approved English terms exist (R-17).
- Company details come from the configuration file, never hard-coded.
- Texts the lawyer must review (declarations, acceptance, damage-annex
  introduction, stored-signature authorisation) change only with a story that
  says so (L-01, L-02).

## Working on the reference design

```sh
python3 docs/contract-template/build.py          # rebuilds the five specimen PDFs
python3 docs/contract-template/build.py --html   # also keeps the HTML in samples/_html/ (don't commit it)
```

- The build warns when a page's content is larger than the page: fix every
  warning.
- `samples/specimen.json` holds invented data only. Never data from the scanned
  contracts.
- A new or moved field also updates `field-map.md`, and the README's page table
  when a page changes.

## Tests in the API (US-040)

- CI renders synthetic cases with Chromium: empty optional fields, page 1 at
  maximum lengths, an additional driver, 30 photos, 10 damage records with
  estimates, « RAS », a stored signature, French and English. A test fails when a
  page overflows.
- Every template change is also opened on the test iPhone, in the preview and
  through the share sheet.
