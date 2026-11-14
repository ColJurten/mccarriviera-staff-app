# ADR-0024: Vehicle condition: four required reference angles, damage recorded at the Départ too, estimates on new damage

| Status | Date | Decided by | Based on |
|---|---|---|---|
| **Accepted** | 2026-11-10 (updated 2026-11-14) | Developer, with the client's answers | B-09 · brief (Retour, maintenance) · F-10, F-23, F-24, F-25, F-26, R-02, R-10 Q5 (answered) · defaults for R-10, R-14 |

## Context

- This ADR supersedes [ADR-0008](0008-vehicle-condition-model.md). Most of ADR-0008 is carried over. What changes: the number of required reference angles, what extra photos are for, damage recorded at the Départ, and estimates on new damage.
- **Brief and earlier answers, still in force:**
  - B-09: reuse the vehicle's reference photos at the Départ, and take fresh photos only when needed;
  - brief, Retour step 4: photos only, no diagrams; new damage recorded with photos and a comment, otherwise « RAS »; damage that existed before the rental kept apart from new damage;
  - brief, maintenance: refresh the reference condition only after a damage repair, and never delete history;
  - F-10: interior and dashboard photos are optional;
  - R-02: the car papers / clean inside / clean outside / GPS checklist at each handover.
- **Client meeting, November 2026** (reported by the developer on 2026-11-10):
  - **F-23:** only four photos are mandatory: front, rear, right side and left side. Everything else is optional. Extra photos are only for damage details. The developer confirmed (2026-11-10) that these four make up the vehicle's reference set, still reused at each Départ.
  - **F-24:** the Retour puts new damage forward, or « RAS — rien à signaler » when there is none. Damage already present at the Départ is still mentioned, but in an annex. A new damage can get an estimate. The developer's answers (2026-11-10): staff choose for each estimate whether it is **indicative** or **billed**; when billed damage adds up to more than the contract's deductible, the app **warns but doesn't block**.
  - **F-25:** at a Départ, when the client points out damage the app doesn't know about, it becomes a **new open damage record**, not chargeable to this renter (developer, 2026-11-10).
  - **F-26:** a Départ or a Retour waiting for signature can be changed to add photos and damage before the client signs ([ADR-0023](0023-signatures-in-the-app-sealed-by-the-api.md)).

## Decision

- **Reference set:** each vehicle has one **current reference photo set**, recording who took it, when, and why (initial, after repair, or manual). A new set becomes current and the old sets are kept.
- **Angles** (F-23):
  - **required:** front, rear, left side, right side;
  - **optional:** front-left, rear-left, rear-right, front-right, interior (F-10).
  - There is no dashboard photo in the reference set: reused at every later Départ, it would show an old odometer reading.
  - Reference photos come from the in-app camera only, so each set is consistent and dated (`RECOMMENDED`). On the web, the in-app camera is the in-page camera view ([ADR-0025](0025-web-app-first.md)).
- **Dashboard photo at a handover** (km and fuel): optional at each Départ and Retour (F-10). The app offers it.
- **Handover checklist** (R-02): car papers on board, clean inside, clean outside and GPS, each yes or no, at the Départ and at the Retour. All four are optional.
- **Extra photos belong to a damage** (F-23, `INTERPRETATION` of "only extra photos will be added for damage details"). There is no loose « photo supplémentaire »: a photo taken at a handover is either the dashboard photo or a photo of a damage record.
- **Damage records:**
  - photos (at least one) and a comment;
  - a status: open or repaired;
  - where it was found: the Départ or the Retour of which contract, or added from the vehicle's file;
  - the maintenance where it was repaired (default for R-10);
  - for damage found at a Retour, an optional **estimate** (F-24): an amount in euros and a mode, « indicative » or « facturée ».
- **Départ:**
  - The departure condition is the current reference set plus the damage open at that moment, stored by reference.
  - **Damage found at the Départ** (F-25): when the client or staff spot damage the app doesn't know about, staff record it as a new damage record, « constaté au départ » of this contract. It is printed with the damage already present, appears at later Retours as existing damage, is listed for repair, and is never charged to this renter.
  - This can happen while the Départ is being prepared, or after the preview, while it waits for the signature (F-26): the API then renders a new preview.
- **Retour:**
  - The reference set and the open damage, including any found at this rental's Départ, are shown for comparison.
  - Staff record each new damage (at least one photo and a comment) or « RAS ». Photos are needed only for new damage (brief).
  - **Estimates** (F-24): each new damage can get an amount, marked « indicative » (printed as an estimate, the final cost invoiced after the repair) or « facturée » (billed now).
  - The billed estimates add up to the « Dommages » line of the final statement, filled by the app. This is the only amount the app adds up: the totals stay typed by staff (F-06, [ADR-0006](0006-contract-only-scope.md); `INTERPRETATION`).
  - When the billed damage is higher than the contract's deductible for an at-fault accident, the app warns staff and lets them continue (F-24).
  - Before the client signs, staff can still add photos and damage, or change an estimate (F-26).
