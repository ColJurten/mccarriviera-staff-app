# US-056 · Resume or discard a draft Départ

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E5 · Départ | Should | P3 | S | To do |

- **Depends on:** [US-050](US-050-start-a-depart.md)
- **Decisions:** [ADR-0007](../adr/0007-contract-lifecycle-and-audit.md) · [ADR-0023](../adr/0023-signatures-in-the-app-sealed-by-the-api.md)
- **Open points:** R-12 (see [open questions](../discovery/open-questions.md))

## Story

As a staff member, I want to resume an interrupted Départ or discard it, so that an interruption doesn't block the vehicle or leave junk behind.

## Acceptance criteria

- [ ] Drafts are shown on the vehicle (« Départ en cours de saisie ») and on Home.
- [ ] Resuming a draft restores every value entered.
- [ ] Discarding a draft deletes it (unsigned data only) and is recorded in the audit trail (default for R-12). Only a draft without a contract number can be discarded. Once the preview has reserved a number, the contract can only be cancelled and kept as « Annulé avant signature » (F-18, [US-044](US-044-client-signs-in-the-app.md)). Changing it before the signature is [US-058](US-058-change-a-contract-awaiting-signature.md).
- [ ] A draft never changes the vehicle's status. Drafts older than 7 days are flagged.
