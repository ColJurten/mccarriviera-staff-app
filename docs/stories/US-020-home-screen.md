# US-020 · Home screen: Départ, Retour and the fleet

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E2 · Home and vehicles | Must | P1 | M | To do |

- **Depends on:** [US-010](US-010-sign-in-and-sign-out.md) · [US-006](US-006-core-database-schema-and-storage.md)
- **Decisions:** [ADR-0005](../adr/0005-online-only.md) · [ADR-0025](../adr/0025-web-app-first.md)
- **Open points:** N-03 (see [open questions](../discovery/open-questions.md))

## Story

As a staff member, I want the two main actions at the top and the fleet with its status below, so that I can start a handover or check a car in one tap.

## Acceptance criteria

- [ ] Home shows two large buttons at the top, « Départ » and « Retour » (meeting wireframe).
- [ ] Below them, a vehicle list shows for each vehicle a thumbnail (first reference photo), the plate, the make and model, and a status badge: « Disponible », « En cours » or « Maintenance ».
- [ ] For a vehicle that is out (« En cours »), the row also shows the renter's name and the planned return date. Archived vehicles are hidden by default.
- [ ] A « + » button opens a menu with « Nouveau véhicule » and « Nouveau client » (brief).
- [ ] Home is the first of the four main destinations: Accueil, Véhicules, Clients, Contrats ([design](../design/README.md)). Clients have their own destination ([US-030](US-030-find-and-select-a-client.md)) and so have contracts ([US-065](US-065-contrats-list-and-contract-detail.md)): Home doesn't switch its list to clients.
- [ ] On wide screens the fleet is a table: vehicle, plate, km, status and, for a rented vehicle, the planned return.
- [ ] The data refreshes when the app or the browser tab comes back to the foreground, and on request: pull-to-refresh on a phone, a refresh control on wide screens. Without a connection, a banner says the app needs one, and actions that change data are disabled ([ADR-0005](../adr/0005-online-only.md)).
- [ ] Tapping a vehicle opens its detail ([US-023](US-023-vehicle-detail.md)).
