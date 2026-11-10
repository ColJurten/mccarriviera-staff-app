# Contract template v2

The rental contract PDF: the model template's layout and fields, plus every field of the current form, rearranged after the client meeting of November 2026. It is the reference design for [US-040](../stories/US-040-contract-pdf-template.md); the API renders the same pages with Chromium, as this prototype does ([ADR-0010](../adr/0010-contract-pdf-generation.md)), and stamps the client's drawing into the signature boxes before sealing the file ([ADR-0023](../adr/0023-signatures-in-the-app-sealed-by-the-api.md)).

First version: 2026-11-02, after the answers to R-02, R-19 Q1 and R-01 Q2. Version 2: 2026-11-10, after the client meeting (F-22, F-23, F-24, F-25, F-28).

## What's here

| File | What it is |
|---|---|
| [`samples/modele-vierge-fr.pdf`](samples/modele-vierge-fr.pdf) | Every page with empty fields. The one to show the client |
| [`samples/specimen-final-fr.pdf`](samples/specimen-final-fr.pdf) | A completed rental: Départ with a damage the client pointed out, an extension agreed by phone, Retour with two new damages (one estimate indicative, one billed). Invented data |
| [`samples/specimen-final-en.pdf`](samples/specimen-final-en.pdf) | The same in English. The terms pages say the approved English text is pending (R-17) |
| [`samples/specimen-final-signature-enregistree-fr.pdf`](samples/specimen-final-signature-enregistree-fr.pdf) | The same Retour, finished the next morning after the client left, signed with the signature recorded at the drop-off, with its authorisation page (F-28) |
| [`samples/specimen-depart-fr.pdf`](samples/specimen-depart-fr.pdf) | What the client receives right after signing the Départ |
| [`field-map.md`](field-map.md) | Every field: page, labels, source template, when it's filled, where it's stored |
| [`template/contract.html.j2`](template/contract.html.j2), [`template/contract.css`](template/contract.css) | The page template (Jinja2 here; US-040 ports it to TypeScript) and its styles |
| [`i18n/fr.json`](i18n/fr.json), [`i18n/en.json`](i18n/en.json) | Labels and fixed texts, with identical keys ([ADR-0011](../adr/0011-localisation.md)) |
| [`config/company.json`](config/company.json) | Company identity, copied from the current form, to be confirmed by the client |
| [`terms/cgv-fr-v1.md`](terms/cgv-fr-v1.md) | The current general terms, typed from the scan, split into pages ([US-041](../stories/US-041-general-terms-per-language.md)) |
| [`samples/specimen.json`](samples/specimen.json) | The invented data behind the specimens |
| [`build.py`](build.py) | Renders the five PDFs |

## Pages

| Page | Content | Based on |
|---|---|---|
| 1 · Contrat de location | Departure and return (places, dates, days, flight or train, intermediary) · renter · additional driver and pick-up agent · vehicle · rates · deductible and deposit · payment method and card (last four digits, expiry, empty CVV) · charges at the Départ next to the final statement · declaration and acceptance text | Model page 1 and the current form's page 1; pricing moved up, services and key terms dropped (F-22) |
| 2 · État du véhicule | Contract summary · Départ and Retour columns: date and time, agent, km, fuel, car papers, cleanliness, GPS · reference photos · Départ PDF: dashboard photo and damage already present · final PDF: **new damage first**, with photos and estimates, or RAS, then the dashboard photos, comments and a pointer to the annex · declaration | Model page 2, plus the current form's fields; photos instead of drawings; new damage first (F-24) |
| Annexe · Dommages déjà présents au départ | Final PDF only, when there is any: each damage with its photo, comment, and where and when it was found | F-24 |
| Autorisation de signature | Final PDF only, when the stored Retour signature was used: the authorisation text, when it was signed and applied, the client's drawing | F-28, ADR-0023 |
| Conditions générales | French terms v1 | Current form page 2; signed, as on model page 3 |
| Annexe photos | Every photo at full size, two per page, with stage, kind, angle, date and time. In the final PDF, new damage comes first | R-01 Q2, F-24 |

Every page has the logo at the top right, the contract number, the signature block at the bottom right (departure and return signatures) and a footer with the company's details and « page n / N ». There are no amendment pages any more (F-22): an extension is recorded in the app and shows in the final statement.

## Changes in version 2 (client meeting, November 2026)

