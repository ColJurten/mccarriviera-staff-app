# US-053 · Confirm the departure condition, and record damage found at the Départ

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E5 · Départ | Must | P3 | M | To do |

- **Depends on:** [US-050](US-050-start-a-depart.md) · [US-026](US-026-guided-reference-photo-capture.md)
- **Decisions:** [ADR-0024](../adr/0024-vehicle-condition-four-angles-estimates.md) · [ADR-0014](../adr/0014-file-storage.md)
- **Open points:** R-10 Q5 (see [open questions](../discovery/open-questions.md))

## Story

As a staff member, I want to confirm km, fuel and condition against the reference photos, and record a damage only if something isn't on record, so that the Départ is fast but accurate.

## Acceptance criteria

- [ ] Km out and fuel out are pre-filled and can be adjusted. Fuel uses an eighths gauge from E to F. If km out is lower than the vehicle's last recorded km, a reason is required.
- [ ] The current reference photos and open damages are shown, read-only, with their dates.
- [ ] When the client or staff spot damage that isn't on record, staff record it as a damage (F-25): at least one photo and a comment, from the camera or the photo library (library photos are flagged « importée »). It is saved as an open damage on the vehicle, « constaté au départ » of this contract, listed with the damage already present, never charged to this renter, and shown at later Retours and in maintenance.
- [ ] There are no loose extra photos: a photo at the Départ is the dashboard photo or a damage photo (F-23).
- [ ] The same can be done after the preview, while the Départ waits for the signature ([US-058](US-058-change-a-contract-awaiting-signature.md)).
- [ ] The app offers one dashboard photo showing km and fuel. It is optional (F-10).
- [ ] A checklist from the model template (R-02): car papers on board, clean inside, clean outside, GPS, each Oui / Non and optional ([ADR-0024](../adr/0024-vehicle-condition-four-angles-estimates.md)).
- [ ] An optional free-text comment can be added.
- [ ] The departure condition is saved as references to the reference set and open damages at that moment, including any found at this Départ, so later changes don't alter it.
