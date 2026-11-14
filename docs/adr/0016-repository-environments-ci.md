# ADR-0016: One repository, three environments and an automated delivery pipeline

| Status | Date | Decided by | Based on |
|---|---|---|---|
| **Accepted** | 2026-10-07 (updated 2026-11-14) | Developer, with the client's answers | F-02, F-12, F-14, F-29, F-34, F-35, T-04 (answered) · default for N-06 |

## Context

- One developer builds and maintains the app with coding agents (B-11).
- The app (Expo), the API (Fastify), the database, the contract template and the docs change together ([ADR-0019](0019-backend-own-api-postgres-s3.md)).
- App builds happen in the cloud ([ADR-0002](0002-mobile-stack-expo.md), [ADR-0003](0003-ios-distribution-ad-hoc.md)).
- Development happens on Windows with WSL2. A phone on the network can't reach services inside WSL2 by default.
- **F-14** (2026-11-03): staging runs on a dedicated VM on the developer's homelab Proxmox; production at Scaleway.

## Decision

- **One repository**, with pnpm workspaces (`RECOMMENDED`):
  - `app/`: the Expo app, for the web first, then iOS ([ADR-0021](0021-web-app.md), [ADR-0025](0025-web-app-first.md));
  - `api/`: the Fastify API;
  - `packages/shared/`: zod schemas and types shared by the app and the API, the contract template and its catalogues;
  - `db/`: SQL migrations, seed with synthetic data, database tests;
  - `deploy/`: Docker Compose files and the Caddy configuration, without secrets;
  - `docs/`: this documentation;
  - `scripts/`: backup, admin, import, erasure.
- **Agent guidance:** a root `AGENTS.md`, with `CLAUDE.md` pointing to it, tells coding agents to start from `docs/README.md` (default for N-06).
- **Git host:** a **public** GitHub repository on the developer's account (F-02; T-04, answered 2026-11-14). Nothing secret or personal may be committed, or written in issues, pull requests or CI logs. It runs CI and the delivery pipeline. Container images go to a private registry (GitHub Container Registry).
- **Environments:**
  - **local:** Docker Compose on WSL2: Postgres (same major version as production), Garage as the S3 store, Mailpit to catch e-mails, and the API, for development and tests (F-20, `RECOMMENDED`). The web app runs in a browser against it, behind a local Caddy that serves the web app and the API at one address, as in production (`RECOMMENDED`, [ADR-0021](0021-web-app.md)). The Metro bundler also runs in WSL2. The phone reaches it through WSL mirrored networking (Windows 11) or `expo start --tunnel`.
  - **development builds on the phone:** use **staging**, because the phone can't reach services inside WSL2.
  - **Android emulator on Windows:** runs an Android development build of the same app for day-to-day UI work, also against staging ([ADR-0018](0018-development-and-test-devices.md)).
  - **staging:** a dedicated VM on the homelab Proxmox (F-14), running the same Compose stack with its own Postgres and its own buckets, with **synthetic data only**. The phones and browsers reach it over HTTPS at `stg.developerworkshop.online` (F-14), through a tunnel opened from the VM, so that no port is opened on the home network (F-34, answered 2026-11-14). The tool is chosen when staging is set up (Cloudflare Tunnel, `RECOMMENDED`). Its buckets are at Scaleway, so that their policies behave as in production (`RECOMMENDED`). EAS `preview` profile and channel.
  - **production:** Scaleway ([ADR-0019](0019-backend-own-api-postgres-s3.md)), plus the EAS `production` profile and channel.
- **CI on every pull request:**
  - typecheck, lint, unit tests and the translation-key check;
  - database tests: migrations applied to a throwaway Postgres, then tests of constraints, grants and SQL functions;
  - API tests, including the check that every route requires a session;
  - contract PDF tests: synthetic cases rendered with Chromium, with the overflow check and snapshots ([ADR-0010](0010-contract-pdf-generation.md));
  - the web build, and end-to-end tests of the main flows in a headless browser against a throwaway stack ([ADR-0021](0021-web-app.md));
  - a bundle of the iOS target, which keeps the shared code buildable for the iPhone ([ADR-0025](0025-web-app-first.md));
  - a check that the generated database types are up to date.