- **F-22: page 1 is the contract summary with the pricing.** The « Conditions financières » page is gone: rates, deductible, deposit, payment method and the charges table now sit on page 1. « Services inclus » and the key-terms box are dropped. The deposit moves into the « Franchise et dépôt de garantie » block. Page 1 has denser rows, and identity-document dates print as 01/09/2006 to fit.
- **F-22: no amendment pages.** The header no longer prints the revision number. Page 1 keeps the values signed at the Départ, and a note says changes agreed during the rental are in the final statement.
- **F-23: four required reference angles** (front, rear, left, right); the others are optional. There are no loose « photos supplémentaires »: photos at a handover are the dashboard photo or the photos of a damage.
- **F-24: new damage first.** In the final PDF, the vehicle-condition page shows each new damage with its photo and its estimate (« indicative » or « facturée »), or « RAS ». The damage already present at the Départ moves to its own annex. Billed estimates add up to the new « Dommages » line of the charges table.
- **F-25: damage found at the Départ** is a damage record, tagged « constaté à ce départ ».
- **F-28: stored Retour signature.** When it is used, the Retour boxes say when it was recorded and applied, and an authorisation page is added.

## Earlier decisions (2026-11-02), still applied

- **R-02: all of the model's fields are kept**, on top of every field of the current form, except « Services inclus », dropped by F-22: title with separate first and last names, e-mail, state or region, ID document issue and expiry dates, licence issue and expiry dates, additional information, pick-up place, flight or train, number of days, deposit, the car papers / clean inside / clean outside / GPS checklist at the Départ and the Retour, and the staff name.
- **R-19 Q1: the staff name is printed**, as « Agent au départ » and « Agent au retour » (the model's "Pick-up driver").
- **R-01 Q2: photos appear as thumbnails on the vehicle-condition page, and at full size in a photo annex.**
- **General terms:** the current French text is typed from the scan as version v1, wording and spelling unchanged, until the lawyer's update (L-02). In 35 places the scan cuts text off at its edge; these are marked […], printed in gold. 24 words are hard to read. Both lists, with suggested readings, are in the notes at the end of [`terms/cgv-fr-v1.md`](terms/cgv-fr-v1.md), which are not printed. The client's own source file would fill the gaps (T-02).
- **F-06:** the number of days, typed by staff, has its own field, as on the model.

The model's own texts (its rules, liability and traffic-violation paragraphs, its Swiss terms) are not copied. The two declarations next to the signature are new wording adapted from the model, and the authorisation text of the stored signature is new: all go to the lawyer (L-01, L-02).

## Still open, and what it changes here

| Question | Effect on the template |
|---|---|
| R-03 Q3, Q4 | Label of the country after the date of birth and the ID number; whether the local address belongs to the client or the rental |
| R-07 Q1 | How the « Dépôt de garantie » relates to « Total prépayé » |
| R-09 Q4 | Whether the contract number replaces the handwritten invoice number |
| R-17 | English terms; until they exist the app refuses English PDFs, and the English fixed texts are drafts |
| R-18 | The logo and brand colours replace the placeholder |
| L-01 | The authorisation text of the stored Retour signature |
| L-02 | The acceptance text says « ci-contre et au verso » and « carte désignée », and the terms say « au recto » (Art. 1, Art. 7): none of these match the PDF's numbered pages. Art. 5 still refers to the green card, abolished in France in April 2024. The two declarations are new wording |
| L-04 | Whether billed damage carries VAT, which decides where the « Dommages » line sits in the charges table |
| Company details | Every value in `config/company.json`, and an e-mail address for the footer |

One reading to confirm (`INTERPRETATION`): « Informations complémentaires » is stored per rental, not per client.

## Rules the production version must keep (US-040)

- Every page is an explicit A4 block. The signature block is in the same place on every page, in French and in English.
- An empty field prints as an empty cell, never as "null" or a dash (meeting notes: « champ vide »).
- Page 1 shows the values signed at the Départ. Changes during the rental appear only in the final statement; return values and final amounts sit in the Retour column and the final statement (ADR-0023).
- Nothing on a page may be cut off. Page 1 is dense: the tests render it with every field at its maximum length. New damage and photos that don't fit on the vehicle-condition page continue on an « État du véhicule (suite) » page. The prototype doesn't do this yet (the specimen fits on one page), but its build prints a warning for any page whose content is larger than the page.
- The footer gives the template version and the version of the general terms printed in that PDF's language.
- Fonts: Inter for the text and Lora for titles, both under the SIL Open Font License, bundled in the API's image.
- The API stamps the client's drawing into the signature boxes, so it needs each box's position on each page. The specimens' drawn signatures and « Signé le … » lines stand for what the API stamps; the signature certificate page it appends is not drawn here (ADR-0023).
- Specimens use invented data only, and the scans never enter the repository.

## Rebuild

```bash
python3 docs/contract-template/build.py          # writes the five PDFs to samples/
python3 docs/contract-template/build.py --html   # also keeps the HTML and images in samples/_html/
```

Needs Python 3 with jinja2, markdown, Pillow and Playwright (with its Chromium), and the Inter and Lora fonts installed. A line starting with `WARNING` means a page cuts content: shorten the text or move a `<!-- page -->` marker in the terms file.
