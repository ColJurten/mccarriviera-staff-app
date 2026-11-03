# US-043 · Deploy Documenso and connect it to the API

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E4 · Contract document | Must | P0 | M | To do |

- **Depends on:** [US-004](US-004-api-server-and-environments.md) · [US-009](US-009-spike-signature-and-pdf-on-iphone.md)
- **Decisions:** [ADR-0020](../adr/0020-signatures-with-documenso.md) · [ADR-0019](../adr/0019-backend-own-api-postgres-s3.md) · [ADR-0015](../adr/0015-backups.md)
- **Open points:** F-15, L-01 (see [open questions](../discovery/open-questions.md))

## Story

As the developer, I want Documenso running next to the API in each environment, configured so that only the API uses it, so that contracts can be signed and sealed.

## Acceptance criteria

- [ ] Documenso Community Edition runs unmodified, from its official image pinned to an exact version, in the Compose stack of each environment ([ADR-0020](../adr/0020-signatures-with-documenso.md)).
- [ ] It uses its own database (`documenso`), its own bucket, and the e-mail provider of F-15 (default: Scaleway Transactional Email).
- [ ] Each environment has its own self-signed .p12 certificate with a passphrase (F-17), provided as a secret. Documenso's certificate status check reports it as valid.
- [ ] Public sign-up is disabled. The administrator account is the developer's, with two-factor authentication. There is one team, and one API token, stored only in the API's secrets.
- [ ] The webhook for completed documents points to the API, with a shared secret.
- [ ] E-mails to signers are switched off by default (F-16).
- [ ] Upgrades follow the runbook: read the release notes, back up the `documenso` database, upgrade staging first, then production.
- [ ] `deploy/` notes that Documenso is AGPL-3.0 software and must stay unmodified, or have its changes published.
- [ ] Documenso's database and bucket are included in the backups ([US-008](US-008-nightly-encrypted-backups.md)) and in the erasure procedure ([US-094](US-094-retention-and-erasure.md)).
