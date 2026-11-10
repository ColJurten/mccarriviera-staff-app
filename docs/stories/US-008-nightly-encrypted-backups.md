# US-008 · Run nightly encrypted backups and test a restore

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E0 · Foundations | Must | P6 | M | To do |

- **Depends on:** [US-006](US-006-core-database-schema-and-storage.md) · [US-043](US-043-pdf-sealing-and-signature-certificate.md)
- **Decisions:** [ADR-0015](../adr/0015-backups.md)
- **Open points:** L-07 (see [open questions](../discovery/open-questions.md))

## Story

As the company, I want an encrypted off-site copy of the databases and files every night, so that contracts and photos survive an incident or the loss of the hosting provider.

## Acceptance criteria

- [ ] A nightly job runs on the production server (a container started by a systemd timer), since the database only accepts the server's connections.
- [ ] Both databases, `mcr` and `documenso`, are dumped with `pg_dump` (custom format) as a read-only backup role. Each dump's row counts per table match the live database, otherwise the job fails.
- [ ] Dumps are encrypted with `age` and uploaded to `db/daily/`, and on the 1st of the month also to `db/monthly/`. The provider's lifecycle rules delete them after 30 days and 12 months. These periods are `RECOMMENDED`; L-07 may change them.
- [ ] Files are copied incrementally with `rclone copy`, from the app's buckets, to an rclone `crypt` remote under `files/`. Each file is copied once, and nothing is deleted.
- [ ] The backup bucket is EU-located, held by the developer (F-02), and with a different provider from Scaleway. The key the job uses for it can write and list, but not delete. The keys it uses to read the database and the buckets can only read.
- [ ] The managed database's automated backups are switched on at Scaleway (`RECOMMENDED`).
- [ ] The `age` private key and the crypt password are stored offline by the developer. The company keeps a sealed copy, so it can restore without him by following the runbook (US-093).
- [ ] Each run pings a dead-man's-switch check, which alerts the developer when a night is missed or fails. A weekly check confirms the latest dump exists.
- [ ] Before the pilot, the latest backup is restored into a throwaway Postgres and bucket on the developer's encrypted disk. Counts are compared with production, the time is recorded, and the restored copy is wiped. Staging is never used for this.

## Notes

- This must be in place before any real client data enters production (before US-090 and US-091).
