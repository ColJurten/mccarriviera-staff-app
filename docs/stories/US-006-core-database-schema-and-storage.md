# US-006 · Create the core database schema, access rules and storage

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E0 · Foundations | Must | P0 | L | In progress |

- **Depends on:** [US-004](US-004-api-server-and-environments.md)
- **Decisions:** [ADR-0019](../adr/0019-backend-own-api-postgres-s3.md) · [ADR-0007](../adr/0007-contract-lifecycle-and-audit.md) · [ADR-0024](../adr/0024-vehicle-condition-four-angles-estimates.md) · [ADR-0023](../adr/0023-signatures-in-the-app-sealed-by-the-api.md) · [ADR-0011](../adr/0011-localisation.md) · [ADR-0012](../adr/0012-authentication-and-authorisation.md) · [ADR-0014](../adr/0014-file-storage.md)
- **Open points:** R-03, R-13, R-14 (see [open questions](../discovery/open-questions.md))

## Story

As the developer, I want the tables, constraints, access rules and storage buckets for the whole MVP, so that every feature builds on one consistent, protected data model.

## Acceptance criteria

- [ ] Migrations create the tables listed in the notes. Every table has UUID primary keys, `created_at`/`created_by` and English snake_case names.
- [ ] The fields cover every field of the current contract and of the model template (R-02, answered 2026-11-02), as listed in [`contract-template/field-map.md`](../contract-template/field-map.md). For the card, only the last four digits (exactly 4 digits, checked by the database) and the expiry date (MM/YY) are stored. There is no column for a full card number or a CVV (F-09, [ADR-0006](../adr/0006-contract-only-scope.md)).
- [ ] Storage is language-neutral: enumerations as codes, fuel as an integer from 0 to 8 (eighths), amounts as `numeric(10,2)`, times as `timestamptz` ([ADR-0011](../adr/0011-localisation.md)).
- [ ] Free-text fields have maximum lengths, so the contract pages never overflow ([ADR-0010](../adr/0010-contract-pdf-generation.md)). For example, 80 characters for names and address lines, and 500 for comments.
- [ ] A partial unique index allows at most one contract per vehicle that is `awaiting_signature` or `active`: a contract waiting for its signature holds the vehicle (F-18). Check constraints keep km ≥ 0 and fuel between 0 and 8.
- [ ] The API connects with its own database role. Row-level security isn't used, since the API is the only client and checks every request ([ADR-0012](../adr/0012-authentication-and-authorisation.md)).
- [ ] Status columns (`contracts.status`, `vehicles.status`, `damages.status`, `stored_signatures.status`) can't be updated by the API's database role (column-level grants). They change only through SQL functions called by the API ([ADR-0007](../adr/0007-contract-lifecycle-and-audit.md)).
- [ ] These tables accept INSERT only: signed revisions, completed inspections, `signatures`, `condition_baselines`, `photos`, `contract_documents` (previews included), `audit_events`. Unsigned draft revisions can be updated. While its Départ or Retour isn't signed, a damage's comment and estimate can be corrected, and a damage or a photo recorded during it can be withdrawn: the row is kept and marked as withdrawn, through SQL functions (F-26, R-10 Q5). Once signed, damage descriptions and photos can't be changed; only the repair fields change, through the maintenance function. In `stored_signatures`, only the status and its application or cancellation fields change, through SQL functions (F-28).
- [ ] Private buckets exist in Scaleway Object Storage (F-11, answered 2026-11-03): `condition-photos`, `client-documents`, `vehicle-documents`, `signatures`, `contract-pdfs`, and the temporary `incoming` (F-31, F-32). The API's storage key can write and read but not delete in `condition-photos`, `signatures` and `contract-pdfs`; it can also delete in `client-documents`, `vehicle-documents` and `incoming`. No bucket is public. Files are reached only through presigned links of 5 minutes or less, issued by the API after its checks ([ADR-0014](../adr/0014-file-storage.md)).
- [ ] Uploads from the app follow ADR-0014 (F-31): the app gets a link to `incoming` and an `uploads` row; the API verifies the stored file (size, real type, SHA-256); the route that creates the record files the verified uploads and uses each one once. The app never writes to another bucket, and signatures and PDFs have no upload link.
- [ ] Allowed types: JPEG for condition photos; PDF, JPEG and PNG for client and vehicle documents, up to 10 MB (`RECOMMENDED`).
- [ ] Generated PDFs record their stage as `preview`, `departure`, `final` or `authorisation` ([ADR-0023](../adr/0023-signatures-in-the-app-sealed-by-the-api.md)).
- [ ] A seed script loads synthetic vehicles and clients only. No real data.
- [ ] Database tests (migrations applied with dbmate to a throwaway Postgres) prove that:
  - a second active contract on the same vehicle is rejected;
  - append-only tables reject UPDATE and DELETE;
  - the API's role can't change a status column.

  API tests prove that requests without an active staff session get nothing, and that no route gives a link to delete or overwrite a file in the evidence buckets.
