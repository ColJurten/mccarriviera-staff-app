# US-004 · Create the API server and its environments: local, homelab staging, Scaleway production

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E0 · Foundations | Must | P0 | L | To do |

- **Depends on:** [US-002](US-002-repository-and-agent-guidance.md)
- **Decisions:** [ADR-0019](../adr/0019-backend-own-api-postgres-s3.md) · [ADR-0016](../adr/0016-repository-environments-ci.md) · [ADR-0012](../adr/0012-authentication-and-authorisation.md) · [ADR-0021](../adr/0021-web-app.md)
- **Open points:** — (see [open questions](../discovery/open-questions.md))

## Story

As the developer, I want the API server running in a local stack, on staging and in production, deployed by the pipeline, so that every feature has somewhere safe to be built, tested and shipped.

## Acceptance criteria

- [ ] Production at Scaleway, Paris, in the developer's account (F-02, F-14): a managed PostgreSQL instance (smallest node) with the databases `mcr` and `documenso`; an instance with at least 4 GB of RAM; the Object Storage buckets of [ADR-0014](../adr/0014-file-storage.md); and turboSMTP's EU server for e-mail, from the developer's domain (F-15).
- [ ] The database accepts connections only from the production server, and only over TLS.
- [ ] The server runs Docker Compose from `deploy/`: Caddy (automatic Let's Encrypt certificates), the API, the web app's static files and Documenso ([US-043](US-043-deploy-documenso.md)). Production answers at `mcr.developerworkshop.online` (web app at `/`, API at `/api/`) and `sign.mcr.developerworkshop.online` (F-14). System security updates install automatically, SSH accepts keys only, and the firewall opens only HTTP and HTTPS.
- [ ] Staging runs on a dedicated VM on the developer's homelab Proxmox (F-14), with the same Compose stack, its own Postgres container (same major version as production) and its own buckets. It holds synthetic data only, uses its own buckets at Scaleway, and is reached over HTTPS at `stg.developerworkshop.online` and `sign.stg.developerworkshop.online` (F-14).
- [ ] Locally, `docker compose up` in WSL2 starts Postgres, Garage (S3), Mailpit (e-mail), Documenso and the API (F-20). The API can be developed and tested end to end without any phone.
- [ ] The API skeleton (TypeScript, Fastify) has a `/health` route that checks the database and the storage, structured logs without personal data (pino), request validation with the shared zod schemas, and a generated OpenAPI description.
- [ ] Every route except `/health` and the sign-in routes requires an active staff session ([US-010](US-010-sign-in-and-sign-out.md)). A test lists every route and fails if one is unprotected.
- [ ] Secrets (database credentials, storage keys, Documenso's token and webhook secret, the signing certificate, the SMTP credentials) live only on the servers, in protected CI environments and in the developer's password manager. `.env.example` lists them.
- [ ] Images are built by CI and pushed to a private registry. Staging is deployed on every merge to `main`, by a runner on the staging VM. Production is deployed on a release tag, after manual approval ([ADR-0016](../adr/0016-repository-environments-ci.md)).
- [ ] Schema changes reach staging and production only through migrations in `db/migrations`, applied with dbmate.
- [ ] The web app is served with a strict Content Security Policy, HSTS, no framing by other sites, and no caching of API responses ([ADR-0021](../adr/0021-web-app.md)).
- [ ] Uptime checks on `mcr.developerworkshop.online/api/health` and `sign.mcr.developerworkshop.online` alert the developer.
- [ ] The diagrams in `docs/architecture/` (system, back end and sequences) are kept up to date as routes are added.
- [ ] The runbook lists the monthly cost and usage check: database size, storage, e-mail volume.

## Notes

- The names on `developerworkshop.online` are `RECOMMENDED`; the domain is the developer's (F-02, F-14).
- Before this story, the spike [US-009](US-009-spike-signature-and-pdf-on-iphone.md) can already run on a throwaway Documenso on the homelab.
