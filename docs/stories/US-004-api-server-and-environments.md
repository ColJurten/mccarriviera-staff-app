# US-004 · Create the API server and its environments: local, homelab staging, Scaleway production

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E0 · Foundations | Must | P0 | L | In progress |

- **Depends on:** [US-002](US-002-repository-and-agent-guidance.md)
- **Decisions:** [ADR-0019](../adr/0019-backend-own-api-postgres-s3.md) · [ADR-0016](../adr/0016-repository-environments-ci.md) · [ADR-0022](../adr/0022-postgresql-17.md) · [ADR-0012](../adr/0012-authentication-and-authorisation.md) · [ADR-0021](../adr/0021-web-app.md)
- **Open points:** — (see [open questions](../discovery/open-questions.md))

## Story

As the developer, I want the API server running in a local stack, on staging and in production, deployed by the pipeline, so that every feature has somewhere safe to be built, tested and shipped.

## Acceptance criteria

- [ ] Production at Scaleway, Paris, in the developer's account (F-02, F-14): a managed PostgreSQL 17 instance (smallest node, [ADR-0022](../adr/0022-postgresql-17.md)) with the database `mcr`; an instance with 4 GB of RAM to start, rechecked against the spike's measurements (US-009); the Object Storage buckets of [ADR-0014](../adr/0014-file-storage.md); and turboSMTP's EU server for e-mail, from the developer's domain (F-15).
- [ ] The database accepts connections only from the production server, and only over TLS.
- [ ] The server runs Docker Compose from `deploy/`: Caddy (automatic Let's Encrypt certificates), the API and the web app's static files. Production answers at `mcr.developerworkshop.online` (web app at `/`, API at `/api/`) (F-14). System security updates install automatically, SSH accepts keys only, and the firewall opens only HTTP and HTTPS.
- [ ] Staging runs on a dedicated VM on the developer's homelab Proxmox (F-14), with the same Compose stack, its own PostgreSQL 17 container (the production major version, [ADR-0022](../adr/0022-postgresql-17.md)) and its own buckets. It holds synthetic data only, uses its own buckets at Scaleway, and is reached over HTTPS at `stg.developerworkshop.online` (F-14), through a tunnel opened from the VM, so that no port is opened on the home network (F-34). The API reads the client's address from the tunnel's header, and only from the tunnel.
- [ ] Locally, `docker compose up` in WSL2 starts PostgreSQL 17, Garage (S3), Mailpit (e-mail), the API and a Caddy that serves the web app and the API at one address, as in production (F-20). The local stack built in part 1 still runs Documenso; a ticket removes it ([ADR-0023](../adr/0023-signatures-in-the-app-sealed-by-the-api.md)). The API can be developed and tested end to end without any phone.
- [ ] The API skeleton (TypeScript, Fastify) has a `/health` route that checks the database and the storage, structured logs without personal data (pino), request validation with the shared zod schemas, and a generated OpenAPI description.
- [ ] Every route except `/health` and the sign-in routes requires an active staff session ([US-010](US-010-sign-in-and-sign-out.md)). A test lists every route and fails if one is unprotected.
- [ ] Secrets (database credentials, storage keys, the signing certificate and its passphrase, the SMTP credentials) live only on the servers, in protected CI environments and in the developer's password manager. `.env.example` lists them.
- [ ] Images are built by CI and pushed to a private registry. After every merge to `main`, the staging VM pulls the new images itself, applies the migrations and restarts the stack: a timer on the VM checks every few minutes (F-35). No self-hosted runner is used, since the repository is public. Production is deployed on a release tag, after manual approval ([ADR-0016](../adr/0016-repository-environments-ci.md)).
- [ ] Schema changes reach staging and production only through migrations in `db/migrations`, applied with dbmate.
- [ ] The web app is served with a strict Content Security Policy, HSTS, no framing by other sites, and no caching of API responses ([ADR-0021](../adr/0021-web-app.md)).
- [ ] An uptime check on `mcr.developerworkshop.online/api/health` alerts the developer.
- [ ] The diagrams in `docs/architecture/` (system, back end and sequences) are kept up to date as routes are added.
- [ ] The runbook lists the monthly cost and usage check: database size, storage, e-mail volume.

## Notes

- The names on `developerworkshop.online` are `RECOMMENDED`; the domain is the developer's (F-02, F-14).
- The spike [US-009](US-009-spike-signature-and-pdf-on-iphone.md) needs no server of its own: its scripts run locally.
- Progress: part 1 (the local stack and the API skeleton) is merged. To do: one address for the web app and the API in the local stack, staging on the homelab, production at Scaleway.
- Since 2026-11-14 the web app is built first ([ADR-0025](../adr/0025-web-app-first.md)): staging comes as soon as the web skeleton exists, so that screens are checked on a phone.
