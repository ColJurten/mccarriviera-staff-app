# US-006 · Create the core database schema, access rules and storage

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E0 · Foundations | Must | P0 | L | To do |

- **Depends on:** [US-004](US-004-api-server-and-environments.md)
- **Decisions:** [ADR-0019](../adr/0019-backend-own-api-postgres-s3.md) · [ADR-0007](../adr/0007-contract-lifecycle-and-audit.md) · [ADR-0008](../adr/0008-vehicle-condition-model.md) · [ADR-0011](../adr/0011-localisation.md) · [ADR-0012](../adr/0012-authentication-and-authorisation.md) · [ADR-0014](../adr/0014-file-storage.md)
- **Open points:** R-03, R-09, R-13, R-14 (see [open questions](../discovery/open-questions.md))

## Story

As the developer, I want the tables, constraints, access rules and storage buckets for the whole MVP, so that every feature builds on one consistent, protected data model.

## Acceptance criteria

- [ ] Migrations create the tables listed in the notes. Every table has UUID primary keys, `created_at`/`created_by` and English snake_case names.
- [ ] The fields cover every field of the current contract and of the model template (R-02, answered 2026-11-02), as listed in [`contract-template/field-map.md`](../contract-template/field-map.md). For the card, only the last four digits (exactly 4 digits, checked by the database) and the expiry date (MM/YY) are stored. There is no column for a full card number or a CVV (F-09, [ADR-0006](../adr/0006-contract-only-scope.md)).
- [ ] Storage is language-neutral: enumerations as codes, fuel as an integer from 0 to 8 (eighths), amounts as `numeric(10,2)`, times as `timestamptz` ([ADR-0011](../adr/0011-localisation.md)).
- [ ] Free-text fields have maximum lengths, so the contract pages never overflow ([ADR-0010](../adr/0010-contract-pdf-generation.md)). For example, 80 characters for names and address lines, and 500 for comments.
- [ ] A partial unique index allows at most one `active` contract per vehicle. Check constraints keep km ≥ 0 and fuel between 0 and 8.
- [ ] The API connects with its own database role. Row-level security isn't used, since the API is the only client and checks every request ([ADR-0012](../adr/0012-authentication-and-authorisation.md)).
- [ ] Status columns (`contracts.status`, `vehicles.status`, `damages.status`) can't be updated by the API's database role (column-level grants). They change only through SQL functions called by the API ([ADR-0007](../adr/0007-contract-lifecycle-and-audit.md)).
- [ ] These tables accept INSERT only: signed revisions, completed inspections, `signatures`, `condition_baselines`, `photos`, `contract_documents`, `audit_events`. Unsigned draft revisions can be updated. Damage descriptions and photos can't be changed; only the repair fields change, through the maintenance function.
- [ ] Private buckets exist in Scaleway Object Storage (F-11, answered 2026-11-03): `condition-photos`, `client-documents`, `signatures`, `contract-pdfs`, plus `documenso` for Documenso. The API's storage key can write and read but not delete in `condition-photos`, `signatures` and `contract-pdfs`; it can also delete in `client-documents`. No bucket is public. Files are reached only through presigned links of 5 minutes or less, issued by the API after its checks ([ADR-0014](../adr/0014-file-storage.md)).
- [ ] Generated PDFs record their stage as `departure`, `amendment` or `final`.
- [ ] A seed script loads synthetic vehicles and clients only. No real data.
- [ ] Database tests (migrations applied with dbmate to a throwaway Postgres) prove that:
  - a second active contract on the same vehicle is rejected;
  - append-only tables reject UPDATE and DELETE;
  - the API's role can't change a status column.

  API tests prove that requests without an active staff session get nothing, and that no route gives a link to delete or overwrite a file in the evidence buckets.
- [ ] The class diagrams in `docs/architecture/` are kept in step with the migrations.

## Notes

- Tables (working names): `staff_profiles`, `vehicles`, `condition_baselines`, `photos`, `damages`, `maintenance_records`, `clients`, `client_documents`, `contracts`, `contract_revisions`, `contract_drivers`, `inspections` (stage = departure | return), `signatures`, `contract_documents` (generated PDFs), `terms_versions`, `audit_events`, `contract_number_counters`.
- Vehicle statuses: `available`, `rented`, `maintenance`, `archived` (default for R-13). Contract statuses: `draft`, `active`, `closed`, `void` ([ADR-0007](../adr/0007-contract-lifecycle-and-audit.md)).
- Contract numbers: `MCR-YYYY-NNNN` (default for R-09).
- Client fields are listed in US-031 (default for R-03). Maintenance fields are in US-080 (default for R-14).
- Columns added for the model template's fields (R-02): in `clients`, `title`, `first_name` and `last_name` (instead of `full_name`), `email`, `state_region`, and the issue and expiry dates of the ID document and the licence; in the contract terms, the pick-up place, flight or train, number of days, deposit, services included, additional information and a second « Jours sup » rate; in `inspections`, car papers, clean inside, clean outside and GPS (yes/no); in `staff_profiles`, `display_name`, printed on the contract (R-19).
- Contract documents and signatures also record Documenso's envelope and signer IDs ([ADR-0020](../adr/0020-signatures-with-documenso.md)).
- This can be delivered as two pull requests: tables and grants first, then storage and the upload and download routes.