- **In the final PDF** (F-24, [ADR-0010](0010-contract-pdf-generation.md)): the vehicle-condition page puts the new damage first, with photos and estimates, or « RAS ». The damage already present at the Départ moves to its own annex page, with its photos. The Départ PDF still shows that damage on the condition page, since that is what the client accepts at the Départ.
- **Withdrawing before the signature** (R-10 Q5, answered 2026-11-14): until the client signs a Départ or a Retour, staff can withdraw a photo or a damage they added during it.
  - It stays stored and in the audit trail, marked « retiré », and is left off the PDF.
  - A withdrawn damage isn't an open damage of the vehicle.
  - After the signature nothing can change.
- **Photo sources** for damage photos:
  - the in-app camera by default;
  - the photo library or a file, since the brief says "take/upload". These are flagged « importée » ([ADR-0014](0014-file-storage.md)).
- **Damage repair:**
  - Finishing a repair maintenance closes the repaired damage.
  - A new reference set, with at least the four required angles, is then required before the vehicle can be rented again.
  - Partial repairs are allowed (default for R-14).
- **Ordinary maintenance** doesn't require new photos (« Reset status ou pas »).
- Nothing is deleted.

## Consequences

**Positive**

- A faster vehicle set-up and repair follow-up: four photos instead of eight.
- New damage is what the final PDF shows first, with what it may cost.
- Damage the client points out at the Départ is on record for this rental and the next ones, and goes to maintenance.

**Negative / risks**

- Four reference angles show less of the car than eight, and the photos can be weeks old. This is mitigated by:
  - the optional angles;
  - damage records with their own photos, including at the Départ;
  - the optional dashboard photo;
  - the client's signature on the Départ, which accepts the vehicle's condition (CGV Art. 3).
- An estimate is staff's figure, not a repair quote. The final statement, which the client signs, says which estimates are billed.
- Billed damage is a line the app adds up, a small exception to "totals typed by staff" (F-06). Its VAT treatment is for the accountant (L-04).

## Alternatives considered

| Option | Why not chosen |
|---|---|
| Keep 8 required angles (ADR-0008) | The client asked for 4 (F-23) |
| 4 fresh photos at every Départ and Retour | Not what the client meant: the reference set stays reused (F-23) |
| Damage found at the Départ as a photo with a comment only | Wouldn't follow the car to the next rentals or to maintenance (F-25) |
| Estimates always billed, or always indicative | Staff choose per damage (F-24) |
| Blocking billed damage above the deductible | Warn only (F-24) |

## Revisit when

A damage dispute shows four reference angles aren't enough evidence, or the accountant's answer on damage and VAT changes how billed damage is shown (L-04).

## Changes

- 2026-11-10: written. Supersedes ADR-0008, with the client meeting's answers (F-23, F-24, F-25, F-26).
- 2026-11-14: R-10 Q5 answered: a photo or a damage can be withdrawn until the signature. On the web, the in-app camera is the in-page camera view ([ADR-0025](0025-web-app-first.md)).

## Implemented by

- [US-006](../stories/US-006-core-database-schema-and-storage.md): Create the core database schema, access rules and storage
- [US-022](../stories/US-022-add-a-vehicle.md): Add a vehicle with its reference photos
- [US-023](../stories/US-023-vehicle-detail.md): Vehicle detail
- [US-026](../stories/US-026-guided-reference-photo-capture.md): Guided reference photo capture
- [US-050](../stories/US-050-start-a-depart.md): Start a Départ by choosing an available vehicle
- [US-053](../stories/US-053-confirm-departure-condition.md): Confirm the departure condition, and record damage found at the Départ
- [US-058](../stories/US-058-change-a-contract-awaiting-signature.md): Change a Départ or a Retour waiting for signature: new photos, damage, values
- [US-072](../stories/US-072-return-inspection.md): Inspect the vehicle: new damage with estimates, or RAS
- [US-073](../stories/US-073-return-pricing-lines.md): Complete the pricing lines at the Retour
- [US-075](../stories/US-075-final-pdf.md): Generate the final PDF in French or English
- [US-080](../stories/US-080-put-a-vehicle-into-maintenance.md): Put a vehicle into maintenance
- [US-081](../stories/US-081-finish-routine-maintenance.md): Finish a routine maintenance
- [US-082](../stories/US-082-finish-a-damage-repair.md): Finish a damage repair and refresh the reference photos
