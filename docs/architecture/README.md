# Architecture diagrams

UML diagrams of the planned app (the web app first, then the iPhone app), back end and database, drawn from the [decisions](../adr/README.md) and [stories](../stories/README.md). First version: 2026-10-09. The class diagrams 07 and 08 were updated on 2026-11-02 with the fields of [contract template v1](../contract-template/field-map.md). On 2026-11-03 the system, build, front-end, back-end and sequence diagrams were redrawn for the developer's own API at Scaleway ([ADR-0019](../adr/0019-backend-own-api-postgres-s3.md)) and for signing with Documenso ([ADR-0020](../adr/0020-signatures-with-documenso.md)); later the same day, the web app ([ADR-0021](../adr/0021-web-app.md)) and the « En attente de signature » state (F-18) were added. On 2026-11-10 the diagrams were updated for signing in the app, sealed by the API ([ADR-0023](../adr/0023-signatures-in-the-app-sealed-by-the-api.md)), for the vehicle-condition changes ([ADR-0024](../adr/0024-vehicle-condition-four-angles-estimates.md)) and for the stored Retour signature: Documenso is gone, and there are now 18 tables. On 2026-11-14 the web app became the first release ([ADR-0025](../adr/0025-web-app-first.md)), and two tables were decided (`uploads`, `vehicle_documents`). The diagrams don't show this yet, and the SVGs of diagrams 01 to 04 and 09 to 13 haven't been regenerated since their sources changed on 2026-11-10: a ticket updates the sources and regenerates every SVG and the PDF.

- **To read them:** [`architecture.pdf`](architecture.pdf), 15 A4 pages. Each diagram comes with a few key points and the ADRs and stories it is based on. The last two pages compare the hosting options of [F-11](../discovery/open-questions.md); option C was chosen on 2026-11-03.
- **To change them:** edit the PlantUML sources (`NN-*.puml`) and regenerate. The SVG files in [`svg/`](svg/) and the PDF are generated; never edit them by hand.

| # | Diagram | UML type | What it shows |
|---|---|---|---|
| 01 | [System overview](svg/01-system-overview.svg) · [source](01-system-overview.puml) | Deployment | What runs where in daily use, how the parts talk, and who holds each account |
| 02 | [Build, release and development](svg/02-build-and-release.svg) · [source](02-build-and-release.puml) | Deployment | From the developer's PC to the staff phones and the servers: GitHub, EAS, Apple signing, homelab staging, Scaleway production |
| 03 | [Front end](svg/03-app-components.svg) · [source](03-app-components.puml) | Component | The Expo app, for the web first, then iOS: screens (with their stories), data layer, PDF preview and signature pad, device services |
| 04 | [Back end](svg/04-backend-components.svg) · [source](04-backend-components.puml) | Component | The production server (Caddy, the API with its PDF renderer and signing), the managed Postgres with its SQL functions, the buckets, the backup job |
| 05 | [Database overview](svg/05-data-overview.svg) · [source](05-data-overview.puml) | Class | The 18 business tables, seven auth tables and their relationships |
| 06 | [Fleet, photos, damage, maintenance](svg/06-data-fleet.svg) · [source](06-data-fleet.puml) | Class | Fields of `vehicles`, `condition_baselines`, `photos`, `damages`, `maintenance_records` |
| 07 | [Clients, contracts and their terms](svg/07-data-contracts.svg) · [source](07-data-contracts.puml) | Class | Fields of `clients`, `client_documents`, `contracts`, `contract_drivers`, `contract_revisions`, `terms_versions` |
| 08 | [What each handover records](svg/08-data-evidence.svg) · [source](08-data-evidence.puml) | Class | Fields of `inspections`, `signatures`, `stored_signatures`, `contract_documents` |
| 09 | [Contract lifecycle](svg/09-contract-states.svg) · [source](09-contract-states.puml) | State machine | Draft, active (on rental, Retour in progress), closed, void |
| 10 | [Vehicle lifecycle](svg/10-vehicle-states.svg) · [source](10-vehicle-states.puml) | State machine | Available, rented, maintenance, archived |
| 11 | [Départ](svg/11-sequence-depart.svg) · [source](11-sequence-depart.puml) | Sequence | US-050 to US-058 and US-044, from choosing the car to sharing the sealed PDF |
| 12 | [Retour](svg/12-sequence-retour.svg) · [source](12-sequence-retour.puml) | Sequence | US-070 to US-076 and US-044, with the mandatory signature, the stored signature and « en attente de signature » |
| 13 | [Hosting options](svg/13-hosting-options.svg) · [source](13-hosting-options.puml) | Deployment sketch | The four options of F-11 side by side; C chosen |

