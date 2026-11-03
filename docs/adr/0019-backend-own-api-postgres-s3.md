# ADR-0019: Run our own TypeScript API (Fastify) with managed Postgres and S3 storage at Scaleway, Paris

| Status | Date | Decided by | Based on |
|---|---|---|---|
| **Accepted** | 2026-11-03 | Developer, with the client's answers | F-11 (answered: option C) · F-12, F-13, F-14 (answered) · B-03, B-11 · F-02, F-07 · defaults for F-14 (domain names), F-15 |

## Context

- This ADR supersedes [ADR-0004](0004-backend-supabase.md) (Supabase).
- **F-11** (2026-11-03): option C. The back end is the developer's own API server, his own Postgres database, and S3 storage for the files.
- **F-12** (2026-11-03): the API is written in TypeScript with Fastify.
- **F-14** (2026-11-03): production is hosted by Scaleway in Paris. Staging runs on a dedicated VM on the developer's homelab (Proxmox).
- A phone app can't talk to Postgres directly, because the database credentials would sit on the phones. Something has to stand in between: handle the staff logins, check every request, and hand out temporary links to the private files (F-11). Here, that is the API.
- Signatures move to a self-hosted Documenso, which the API calls. Documenso needs Postgres, S3-compatible storage, an e-mail server and a server with at least 2 GB of RAM ([ADR-0020](0020-signatures-with-documenso.md)).
- The contract PDF is now rendered by the API (F-13, [ADR-0010](0010-contract-pdf-generation.md)).
- Other constraints are unchanged:
  - online only ([ADR-0005](0005-online-only.md));
  - client data stays in the EU (GDPR);
  - one part-time maintainer (B-11), with Postgres and infrastructure experience;
  - the developer holds the accounts (F-02) and pays the hosting from his maintenance fee (F-07).

## Decision

- **API server** (F-12): TypeScript on Node.js (current LTS release, pinned in the container image), with **Fastify**.
  - Request and response shapes are **zod** schemas in a package shared with the app, so both sides validate the same data. The OpenAPI description is generated from them (`RECOMMENDED`).
  - The database is queried with **Kysely** (typed SQL) and the `pg` driver. Types are generated from the schema with `kysely-codegen`, and CI checks they are current (`RECOMMENDED`).
  - **Logins:** **better-auth**, running in the API, with its Expo integration ([ADR-0012](0012-authentication-and-authorisation.md)).
  - **Files:** the API checks the session and the rules, then returns presigned S3 links valid for 5 minutes at most ([ADR-0014](0014-file-storage.md)).
  - **PDFs:** rendered by headless Chromium (Playwright) inside the API's container ([ADR-0010](0010-contract-pdf-generation.md)).
  - **Signatures:** the API is Documenso's only client, and receives its webhooks ([ADR-0020](0020-signatures-with-documenso.md)).
  - Logs are structured (pino) and never contain personal data. Errors go to Sentry ([ADR-0017](0017-crash-reporting.md)).
