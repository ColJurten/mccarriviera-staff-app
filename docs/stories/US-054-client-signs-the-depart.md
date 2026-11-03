# US-054 · Client signs the Départ

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E5 · Départ | Must | P3 | M | To do |

- **Depends on:** [US-051](US-051-choose-renter-and-additional-driver.md) · [US-052](US-052-fill-in-rental-details.md) · [US-053](US-053-confirm-departure-condition.md) · [US-057](US-057-sign-departure-server-function.md) · [US-044](US-044-sign-in-documenso-from-the-app.md)
- **Decisions:** [ADR-0020](../adr/0020-signatures-with-documenso.md) · [ADR-0005](../adr/0005-online-only.md)
- **Open points:** L-01 (see [open questions](../discovery/open-questions.md))

## Story

As a staff member, I want the client to sign once on my phone, so that the contract is concluded and the vehicle becomes rented in one step.

## Acceptance criteria

- [ ] A recap screen shows the key terms: vehicle, renter, dates, km included, deductible, typed amounts, km and fuel out.
- [ ] Next, the preview shows the departure PDF in the language chosen there (F-17). Staff can switch between French and English until the client signs ([US-044](US-044-sign-in-documenso-from-the-app.md)).
- [ ] The client signs once in Documenso, and the signature fills the « Signature départ » box of every page (F-17).
- [ ] The contract becomes active, and the vehicle rented, only once the sealed PDF is stored and the signing transaction has succeeded ([US-057](US-057-sign-departure-server-function.md)).
- [ ] If another Départ took the vehicle in the meantime, the screen explains it and offers to go back. Nothing is stored as signed.
- [ ] If the network drops, the app checks the status again when it is back. The idempotency of the webhook and of the transaction prevents a second contract.
- [ ] When signing succeeds, the flow moves on to sharing the sealed PDF ([US-055](US-055-departure-pdf.md)).

## Notes

- The signature is a simple electronic signature with an audit trail, in a sealed PDF ([ADR-0020](../adr/0020-signatures-with-documenso.md)). The lawyer confirms whether that is enough (L-01).
