# Architecture decision records

Decisions taken from the client's answers of 2026-10-07, revised after an independent review the same day, and updated
with the answers of 2026-10-09, 2026-11-02, 2026-11-03, 2026-11-05, 2026-11-10 (client meeting on the PDF, photos and signatures) and 2026-11-14 (review of the repository: the web app first). The format, the labels and the rule for changing a decision are in
[ADR-0001](0001-record-architecture-decisions.md). In short: when an open question is answered, the ADR is updated in
place and the change is logged in its **Changes** section; any other change gets a new ADR that supersedes the old one.

Labels used inside the ADRs:

- "(default for X-nn)": a choice applied to a question that is still open. Every default is listed in [`../discovery/open-questions.md`](../discovery/open-questions.md) § Defaults.
- `RECOMMENDED`: a technical choice that no question asked about.
- `INTERPRETATION`: a reading of an answer that has to be confirmed.

| ADR | Decision | Status | Based on |
|---|---|---|---|
| [ADR-0001](0001-record-architecture-decisions.md) | Record architecture decisions | Accepted | — |
| [ADR-0002](0002-mobile-stack-expo.md) | Build the app with Expo (React Native, TypeScript), compiled in the cloud | Accepted | B-01, B-02, B-11 · F-05, F-12, F-13 (answered) · F-01 |
| [ADR-0003](0003-ios-distribution-ad-hoc.md) | Distribute the app as an Ad Hoc build to registered iPhones, under the company's Apple account | Accepted | B-02, B-11 · F-02, F-03 (answered) · F-01 |
| [ADR-0004](0004-backend-supabase.md) | Use Supabase in the EU as the backend, starting on the Free plan | Superseded by ADR-0019 | B-03, B-11 · F-02, F-07 (answered) · F-11 |
| [ADR-0005](0005-online-only.md) | Online-only operation: no offline mode | Accepted | B-03 |
| [ADR-0006](0006-contract-only-scope.md) | Contract-only scope: billing, payment and price calculation stay outside the app | Accepted | B-04, B-05, B-10 · F-06, F-09, F-22, F-24, R-02 (answered) · L-02, L-04, L-05 |
| [ADR-0007](0007-contract-lifecycle-and-audit.md) | Contract and vehicle lifecycle: signed data is immutable, changes create revisions, everything is audited | Accepted | Brief · B-06, B-08 · F-04, F-18, F-22, F-26, F-28, R-09, R-10 Q5 (answered) · defaults for R-11, R-12, R-13 |
| [ADR-0008](0008-vehicle-condition-model.md) | Vehicle condition: reference photos reused at Départ, damage records, reset only after repair | Superseded by ADR-0024 | B-09 · brief (Retour, maintenance) · F-10, R-02 (answered) · defaults for B-09 Q1, R-10, R-14 |
| [ADR-0009](0009-signatures.md) | Signatures: one capture per handover, at the bottom right of every page, next to the values it covers | Superseded by ADR-0020 | B-06, B-07, B-08 · F-04 (answered) · F-08 (partly answered) · L-01 |
| [ADR-0010](0010-contract-pdf-generation.md) | Generate the contract PDF on the API server from versioned HTML templates | Accepted | B-04, B-06, B-07 · F-08, F-13, F-17, F-22, F-24, F-28, R-01, R-02, R-19 Q1 (answered) · defaults for R-18, R-19 · R-17, L-02 |
| [ADR-0011](0011-localisation.md) | Localisation: language-neutral data, FR/EN catalogues, versioned general terms | Accepted | Brief · B-07 · defaults for R-17, N-01 |
| [ADR-0012](0012-authentication-and-authorisation.md) | Authentication and authorisation: personal accounts, invite-only, every request checked by the API | Accepted | B-02 · defaults for T-03, R-16 · F-03 · F-11, F-12, F-19, F-29, F-33 (answered) · T-08 |
| [ADR-0013](0013-personal-device-data-protection.md) | Protect client data on staff phones, laptops and the agency computer | Accepted | B-02, B-03 · default for T-05 · F-03 · L-03 |
| [ADR-0014](0014-file-storage.md) | File storage: private S3 buckets, upload-only evidence, short-lived presigned links | Accepted | Brief · B-04, B-09 · F-11, F-31, F-32 (answered) · defaults for R-15, L-03, L-07 |
| [ADR-0015](0015-backups.md) | Nightly encrypted off-site backups: database dumps plus incremental file copies | Accepted | B-11 · F-02, F-11, F-14 (answered) · defaults for L-03, L-07 |
| [ADR-0016](0016-repository-environments-ci.md) | One repository, three environments and an automated delivery pipeline | Accepted | F-02, F-12, F-14, F-29, F-34, F-35, T-04 (answered) · default for N-06 |
| [ADR-0017](0017-crash-reporting.md) | Report crashes to an EU-hosted service with personal data removed | Accepted | RECOMMENDED (no question) · F-02 (answered) · L-03 |
| [ADR-0018](0018-development-and-test-devices.md) | Develop with an Android emulator on Windows and check iOS on a registered test iPhone | Accepted | F-05 (answered) · B-01 |
| [ADR-0019](0019-backend-own-api-postgres-s3.md) | Run our own TypeScript API (Fastify) with managed Postgres and S3 storage at Scaleway, Paris | Accepted | F-11 (answered: option C) · F-12, F-13, F-14, F-15, F-19, F-20 (answered) · B-03, B-11 · F-02, F-07 |
| [ADR-0020](0020-signatures-with-documenso.md) | Signatures through a self-hosted Documenso: one signature fills every page, sealed with the company's certificate | Superseded by ADR-0023 | B-06, B-07, B-08 · F-04, F-16, F-17, F-18, F-19 (answered) · F-08 (partly answered) · default for R-11 · L-01 |
| [ADR-0021](0021-web-app.md) | A web app from the same Expo code, with the iPhone app's features, for staff laptops and the agency computer | Accepted | F-19, F-29, F-30 (answered) · B-01, B-02 · L-03 |
| [ADR-0022](0022-postgresql-17.md) | PostgreSQL 17 in every environment: Scaleway in production, the same major on staging, locally and in CI | Accepted | F-21 (answered) |
| [ADR-0023](0023-signatures-in-the-app-sealed-by-the-api.md) | Signatures captured in the app: one drawing stamped on every page, the PDF sealed by the API; optional stored Retour signature | Accepted | B-06, B-07, B-08 · F-04, F-17, F-18, F-19, F-26, F-27, F-28, F-30 (answered) · F-08 (answered by F-22) · L-01 |
| [ADR-0024](0024-vehicle-condition-four-angles-estimates.md) | Vehicle condition: four required reference angles, damage recorded at the Départ too, estimates on new damage | Accepted | B-09 · brief (Retour, maintenance) · F-10, F-23, F-24, F-25, F-26, R-02, R-10 Q5 (answered) · defaults for R-10, R-14 |
| [ADR-0025](0025-web-app-first.md) | Deliver the web app first; the iPhone app follows from the same code | Accepted | F-29, F-30 (answered) · F-19 · B-01, B-02 |