- [ ] The class diagrams in `docs/architecture/` are kept in step with the migrations.

## Notes

- Tables (working names): `staff_profiles`, `vehicles`, `condition_baselines`, `photos`, `damages`, `maintenance_records`, `clients`, `client_documents`, `vehicle_documents` (F-32), `uploads` (F-31), `contracts`, `contract_revisions`, `contract_drivers`, `inspections` (stage = departure | return), `signatures`, `stored_signatures`, `contract_documents` (generated PDFs, previews included), `terms_versions` (kind = general_terms | return_authorisation), `audit_events`, `contract_number_counters`: 20 tables. The first 18 are merged (ticket #6); `uploads` comes with the file storage ticket and `vehicle_documents` with the documents ticket.
- Vehicle statuses: `available`, `rented`, `maintenance`, `archived` (default for R-13). Contract statuses: `draft`, `awaiting_signature`, `active`, `closed`, `void` (F-18) ([ADR-0007](../adr/0007-contract-lifecycle-and-audit.md)).
- Contract numbers: `MCR-YYYY-NNNN` (R-09, confirmed 2026-11-14: one number per rental), reserved when the preview to sign is created; a contract never signed keeps its number as `void` « Annulé avant signature » (F-18).
- Client fields are listed in US-031 (default for R-03). Maintenance fields are in US-080 (default for R-14).
- Columns added for the model template's fields (R-02): in `clients`, `title`, `first_name` and `last_name` (instead of `full_name`), `email`, `state_region`, and the issue and expiry dates of the ID document and the licence; in the contract terms, the pick-up place, flight or train, number of days, deposit, additional information and a second « Jours sup » rate (« Services inclus » was dropped by F-22); in `inspections`, car papers, clean inside, clean outside and GPS (yes/no); in `staff_profiles`, `display_name`, printed on the contract (R-19).
- Columns added after the client meeting of November 2026 ([ADR-0023](../adr/0023-signatures-in-the-app-sealed-by-the-api.md), [ADR-0024](../adr/0024-vehicle-condition-four-angles-estimates.md)):
  - in `damages`: where it was found (`found_stage` departure | return | vehicle file, and the contract), and for damage found at a Retour, `estimate_amount` (`numeric(10,2)`) and `estimate_mode` (indicative | billed) (F-24, F-25);
  - in the final pricing: a `damage` line, the sum of the billed estimates (F-24);
  - in `photos`: the kinds are reference, dashboard and damage; there is no loose extra photo (F-23). A reference set needs the 4 required angles;
  - in `signatures`: stage departure | return, mode in_person | stored, the drawing's path, stroke points and SHA-256, the preview's and the sealed PDF's SHA-256, the IP address, and the stored signature it came from;
  - `stored_signatures`: contract, drawing, stroke points and SHA-256, authorisation text version, sealed authorisation PDF, captured at and by, km and fuel at capture, status pending | applied | cancelled, applied at and by, cancellation reason (F-28);
  - in `contract_revisions`: no `client_signed` column, since amendments aren't signed in the app (F-22).
- Delivered in parts: tables and grants first (merged, ticket #6), then file storage with the upload and download routes (ticket #8, after the audit trail of US-007).
- Columns added after the review of 2026-11-14:
  - `uploads`: kind of file, declared and verified type and size, SHA-256, uploader, the times it was created, verified and used, and the record that used it (F-31);
  - `vehicle_documents`: vehicle, type, label, path, SHA-256 and size, as in `client_documents` (F-32);
  - in `photos` and `damages`: who withdrew the row and when, set only before the signature (R-10 Q5). A withdrawn damage isn't an open damage of the vehicle;
  - the numbering helpers aren't executable by the API's database role: they are called only from the preview and signing functions ([ADR-0007](../adr/0007-contract-lifecycle-and-audit.md)).
