# US-065 · Contrats: find a contract and open it

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E6 · Active rentals | Must | P3 | M | To do |

- **Depends on:** [US-050](US-050-start-a-depart.md) · [US-044](US-044-client-signs-in-the-app.md)
- **Decisions:** [ADR-0007](../adr/0007-contract-lifecycle-and-audit.md) · [ADR-0023](../adr/0023-signatures-in-the-app-sealed-by-the-api.md) · [ADR-0025](../adr/0025-web-app-first.md)
- **Open points:** — (see [open questions](../discovery/open-questions.md))

## Story

As a staff member, I want one place that lists every contract, with what waits for a signature first, so that I can resume, sign or look up any rental.

## Acceptance criteria

- [ ] « Contrats » is one of the four main destinations: Accueil, Véhicules, Clients, Contrats ([design](../design/README.md)). Its counter shows how many contracts are under « À signer ».
- [ ] The list shows, newest first, for each contract: its number `MCR-YYYY-NNNN` (« Brouillon » while it has none), the vehicle (model and plate), the renter, a date line and a status badge.
- [ ] Filters, each with its count: Tous · À signer · Signés · Clôturés · Annulés.
  - « À signer » groups what waits for the client: a draft Départ (« Brouillon »), a Départ « En attente de signature », a Retour in progress (« Retour à signer »), and a Retour with a stored signature (« Signature enregistrée · à finaliser », [US-076](US-076-stored-return-signature.md)).
  - « Signés » are the active rentals, « Clôturés » the closed ones, and « Annulés » the void ones, including « Annulé avant signature ».
- [ ] Search matches the contract number, the renter's name and the plate.
- [ ] Opening a contract shows: a status banner; the number; the vehicle and the client, each linking to its record; the departure and the planned return; the key amounts; the revision history (who, when, why: [US-061](US-061-extend-or-amend-a-rental.md)); and its archived PDFs, which can be opened and shared ([US-042](US-042-archive-and-share-pdfs.md), [US-063](US-063-reopen-or-regenerate-a-pdf.md)).
- [ ] The actions depend on the state:
  - draft: resume it or discard it ([US-056](US-056-resume-or-discard-a-draft.md));
  - awaiting signature: « Reprendre la signature », « Modifier » ([US-058](US-058-change-a-contract-awaiting-signature.md)), « Annuler avant signature » ([US-044](US-044-client-signs-in-the-app.md));
  - active: « Retour » ([US-070](US-070-start-a-retour.md)), « Prolonger / modifier » ([US-061](US-061-extend-or-amend-a-rental.md)), void ([US-062](US-062-void-a-contract.md));
  - Retour in progress: resume it, change it ([US-058](US-058-change-a-contract-awaiting-signature.md)), « Apposer la signature enregistrée » when one is waiting ([US-076](US-076-stored-return-signature.md)), or sign in person ([US-074](US-074-client-signs-the-retour.md));
  - closed or void: read only.
- [ ] A contract has one number for its whole life. The Retour isn't a separately numbered document: its PDF is the contract's final PDF (R-09).
- [ ] On wide screens the list and the detail sit side by side; on narrow screens the detail is its own screen ([ADR-0025](../adr/0025-web-app-first.md)).
- [ ] The API lists contracts with the filter, the search and pagination, and returns one contract with its revisions and documents. API tests cover each filter and the search.

## Notes

- From the review of 2026-11-14: US-058, US-076 and ADR-0023 referred to a « Contrats » tab that no story specified. The design has it (« Onglet Contrats », « Web · Contrats »).
- The design's numbers (CT-…, PV-…) and its « Envoyer le lien de signature » button are not followed (R-09, F-30).
- Each action is delivered by its own story. This story delivers the list, the detail and the entry points to the actions that exist by then.