- **Database:** **Scaleway Managed Database for PostgreSQL**, Paris region, smallest node, in the developer's Scaleway account (F-02).
  - Two databases on the instance: `mcr` for the app and `documenso`, each with its own user.
  - It is reachable only from the production server (private network, or an allow-list of the server's address) and only over TLS.
  - The provider's automated backups are switched on, in addition to the off-site copy ([ADR-0015](0015-backups.md)).
  - **Integrity stays in the database**, as before ([ADR-0007](0007-contract-lifecycle-and-audit.md)): constraints, the partial unique index on active contracts, append-only tables protected by grants and triggers, and status changes only through SQL functions that each run in one transaction. The API's database role can't update status columns or append-only tables directly.
  - **Who may do what** is checked in the API: every route needs an active staff session ([ADR-0012](0012-authentication-and-authorisation.md)). Row-level security isn't used, since the API is the only client (`RECOMMENDED`).
  - Schema changes are plain SQL migrations in the repository (`db/migrations`), applied with **dbmate** by the delivery pipeline (`RECOMMENDED`, [ADR-0016](0016-repository-environments-ci.md)).
- **Files:** **Scaleway Object Storage**, Paris region, private buckets only ([ADR-0014](0014-file-storage.md)). Documenso's files go in a bucket of their own.
- **Server:** one Scaleway instance in Paris with at least 4 GB of RAM, since Documenso alone needs 2 GB in production. It runs Docker Compose:
  - **Caddy**, the reverse proxy, with automatic TLS certificates;
  - the **API**;
  - **Documenso** ([ADR-0020](0020-signatures-with-documenso.md)).

  Container images are pinned to exact versions. Operating-system security updates install automatically. SSH accepts keys only, and the firewall opens only HTTPS (and HTTP for certificate renewal).
- **Public names** (default for F-14): `api.<company domain>` for the API and `sign.<company domain>` for Documenso's signing pages, which the phones open. The company adds the DNS records.
- **E-mail** (default for F-15): **Scaleway Transactional Email**, sending from the company's domain (SPF and DKIM records). Documenso needs an SMTP server even though its e-mails to clients are switched off ([ADR-0020](0020-signatures-with-documenso.md)). The app itself still sends no e-mail in the MVP.
- **Environments** ([ADR-0016](0016-repository-environments-ci.md)):
  - local: Docker Compose on WSL2;
  - **staging: a dedicated VM on the developer's homelab Proxmox** (F-14), with synthetic data only, and its own Postgres, Documenso and buckets;
  - production: Scaleway, as above.
- **Operations:**
  - an uptime check on `api` and `sign` alerts the developer;
  - the runbook ([US-093](../stories/US-093-operations-runbook.md)) covers patching, image and Documenso upgrades, certificates and restores.
- **Cost** (estimate, prices to recheck when ordering): the managed Postgres node costs about €11 a month (checked 2026-10-09), and a 4 GB instance about €15. Object storage costs cents at this size, and the e-mail volume stays within the free tier. That's roughly **€25–30 a month** before VAT, covered by the developer's maintenance fee (F-07).

## Consequences

**Positive**

- The data and the services run on infrastructure the developer controls, in France.
- No free-plan pausing or quotas, and storage costs cents.
- One language from end to end: the app, the API, the contract template and the scripts.
- The contract template runs on the same engine (Chromium) as template v1's prototype.
- The developer's Postgres and infrastructure experience is used directly.

**Negative / risks**

- Weeks more work than Supabase (F-11): logins and sessions, permission checks, file access, the API itself, deployment, TLS and monitoring.
- The developer runs everything: system and container updates, Documenso upgrades, certificates and incidents.
- One server is a single point of failure. While it is down, no Départ or Retour can be signed ([ADR-0005](0005-online-only.md)), so the paper fallback (B-03a) matters.
- Staging and production run Postgres differently (self-run on the homelab, managed at Scaleway). Both use the same major version.
- Scaleway becomes a sub-processor (L-03). The homelab holds synthetic data only.

## Alternatives considered

| Option | Why not chosen |
|---|---|
| Supabase (ADR-0004; options A and B of F-11) | Superseded: the developer chose his own API and database (F-11) |
| Everything self-hosted on one server, including Postgres (option D of F-11) | Cheapest, but the database's backups, updates and recovery would also be his to run. A managed database takes that off |
| Go or Python (FastAPI) for the API | Go has the smallest runtime and Python would reuse the Jinja2 prototype, but both add a second language and lose the types shared with the app (F-12) |
| NestJS, Hono or Express instead of Fastify | NestJS adds a heavy framework for a small API; Hono targets edge runtimes; Express has no built-in schema validation. Fastify is fast, schema-first and well maintained |
| Prisma or Drizzle instead of Kysely | Prisma hides SQL and fits SQL functions and triggers poorly. Drizzle is close; Kysely keeps the SQL explicit, which suits a schema whose rules live in the database |
| Hand-written login code | better-auth already covers password hashing, sessions, rate limiting and revocation, and has an Expo integration |

## Revisit when

Running the server takes more time than planned, one server's availability isn't enough, or the client wants the data in its own accounts.

## Changes

- 2026-11-03: written from the answers to F-11 (option C), F-12, F-13 and F-14. Supersedes ADR-0004.

## Implemented by

- [US-004](../stories/US-004-api-server-and-environments.md): Create the API server and its environments: local, homelab staging, Scaleway production
- [US-006](../stories/US-006-core-database-schema-and-storage.md): Create the core database schema, access rules and storage
- [US-043](../stories/US-043-deploy-documenso.md): Deploy Documenso and connect it to the API
- [US-057](../stories/US-057-sign-departure-server-function.md): API: sign a Départ in one database transaction
- [US-092](../stories/US-092-legal-and-privacy-checklist.md): Send the legal and privacy questions, and close them before go-live
- [US-093](../stories/US-093-operations-runbook.md): Write the operations runbook
