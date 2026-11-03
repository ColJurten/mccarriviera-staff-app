# US-055 · Preview and deliver the departure PDF in French or English

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E5 · Départ | Must | P3 | M | To do |

- **Depends on:** [US-044](US-044-sign-in-documenso-from-the-app.md) · [US-040](US-040-contract-pdf-template.md) · [US-042](US-042-archive-and-share-pdfs.md)
- **Decisions:** [ADR-0010](../adr/0010-contract-pdf-generation.md) · [ADR-0011](../adr/0011-localisation.md) · [ADR-0020](../adr/0020-signatures-with-documenso.md)
- **Open points:** — (see [open questions](../discovery/open-questions.md))

## Story

As a staff member, I want the client to see the contract in their language before signing, and to get the signed PDF straight away, so that they know what they sign and leave with their copy.

## Acceptance criteria

- [ ] The preview is rendered by the API in French or English, before the client signs (F-17). The default is the language shown on the recap screen.
- [ ] The sealed PDF shows the client's signature in the « Signature départ » box at the bottom right of every page. The « Signature retour » boxes, the Retour column and the « Décompte final » column are empty.
- [ ] The photo annex shows the departure photos at full size (R-01 Q2).
- [ ] The sealed PDF is archived and the share sheet opens ([US-042](US-042-archive-and-share-pdfs.md)).
- [ ] A copy in the other language can be made later ([US-063](US-063-reopen-or-regenerate-a-pdf.md)).
