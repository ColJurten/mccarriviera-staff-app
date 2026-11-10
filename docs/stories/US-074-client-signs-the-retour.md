# US-074 · Client signs the Retour and the rental is closed

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E7 · Retour | Must | P4 | M | To do |

- **Depends on:** [US-071](US-071-return-km-and-fuel.md) · [US-072](US-072-return-inspection.md) · [US-073](US-073-return-pricing-lines.md) · [US-007](US-007-audit-trail-and-immutability.md) · [US-044](US-044-client-signs-in-the-app.md)
- **Decisions:** [ADR-0023](../adr/0023-signatures-in-the-app-sealed-by-the-api.md) · [ADR-0007](../adr/0007-contract-lifecycle-and-audit.md) · [ADR-0005](../adr/0005-online-only.md)
- **Open points:** — (see [open questions](../discovery/open-questions.md))

## Story

As a staff member, I want the client to sign the return and the rental to be closed, so that the vehicle is free for the next client.

## Acceptance criteria

- [ ] A recap shows km and fuel at return, km driven, new damage or RAS, and the final amounts.
- [ ] The preview shows the final PDF in the chosen language, switchable until the client signs ([US-044](US-044-client-signs-in-the-app.md), F-17).
- [ ] The client signs once on the pad in the app, and the API stamps the drawing into the « Signature retour » box of every page. The signature is mandatory: the Retour can't be completed without it (F-04). If the client isn't there, the Retour stays « en attente de signature », and it is finished when they sign (US-070). How the company reaches the client is outside the app (B-08).
- [ ] When the stored signature is switched on and the client recorded it at the drop-off, staff can apply it instead ([US-076](US-076-stored-return-signature.md), F-28).
- [ ] If the client disagrees or points out damage, staff change the Retour before the signature and show a new preview ([US-058](US-058-change-a-contract-awaiting-signature.md)).
- [ ] When the sealed final PDF is stored, one SQL function stores everything in a single transaction:
  - the return inspection and the final amounts;
  - the signature evidence record;
  - the vehicle's new current km and fuel.

  It then closes the contract, sets the vehicle to `available` and writes the audit events.
- [ ] Retries are idempotent, and a closed contract can't be closed again.

## Notes

- Sending the car to maintenance right after a Retour with new damage is added in [US-080](US-080-put-a-vehicle-into-maintenance.md).
