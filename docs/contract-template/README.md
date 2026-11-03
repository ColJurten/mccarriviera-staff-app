# Contract template v1

The new rental contract PDF: the model template's layout and fields, plus every field of the current form. It is the reference design for [US-040](../stories/US-040-contract-pdf-template.md); the API renders the same pages with Chromium, as this prototype does ([ADR-0010](../adr/0010-contract-pdf-generation.md)), and Documenso places the client's signature in the signature boxes ([ADR-0020](../adr/0020-signatures-with-documenso.md)).

First version: 2026-11-02, after the answers to R-02, R-19 Q1 and R-01 Q2 (below).

## What's here

| File | What it is |
|---|---|
| [`samples/modele-vierge-fr.pdf`](samples/modele-vierge-fr.pdf) | Every page with empty fields. The one to show the client |
| [`samples/specimen-final-fr.pdf`](samples/specimen-final-fr.pdf) | A completed rental: Départ, one extension agreed by phone (no client signature), Retour with new damage. Invented data |
| [`samples/specimen-final-en.pdf`](samples/specimen-final-en.pdf) | The same in English. The terms pages say the approved English text is pending (R-17) |
| [`samples/specimen-depart-fr.pdf`](samples/specimen-depart-fr.pdf) | What the client receives right after signing the Départ |
| [`field-map.md`](field-map.md) | Every field: page, labels, source template, when it's filled, where it's stored |
| [`template/contract.html.j2`](template/contract.html.j2), [`template/contract.css`](template/contract.css) | The page template (Jinja2 here; US-040 ports it to TypeScript) and its styles |
| [`i18n/fr.json`](i18n/fr.json), [`i18n/en.json`](i18n/en.json) | Labels and fixed texts, with identical keys ([ADR-0011](../adr/0011-localisation.md)) |
| [`config/company.json`](config/company.json) | Company identity, copied from the current form, to be confirmed by the client |
| [`terms/cgv-fr-v1.md`](terms/cgv-fr-v1.md) | The current general terms, typed from the scan, split into pages ([US-041](../stories/US-041-general-terms-per-language.md)) |
| [`samples/specimen.json`](samples/specimen.json) | The invented data behind the specimens |
| [`build.py`](build.py) | Renders the four PDFs |

## Pages

| Page | Content | Based on |
|---|---|---|
| 1 · Contrat de location | Departure and return (places, dates, days, flight or train, intermediary) · renter · additional driver · services included and deposit · vehicle · pick-up agent · key points of the general terms · declaration | Model page 1, plus the current form's fields |
| 2 · Conditions financières | Rates · deductible · payment method and card (last four digits, expiry, empty CVV) · charges at the Départ and the final statement side by side · acceptance text | Current form, page 1 |
| 3 · État du véhicule | Contract summary · Départ and Retour columns: date and time, agent, km, fuel, car papers, cleanliness, GPS · reference photos · dashboard and extra photos · damage present at the Départ · new damage or RAS · declaration | Model page 2, plus the current form's fields; photos instead of drawings |
| 4–5 · Conditions générales | French terms v1 | Current form page 2; signed, as on model page 3 |
| Avenant n° … | One page per amendment: date, revision, agent, reason, each change as before → after | ADR-0007, ADR-0010 |
| Annexe photos | Every photo at full size, two per page, with stage, kind, angle, date and time | R-01 Q2 |

Every page has the logo at the top right, the contract number and revision, the signature block at the bottom right (departure and return signatures; on amendment pages, the amendment's own signature or « Sans signature du client ») and a footer with the company's details and « page n / N ».

## Decisions applied on 2026-11-02

- **R-02: all of the model's fields are kept**, on top of every field of the current form: title with separate first and last names, e-mail, state or region, ID document issue and expiry dates, licence issue and expiry dates, additional information, pick-up place, flight or train, number of days, services included, deposit, the car papers / clean inside / clean outside / GPS checklist at the Départ and the Retour, and the staff name.
- **R-19 Q1: the staff name is printed**, as « Agent au départ » and « Agent au retour » (the model's "Pick-up driver").
- **R-01 Q2: photos appear as thumbnails on page 3, and at full size in a photo annex.**
- **General terms:** the current French text is typed from the scan as version v1, wording and spelling unchanged, until the lawyer's update (L-02). In 35 places the scan cuts text off at its edge; these are marked […], printed in gold. 24 words are hard to read. Both lists, with suggested readings, are in the notes at the end of [`terms/cgv-fr-v1.md`](terms/cgv-fr-v1.md), which are not printed. The client's own source file would fill the gaps (T-02).
- **F-06:** the number of days, typed by staff, now has its own field, as on the model.

The model's own texts (its rules, liability and traffic-violation paragraphs, its Swiss terms) are not copied. Page 1 instead summarises MC Car Riviera's own terms, and the two declarations next to the signature are new wording adapted from the model: all three go to the lawyer (L-02).

## Still open, and what it changes here

| Question | Effect on the template |
|---|---|
| R-03 Q3, Q4 | Label of the country after the date of birth and the ID number; whether the local address belongs to the client or the rental |
| R-07 Q1 | How the new « Dépôt de garantie » relates to « Total prépayé » |
| R-09 Q4 | Whether the contract number replaces the handwritten invoice number |
| R-17 | English terms; until they exist the app refuses English PDFs, and the English fixed texts are drafts |
| R-18 | The logo and brand colours replace the placeholder |
| L-02 | The acceptance text says « ci-contre et au verso » and « carte désignée », and the terms say « au recto » (Art. 1, Art. 7): none of these match the PDF's numbered pages. Art. 5 still refers to the green card, abolished in France in April 2024. The key-terms summary and the two declarations are new wording |
| Company details | Every value in `config/company.json`, and an e-mail address for the footer |

Two readings to confirm (`INTERPRETATION`): « Informations complémentaires » is stored per rental, not per client, and « Services inclus » is typed by staff for each contract.

## Rules the production version must keep (US-040)

- Every page is an explicit A4 block. The signature block is in the same place on every page, in French and in English.
- An empty field prints as an empty cell, never as "null" or a dash (meeting notes: « champ vide »).
- Page 1 and page 2 show the values signed at the Départ. Later changes appear on amendment pages; return values and final amounts sit in the Retour column and the final statement (ADR-0009).
- Nothing on a page may be cut off. Photos that don't fit on page 3 continue on an « État du véhicule (suite) » page. The prototype doesn't do this yet (the specimen fits on one page), but its build prints a warning for any page whose content is larger than the page.
- The footer gives the template version and the version of the general terms printed in that PDF's language.
- Fonts: Inter for the text and Lora for titles, both under the SIL Open Font License, bundled in the API's image.
- The signature boxes become Documenso signature fields: the API needs each box's position on each page. The specimens' drawn signatures and « Signé le … » lines stand for what Documenso adds (2026-11-03).
- Specimens use invented data only, and the scans never enter the repository.

## Rebuild

```bash
python3 docs/contract-template/build.py          # writes the four PDFs to samples/
python3 docs/contract-template/build.py --html   # also keeps the HTML and images in samples/_html/
```

Needs Python 3 with jinja2, markdown, Pillow and Playwright (with its Chromium), and the Inter and Lora fonts installed. A line starting with `WARNING` means a page cuts content: shorten the text or move a `<!-- page -->` marker in the terms file.
