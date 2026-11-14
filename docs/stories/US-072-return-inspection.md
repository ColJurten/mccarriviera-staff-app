# US-072 · Inspect the vehicle: new damage with estimates, or RAS

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E7 · Retour | Must | P4 | M | To do |

- **Depends on:** [US-070](US-070-start-a-retour.md) · [US-026](US-026-guided-reference-photo-capture.md)
- **Decisions:** [ADR-0024](../adr/0024-vehicle-condition-four-angles-estimates.md) · [ADR-0014](../adr/0014-file-storage.md)
- **Open points:** R-10 (Q1 to Q3), L-04 (see [open questions](../discovery/open-questions.md))

## Story

As a staff member, I want to record any new damage with photos and a comment, or confirm nothing is new, so that new damage stays clearly separate from damage that existed before.

## Acceptance criteria

- [ ] The screen shows the reference photos and the damages open at departure, including any found at this rental's Départ, next to the camera, for comparison.
- [ ] « RAS — Rien à signaler » takes one tap. It can't be combined with new damage entries.
- [ ] « Ajouter un dégât » requires at least one photo and a short comment (default for R-10). Photos come from the camera or, as the brief allows ("take/upload"), the photo library. Library photos are flagged « importée ». Several damages can be added.
- [ ] New damages are saved as open damages on the vehicle, linked to this return. Damages that already existed are not duplicated.
- [ ] Each new damage can get an **estimate** (F-24): an amount in euros, and a mode staff choose, « indicative » (printed as an estimate, the final cost invoiced after the repair) or « facturée » (billed in the final statement). It is optional.
- [ ] Before the client signs, staff can add damage or photos, correct a comment or an estimate, and withdraw a damage or a photo added during this Retour ([US-058](US-058-change-a-contract-awaiting-signature.md); R-10 Q5, answered 2026-11-14). A withdrawn entry stays stored and in the audit trail, marked « retiré », and is left off the PDF. When every new damage is withdrawn, « RAS » can be chosen.
- [ ] Either RAS or at least one new damage is required to continue.
- [ ] The app offers one dashboard photo showing km and fuel. It is optional (F-10).
- [ ] The same checklist as at the Départ: car papers, clean inside, clean outside, GPS, each Oui / Non and optional (R-02).
- [ ] A general return comment is optional.
