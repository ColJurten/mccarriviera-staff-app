# US-093 · Write the operations runbook

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E9 · Go-live | Must | P6 | S | To do |

- **Depends on:** [US-005](US-005-eas-builds-and-internal-distribution.md) · [US-008](US-008-nightly-encrypted-backups.md) · [US-012](US-012-revoke-a-staff-members-access.md)
- **Decisions:** [ADR-0003](../adr/0003-ios-distribution-ad-hoc.md) · [ADR-0019](../adr/0019-backend-own-api-postgres-s3.md) · [ADR-0020](../adr/0020-signatures-with-documenso.md) · [ADR-0015](../adr/0015-backups.md) · [ADR-0016](../adr/0016-repository-environments-ci.md)
- **Open points:** — (see [open questions](../discovery/open-questions.md))

## Story

As the developer maintaining the app alone, I want a runbook for recurring tasks, so that nothing expires or breaks unnoticed.

## Acceptance criteria

- [ ] `docs/runbook.md` covers:
  - the yearly Apple membership and certificate/profile renewal (rebuild and reinstall before expiry, with a reminder 30 days ahead);
  - registering a new phone;
  - publishing an over-the-air update;
  - applying a migration;
  - the monthly cost and usage check (database, storage, e-mail, and the end of turboSMTP's free period);
  - the yearly renewal of the domain `developerworkshop.online`;
  - system, container and Documenso updates (back up first, staging first);
  - the expiry and renewal of the signing certificate (ADR-0020) and of the TLS certificates (automatic, monitored);
  - backup monitoring and restore;
  - revoking a user;
  - the erasure procedure (US-094);
  - upgrading the Expo SDK;
  - the handover procedure if the maintenance contract ends: transfer or export the Scaleway project (or the databases and buckets), the GitHub repository, the Expo project and the backup bucket to the company or its next provider, hand over the backup keys and the Documenso signing certificate, and have the company issue a new Apple signing certificate. The public names are on the developer's domain: a new provider needs new names, a new iOS build and a redeployed web app.
- [ ] Every procedure that can be rehearsed has been run once on staging. The yearly renewal is rehearsed by checking the expiry dates in the Apple and EAS consoles.