## Conventions

- **Colours** (shared look in [`style.iuml`](style.iuml)): gold for the company's account (Apple), blue-grey for the developer's accounts (F-02), a dashed outline for an option not chosen, a bold black outline for a phone or computer. On the hosting sketch, red marks what the developer would build or run himself.
- **Names:** tables and columns are the working names from [US-006](../stories/US-006-core-database-schema-and-storage.md). Once the migrations exist, they are the reference and the class diagrams follow them.
- **IDs in labels** (US-xxx, ADR-xxxx, F-xx, R-xx) tie each element back to the backlog and the open questions.
- **PlantUML pitfalls:** font sizes must be whole numbers (a size like 10.5 is misread and blows the text up), and class attributes that contain brackets start with `{field}`, otherwise PlantUML draws them as methods.

## Regenerate

Needs Java 17 or later, Graphviz, [PlantUML](https://plantuml.com/download) (drawn with 1.2026.8), the Inter font, and Python 3 with Playwright and its Chromium (`pip install playwright`, then `playwright install chromium`). From the repository root:

```bash
PLANTUML_JAR=/path/to/plantuml.jar python3 docs/architecture/build_pdf.py
```

This renders every `NN-*.puml` to `svg/` and prints `architecture.pdf`. The page titles and key points are in [`build_pdf.py`](build_pdf.py). Commit the sources, the SVG files and the PDF together.

## When to update

- [US-004](../stories/US-004-api-server-and-environments.md) keeps the system, back-end and sequence diagrams up to date as API routes are added.
- [US-006](../stories/US-006-core-database-schema-and-storage.md) keeps the class diagrams in step with the migrations.
- [US-050](../stories/US-050-start-a-depart.md) and [US-070](../stories/US-070-start-a-retour.md) check the Départ and Retour sequences against the flows as built.
- A change to an ADR that alters a diagram updates the diagram in the same pull request.

## Local implementation status (US-004 part 1)

Diagrams 01 and 04 describe the planned production deployment and its business
flows. The local foundation is now in `deploy/compose.local.yml`: PostgreSQL 17,
Garage, Mailpit, unmodified Documenso CE with database file storage, and Fastify.
Documenso is no longer part of the design ([ADR-0023](../adr/0023-signatures-in-the-app-sealed-by-the-api.md));
a follow-up ticket removes it from the local stack.
`GET /api/health` (also HEAD) probes the app database and private storage; these
are public API routes. US-010/012/015 now add the six exact sign-in/continuation
POST exceptions; all other routes require a current active staff session.
No production component or business sequence was added by this slice, so its
PlantUML sources and generated production diagrams are unchanged. See the
[local deployment guide](../../deploy/README.md) for startup and service ports.

## Physical schema (US-006 part 1)

Class diagrams 05–08 now follow the migrations in `db/migrations/`. Every table
has a UUID key and creation metadata. Contract terms are flattened typed
columns: renter/additional-driver snapshots use the client field names with
prefixes, rates use `rate_`, and PricingLines uses `pricing_` on revisions and
`final_pricing_` on inspections. See the field map's physical-column appendix.
The overview includes staff, audit and yearly-counter fields. Cardinalities
show completed business records; feature functions enforce required photo-set
completeness after staged inserts. Storage routes and lifecycle functions are
not implemented by this schema slice.

## Staff authentication (US-010/012/015 server side)

Diagram 05 also includes Better Auth identity, credential, session, verification,
factor, restricted-flow and limiter storage. Business-table creation metadata
still applies to the 18 business tables; auth records use the library's schema.
Profiles retain their optional unique auth link and gain `active`. Native
sessions need a factor at every new sign-in and roll to 30 days idle, capped at
90 days from original authentication. Complete web sessions need a factor at every
sign-in and have 30-minute idle/12-hour absolute expiry. Pending native/web contexts
cannot pass business-route guards. Every request reads Postgres; no session
cookie cache bypasses revocation. [API contract](../../api/README.md) and
[operator runbook](../runbook.md) describe implemented endpoints and commands.
Audit-event generation still waits for US-007; commands have a transactional
integration hook. Screens/device integration remain frontend work.

The native and web flows share one enrollment; completing it invalidates other
pending enrollment contexts. Failed passwords have an HMAC-keyed account budget
shared across transports as well as per-IP limits; only the configured immediate
Caddy peer may supply client IPs. Runtime cannot change profile activation.
