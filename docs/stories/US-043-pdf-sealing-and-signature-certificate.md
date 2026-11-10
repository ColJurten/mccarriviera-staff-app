# US-043 · Seal signed PDFs with the company certificate, a timestamp and a signature certificate page

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E4 · Contract document | Must | P0 | M | To do |

- **Depends on:** [US-004](US-004-api-server-and-environments.md) · [US-009](US-009-spike-signature-and-pdf-on-iphone.md)
- **Decisions:** [ADR-0023](../adr/0023-signatures-in-the-app-sealed-by-the-api.md) · [ADR-0019](../adr/0019-backend-own-api-postgres-s3.md) · [ADR-0015](../adr/0015-backups.md) · [ADR-0016](../adr/0016-repository-environments-ci.md)
- **Open points:** L-01 (see [open questions](../discovery/open-questions.md))

## Story

As the developer, I want the API to stamp a signature on every page and seal the PDF in each environment, so that every signed contract is tamper-evident and carries its own evidence.

## Acceptance criteria

- [ ] An API module takes a stored preview PDF, a drawing and the box positions the template gives, and stamps the drawing into those boxes on every page without rendering the pages again ([ADR-0023](../adr/0023-signatures-in-the-app-sealed-by-the-api.md)).
- [ ] It appends a signature certificate page in the PDF's language: contract and revision, the signer's name as printed, the staff user, the server times, the device model, the operating-system and app versions, the IP address the API saw, the signing mode (in person or stored, with the capture and application times), and the SHA-256 of the preview, of the drawing and of the data snapshot. « Page n / N » doesn't count it.
- [ ] It applies one PAdES signature to the whole file with the environment's company certificate, with a timestamp from the RFC 3161 timestamping authority chosen in the spike US-009. The library is the one the spike chose.
- [ ] Each environment has its own self-signed .p12 certificate with a passphrase (F-17), provided as a secret to the API only. Neither is ever committed or logged.
- [ ] A sealed test PDF opens in Adobe Reader with the seal intact (signer identity unverified, with a self-signed certificate) and the timestamp shown. A copy changed by one byte is reported as modified. This check is in CI with a verification library, and done once by hand per environment.
- [ ] If the timestamping authority can't be reached, the API retries, then fails the signing with a clear error. Nothing is marked signed without a timestamp (`RECOMMENDED`).
- [ ] Certificate renewal and replacement are in the runbook ([US-093](US-093-operations-runbook.md)). The certificate and its passphrase are in the developer's password manager, with a sealed copy for the company ([ADR-0015](../adr/0015-backups.md)).
- [ ] Unit tests cover stamping on 1, 10 and 30 pages, French and English positions, a missing box position (fails), and a preview whose SHA-256 doesn't match (fails).

## Notes

- This replaces « Deploy Documenso and connect it to the API », dropped with ADR-0020 on 2026-11-10.
- The legal level stays a simple electronic signature with an audit trail, in a sealed file. The lawyer confirms it, and whether a trusted certificate or a qualified timestamp is needed (L-01).
