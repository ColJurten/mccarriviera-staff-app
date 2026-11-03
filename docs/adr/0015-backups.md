# ADR-0015: Nightly encrypted off-site backups: database dumps plus incremental file copies

| Status | Date | Decided by | Based on |
|---|---|---|---|
| **Accepted** | 2026-10-07 (updated 2026-11-03) | Developer, with the client's answers | B-11 · F-02, F-11, F-14 (answered) · defaults for L-03, L-07 |

## Context

- Contracts, signatures and photos are evidence the company may need years later (retention: L-07).
- The managed database has the provider's own automated backups ([ADR-0019](0019-backend-own-api-postgres-s3.md)), but they sit with the same provider as the data. An off-site copy, with a different provider, is still needed.
- There are two databases (the app's and Documenso's) and two sets of files (the app's buckets and Documenso's bucket).
- The database accepts connections only from the production server.
- Hosting must stay cheap (B-11).

## Decision

- **A nightly job on the production server** (a container started by a systemd timer), since the database only accepts connections from there:
  1. **Dump both databases** (`mcr` and `documenso`) with `pg_dump`, in custom format, as a read-only backup role.
  2. **Check each dump:** row counts per table are compared with the live database, and the job fails if they don't match. This catches an empty or partial dump.
  3. **Encrypt and store the dumps:** encrypted with `age` (only the public key is on the server) and uploaded to `db/daily/`. On the 1st of the month they also go to `db/monthly/`.
  4. **Copy files incrementally:** `rclone copy` from the app's buckets and Documenso's bucket to an rclone `crypt` remote (contents and names encrypted), under `files/`.
     - Files are never modified after upload ([ADR-0007](0007-contract-lifecycle-and-audit.md)), so each file is copied once.
     - The job never deletes anything.
- **Where:** an EU-located, S3-compatible bucket, held by the developer (F-02), **with a different provider from Scaleway**. Examples: Backblaze B2 in an EU region, or Cloudflare R2 with EU jurisdiction.
  - Their free tiers (about 10 GB) last a long time, since each file is stored once.
  - Beyond that, it costs a few euros a month.
- **Also on:** the managed database's automated backups at Scaleway (`RECOMMENDED`).
- **Retention** (`RECOMMENDED`; L-07 may change it):
  - The provider's lifecycle rules delete daily dumps after 30 days and monthly dumps after 12 months.
  - File copies are kept until the retention procedure removes them ([US-094](../stories/US-094-retention-and-erasure.md)).
- **Credentials:**
  - The backup role can only read. The storage key used to read the buckets can only read.
  - The key for the backup bucket can write and list, but **not delete**. A leaked server secret therefore can't destroy backups, and retention is left to the lifecycle rules.
  - The `age` private key and the rclone crypt password are kept offline by the developer (password manager), with a sealed copy for the company. Losing them means losing the backups. With that copy and the runbook's restore procedure, the company can restore without the developer.
- **Monitoring:** each run pings a dead-man's-switch check, which alerts the developer when a night is missed or fails. A weekly check confirms the latest dump exists.
- **Restore test:** before the pilot, then every quarter.
  - Restore the latest backup into a throwaway Postgres and bucket on the developer's encrypted disk.
  - Compare row and file counts with production, record how long it took, then wipe it.
  - Never restore into staging, which holds synthetic data only.

## Consequences

**Positive**

- An off-site, encrypted copy that doesn't depend on the hosting provider.
- Backups can't be deleted with the server's credentials.
- Costs nothing, or a few euros a month.

**Negative / risks**

- The developer is responsible for the job and the keys.
- The job runs on the production server: if the server is lost, the last copy is the previous night's.
- Erasure must also remove files from the backup ([US-094](../stories/US-094-retention-and-erasure.md)).

## Alternatives considered

| Option | Why not chosen |
|---|---|
| Only the provider's automated backups | Same provider as the data; no copy the company can restore without Scaleway |
| Running the job from GitHub Actions | The database only accepts the server's connections |
| A full copy of every file each night | Wasteful, and exceeds the backup storage's free tier |
| No backups | Unacceptable for signed contracts |

## Revisit when

Retention rules (L-07) change, or the volume makes the backup storage cost matter.

## Changes

- 2026-10-09: F-02 answered: the backup bucket is held by the developer; it must be with a different provider from the files.
- 2026-11-03: rewritten for the developer's own back end (F-11, [ADR-0019](0019-backend-own-api-postgres-s3.md)): the job runs on the production server, dumps both databases (app and Documenso), and copies Documenso's files too.

## Implemented by

- [US-008](../stories/US-008-nightly-encrypted-backups.md): Run nightly encrypted backups and test a restore
- [US-043](../stories/US-043-deploy-documenso.md): Deploy Documenso and connect it to the API
- [US-092](../stories/US-092-legal-and-privacy-checklist.md): Send the legal and privacy questions, and close them before go-live
- [US-093](../stories/US-093-operations-runbook.md): Write the operations runbook
- [US-094](../stories/US-094-retention-and-erasure.md): Apply retention and erasure rules
