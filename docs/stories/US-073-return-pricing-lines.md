# US-073 · Complete the pricing lines at the Retour

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E7 · Retour | Must | P4 | S | To do |

- **Depends on:** [US-070](US-070-start-a-retour.md)
- **Decisions:** [ADR-0006](../adr/0006-contract-only-scope.md) · [ADR-0007](../adr/0007-contract-lifecycle-and-audit.md) · [ADR-0024](../adr/0024-vehicle-condition-four-angles-estimates.md)
- **Open points:** L-04 (see [open questions](../discovery/open-questions.md))

## Story

As a staff member, I want to type the final amounts (extra days, extra km, fuel, miscellaneous, totals, balance), so that the final contract shows the complete pricing, as on paper.

## Acceptance criteria

- [ ] The pricing block starts with the values of the current revision. Staff can edit any line, and changed lines are highlighted.
- [ ] Totals, costs and the number of extra days are typed too (F-06). Amounts have 2 decimals. Only « Solde » may be negative (`RECOMMENDED`).
- [ ] The « Dommages » line is filled by the app with the sum of the estimates marked « facturée » ([US-072](US-072-return-inspection.md), F-24), and can't be typed. It is the only line the app adds up.
- [ ] When the billed damage is higher than the contract's deductible for an at-fault accident, the screen warns staff and lets them continue (F-24).
- [ ] Changes agreed during the rental, such as an extension, are reflected here: there are no amendment pages (F-22).
- [ ] These final amounts belong to the return record. The PDF prints them in the « Décompte final » column next to the departure charges on page 1, which otherwise keeps the departure values (F-22).
