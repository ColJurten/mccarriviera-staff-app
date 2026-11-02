# US-075 · Generate the final PDF in French or English

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E7 · Retour | Must | P4 | S | To do |

- **Depends on:** [US-074](US-074-client-signs-the-retour.md) · [US-064](US-064-amendment-pages-in-the-pdf.md) · [US-040](US-040-contract-pdf-template.md) · [US-042](US-042-archive-and-share-pdfs.md)
- **Decisions:** [ADR-0010](../adr/0010-contract-pdf-generation.md) · [ADR-0009](../adr/0009-signatures.md) · [ADR-0011](../adr/0011-localisation.md)
- **Open points:** F-08 (see [open questions](../discovery/open-questions.md))

## Story

As a staff member, I want the final contract with the departure and return information, so that the client and the company have the complete record.

## Acceptance criteria

- [ ] Staff choose French or English (brief, Retour step 6).
- [ ] Page 1 shows the contract as signed at the Départ (default for F-08).
- [ ] The Retour column shows: return date and time, agent, km in, km driven, km included, extra km, fuel in, the checklist, new damage with thumbnails or « RAS », the dashboard photo and comments. The « Décompte final » sits next to the charges at the Départ, on page 2.
- [ ] The photo annex shows every photo of the Départ and the Retour at full size (R-01 Q2).
- [ ] Every amendment is on its own page.
- [ ] Both signatures sit in the signature block at the bottom right of every page (B-06, F-08). The departure signature is on every page except amendment pages. The return signature is on every page, since it is mandatory (F-04).
- [ ] The PDF is archived and shared as in US-042, with stage `final`.
