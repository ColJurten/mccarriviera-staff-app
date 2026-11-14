# US-058 · Change a Départ or a Retour waiting for signature: new photos, damage, values

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E5 · Départ | Must | P3 | M | To do |

- **Depends on:** [US-044](US-044-client-signs-in-the-app.md) · [US-053](US-053-confirm-departure-condition.md) · [US-072](US-072-return-inspection.md)
- **Decisions:** [ADR-0023](../adr/0023-signatures-in-the-app-sealed-by-the-api.md) · [ADR-0024](../adr/0024-vehicle-condition-four-angles-estimates.md) · [ADR-0007](../adr/0007-contract-lifecycle-and-audit.md)
- **Open points:** — (see [open questions](../discovery/open-questions.md))

## Story

As a staff member, I want to reopen a Départ or a Retour that waits for the client's signature, add the damage or photos the client asks for, and show a new preview, so that the client only signs a document they agree with.

## Acceptance criteria

- [ ] From the preview screen, and from the contract in the Contrats tab, a contract « En attente de signature » (Départ) or a Retour « en attente de signature » can be changed (F-26).
- [ ] At the Départ, staff can:
  - record a damage the client points out, with at least one photo and a comment; it becomes an open damage record « constaté au départ » of this contract, never charged to this renter (F-25, [US-053](US-053-confirm-departure-condition.md));
  - add photos to an existing damage, or a dashboard photo;
  - correct the values they typed.
- [ ] At the Retour, staff can:
  - record a new damage or add photos to one, change its comment or its estimate, or switch between « RAS » and damage ([US-072](US-072-return-inspection.md));
  - correct the return values and the final statement.
- [ ] Every change goes through the API, which renders a new preview with the **same contract number** and makes it the current one. The replaced preview is kept, never signed, and recorded in the audit trail.
- [ ] The preview screen shows that the document changed (« Document mis à jour ») and the client signs only the new one ([US-044](US-044-client-signs-in-the-app.md)).
- [ ] If a stored Retour signature is waiting ([US-076](US-076-stored-return-signature.md)), it stays usable on the changed Retour: it covers the finished Retour, whatever was added.
- [ ] Staff can withdraw a photo or a damage they added to this Départ or Retour, until the client signs (R-10 Q5, answered 2026-11-14). It stays stored and in the audit trail, marked « retiré », and the new preview leaves it out. A withdrawn damage isn't an open damage of the vehicle. After the signature nothing can be withdrawn.
- [ ] Database and API tests cover: a damage added at the Départ after the preview; a new damage and a changed estimate at the Retour; a preview replaced twice, then signed; an attempt to sign a replaced preview (refused).

## Notes

- From the client meeting of November 2026 (F-26): a client who disagrees, or damage that wasn't mentioned, at the Départ as at the Retour.