- **Releases of the API and the database:**
  - images, including the web app's static files, are built by CI and tagged with the commit;
  - on a merge to `main`, CI pushes the images to the private registry. The staging VM pulls them: a timer on the VM checks for a new image every few minutes, applies the migrations and restarts the stack (F-35). There is no self-hosted runner: the repository is public, and a runner would let a pull request from a fork run code on the VM;
  - on a release tag, production is deployed after manual approval: migrations with dbmate, then `docker compose pull` and `up` on the server, over SSH from a protected environment.
- **iPhone app releases**, from the iPhone phase ([ADR-0025](0025-web-app-first.md)):
  - EAS builds are triggered on purpose (the free plan includes 15 iOS builds a month);
  - JavaScript-only fixes go through EAS Update;
  - a runtime-version policy keeps an update from reaching an incompatible build.
- **Secrets:**
  - the app only gets the API's address for each environment, through EAS environment variables;
  - database credentials, storage keys, the signing certificate and its passphrase, the timestamping authority's credentials if it has any, and the e-mail credentials live only on the servers, in protected CI environments and in the developer's password manager.
- **Working style:** short-lived branches, pull requests that cite story and ADR IDs, and a protected main branch.
- **Docs written alongside the stories:** `testing.md` (US-002), `screens.md` (US-003) and `runbook.md` (US-093). The UML diagrams in `architecture/` are kept up to date by US-004, US-006, US-050 and US-070.

## Consequences

**Positive**

- Changes to the app, the API, the database and the docs are reviewed together.
- Changes reach staging before production, and the contract PDFs are tested in CI with the same engine as production.
- No real data is used in development or staging.

**Negative / risks**

- The free EAS build quota means builds must be planned.
- Development against staging needs a connection, and staging depends on the homelab being up.
- Staging runs Postgres itself, production uses a managed one: the major versions must match.

## Alternatives considered

| Option | Why not chosen |
|---|---|
| Separate repositories for the app and the API | Overhead for one developer, and the shared schemas would need publishing |
| Committing generated native folders | Harder upgrades; Expo's continuous native generation is preferred |
| Pointing development builds at the local stack | Needs network bridging into WSL2; staging is simpler |
| Staging at Scaleway too | Costs about as much as production; the homelab is free (F-14) |

## Revisit when

A second developer joins, the free build quota becomes a bottleneck, or the homelab can't host staging any more.

## Changes

- 2026-10-09: Android emulator added for day-to-day work (ADR-0018).
- 2026-10-09 (later): F-02 answered: the repository is on the developer's account. The UML diagrams in `architecture/` replace the planned `architecture.md`, `data-model.md` and `user-flows.md`.
- 2026-11-03: rewritten for the developer's own back end (ADR-0019): `api/`, `packages/shared/`, `db/` and `deploy/` folders, staging on the homelab (F-14), production at Scaleway, PDF tests with Chromium in CI.
- 2026-11-03 (later): Garage and Mailpit in the local stack (F-20), staging names on the developer's domain (F-14), and the web app built, tested and deployed with the API (F-19).
- 2026-11-10: Documenso is removed from every environment ([ADR-0023](0023-signatures-in-the-app-sealed-by-the-api.md)). The local stack still runs it until the follow-up ticket removes it.
- 2026-11-14: T-04 answered: the repository is public. F-34 answered: staging is reached through a tunnel. The web app is built first (F-29): a local Caddy, an iOS bundle check in CI, and app releases from the iPhone phase ([ADR-0025](0025-web-app-first.md)).
- 2026-11-14 (later): F-35 answered: the staging VM pulls its images instead of being deployed by a self-hosted runner, because the repository is public.

## Implemented by

- [US-002](../stories/US-002-repository-and-agent-guidance.md): Set up the repository, checks and agent guidance
- [US-004](../stories/US-004-api-server-and-environments.md): Create the API server and its environments: local, homelab staging, Scaleway production
- [US-005](../stories/US-005-eas-builds-and-internal-distribution.md): Set up EAS builds, internal distribution and over-the-air updates
- [US-093](../stories/US-093-operations-runbook.md): Write the operations runbook
