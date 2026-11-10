# US-075 · Generate the final PDF in French or English

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E7 · Retour | Must | P4 | S | To do |

- **Depends on:** [US-044](US-044-client-signs-in-the-app.md) · [US-040](US-040-contract-pdf-template.md) · [US-042](US-042-archive-and-share-pdfs.md)
- **Decisions:** [ADR-0010](../adr/0010-contract-pdf-generation.md) · [ADR-0023](../adr/0023-signatures-in-the-app-sealed-by-the-api.md) · [ADR-0011](../adr/0011-localisation.md)
- **Open points:** F-08, L-01 (see [open questions](../discovery/open-questions.md))

## Story

As a staff member, I want the final contract with the departure and return information, so that the client and the company have the complete record.

## Acceptance criteria

- [ ] The language is chosen in the preview, before the client signs the Retour (F-17).
- [ ] Page 1 shows the contract as signed at the Départ, with the pricing; the « Décompte final » sits next to the charges at the Départ (F-22).
- [ ] The vehicle-condition page shows the Retour column (return date and time, agent, km in, km driven, km included, extra km, fuel in, the checklist), then **the new damage first**, with thumbnails and estimates (« indicative » or « facturée »), or « RAS » (F-24); then the dashboard photos, the comments and a pointer to the annex.
- [ ] The damage already present at the Départ, including damage found at that Départ, is on its own annex page, with its photos (F-24).
- [ ] The photo annex shows every photo of the Départ and the Retour at full size, new damage first (R-01 Q2, F-24).
- [ ] There are no amendment pages (F-22).
- [ ] When the stored signature was used, the authorisation page is added before the general terms ([US-076](US-076-stored-return-signature.md)).
- [ ] Both signatures sit in the signature block at the bottom right of every page (B-06, F-08):
  - the « Signature départ » boxes show the departure drawing, captured at the Départ (F-17), on every page;
  - the « Signature retour » boxes get the client's return drawing on every page, since the return signature is mandatory (F-04), or the stored one, with « Enregistrée le … · apposée le … » (F-28).
- [ ] The sealed PDF is archived and shared as in US-042, with stage `final`.

## Notes

- The departure image is a copy; the sealed departure PDF remains the proof of the departure signature. The lawyer reviews this (L-01).
