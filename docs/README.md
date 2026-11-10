# MC Car Riviera staff app: documentation

> **Phase: decisions recorded, backlog ready (2026-10-07; updated 2026-10-09, 2026-11-02, 2026-11-03 and 2026-11-10).** On 2026-11-03 the back end moved from Supabase to the developer's own API, Postgres and S3 at Scaleway. On 2026-11-10, after the spike and a client meeting, signatures moved from Documenso into the app (the API stamps and seals the PDF), and the contract PDF, the photos and the damage records changed (F-22 to F-28). The blocking questions are answered and recorded as
> ADRs, and the MVP backlog is written as user stories. Both were reviewed independently and corrected. Some business
> rules and follow-ups are still open. For those, the backlog uses explicit defaults, listed in
> [`discovery/open-questions.md`](discovery/open-questions.md) § Defaults.
> Nothing in this folder is a decision unless it is tagged `CONFIRMED` or recorded in an ADR with status *Accepted*.

## The project in one paragraph

MC Car Riviera, a car-rental company in Juan-les-Pins (France), gets an internal iPhone app for its two employees,
running on their personal phones, and the same app on the web for their laptops and the agency computer. It replaces the paper « Contrat / Facture location » they fill in today:

- Staff run a **Départ** (check-out) and a **Retour** (check-in).
- The client signs once on the phone or in the web app; the API stamps the signature on every page and seals the PDF.
- The app produces the contract PDF in **French or English**, and staff share it through the iOS share sheet.
- The app also holds the **vehicle inventory** (statuses, maintenance, reference photos, damage), the **client records** with their documents, and every **contract** with its revisions.
- Billing and payment stay outside the app.

## Decisions at a glance

| Topic | Decision | ADR |
|---|---|---|
| App technology | React Native + Expo (TypeScript), built in the cloud, so no Mac is needed | [0002](adr/0002-mobile-stack-expo.md) |
| Distribution | Ad Hoc builds on the staff's registered personal iPhones (Developer Mode on), under the company's Apple account (F-02) | [0003](adr/0003-ios-distribution-ad-hoc.md) |
| Web app | The same Expo code built for the web, with every feature of the iPhone app, at go-live (F-19). Password + second factor, idle sign-out, nothing kept in the browser. Analytics and an admin panel after the MVP | [0021](adr/0021-web-app.md) |
| Backend | The developer's own API (TypeScript, Fastify), a managed Postgres and S3 storage at Scaleway in Paris (F-11 option C, F-12, F-14); staging on his homelab; names on `developerworkshop.online`; e-mail through turboSMTP (F-15); hosting paid by the developer, about €25–30 a month (F-07). Replaces Supabase (ADR-0004) | [0019](adr/0019-backend-own-api-postgres-s3.md) |
| Connectivity | Online only; no offline mode | [0005](adr/0005-online-only.md) |
| Scope | Contract only. Prices, totals, costs and number of days typed by staff (F-06). No billing or payment. Card fields kept, but only the last four digits and the expiry date; never a full number or a CVV (F-09) | [0006](adr/0006-contract-only-scope.md) |
| Contracts and vehicles | Signed data never changes. Amendments are revisions, recorded in the app, not printed (F-22). A contract waiting for signature can still take new photos and damage (F-26). State changes only through SQL functions, called by the API. Full audit trail | [0007](adr/0007-contract-lifecycle-and-audit.md) |
| Vehicle condition | Reference photos reused at Départ: front, rear, left and right required, the rest optional (F-23). Damage records, including damage found at the Départ (F-25). Optional estimates on new damage, indicative or billed (F-24). New reference set after a repair. Replaces ADR-0008 | [0024](adr/0024-vehicle-condition-four-angles-estimates.md) |
| Signatures | The client draws once on a pad in the app; the API stamps the drawing in the box at the bottom right of every page and seals the PDF with a self-signed company certificate and a timestamp (F-08, F-17, F-27). Departure and return signatures are both mandatory (F-04); the final PDF repeats the departure drawing. Optional stored Retour signature, switched on per company, for a client who can't wait for the end of the inspection (F-28). Replaces ADR-0020 (Documenso) | [0023](adr/0023-signatures-in-the-app-sealed-by-the-api.md) |
| PDF | Rendered on the API server with Chromium (F-13), from versioned HTML templates, in the language chosen in the preview before signing (F-17): model layout, every field of both forms (R-02), explicit A4 pages, full-size photo annex. Template v2 in [`contract-template/`](contract-template/README.md): page 1 with the pricing, no amendment pages, new damage first (F-22, F-24) | [0010](adr/0010-contract-pdf-generation.md) |
| Languages | Language-neutral data, FR/EN catalogues, versioned general terms | [0011](adr/0011-localisation.md) |
| Access and phones | Personal accounts (better-auth in the API), Face ID lock on the iPhone, a second factor on the web, every request checked by the API, revocation from the server, minimum data on phones | [0012](adr/0012-authentication-and-authorisation.md), [0013](adr/0013-personal-device-data-protection.md) |
| Files | Private Scaleway Object Storage buckets (F-11); evidence can be uploaded and read but never overwritten or deleted; presigned links issued by the API, valid for 5 minutes at most | [0014](adr/0014-file-storage.md) |
| Backups | Nightly encrypted dumps of the database plus incremental file copies, with a different provider, which the server's keys can't delete | [0015](adr/0015-backups.md) |
| Repository and delivery | One repository (app, API, shared package, migrations, deployment); local, homelab staging and Scaleway production; CI with PDF tests; EAS builds and over-the-air updates | [0016](adr/0016-repository-environments-ci.md) |
| Crash reporting | Sentry in the EU, with personal data removed | [0017](adr/0017-crash-reporting.md) |
| Development and testing | Android emulator on Windows for day-to-day work; iOS checks on a registered test iPhone (the developer's partner's) | [0018](adr/0018-development-and-test-devices.md) |

## Read order (people and coding agents)

1. [`glossary.md`](glossary.md): the French/English rental vocabulary used everywhere.
2. [`adr/README.md`](adr/README.md): the decisions, and why they were taken. The UML diagrams are in [`architecture/`](architecture/README.md), also as one PDF: [`architecture/architecture.pdf`](architecture/architecture.pdf).
3. [`contract-template/README.md`](contract-template/README.md): the new contract PDF (template v2), its field map and specimen PDFs.
4. [`stories/README.md`](stories/README.md): the backlog, with phases, Definition of Ready and Done, every story, and the post-MVP list.
5. [`discovery/open-questions.md`](discovery/open-questions.md): what is still open, follow-ups F-01 to F-20, and the defaults in use.
6. [`discovery/source-analysis.md`](discovery/source-analysis.md): what the reference documents contain (field inventory, signature zones, general-terms rules).

## Folder layout

```
docs/
├── README.md               this file
├── glossary.md             FR/EN rental vocabulary
├── adr/                    architecture decision records, one per file, plus an index
├── architecture/           UML diagrams (PlantUML sources) and the architecture PDF
├── contract-template/      the contract PDF template v2: field map, HTML/CSS, FR/EN labels, terms, specimens
├── stories/                user stories, one per file, plus the backlog index
└── discovery/
    ├── source-analysis.md  analysis of the reference documents
    └── open-questions.md   questions, answers, follow-ups, defaults
```

## Conventions

| Tag | Meaning |
|---|---|
| `CONFIRMED` | Stated in the brief, by the client, or visible in a reference document. The source is cited. |
| `RECOMMENDED` | Technical recommendation that no question asked about. It can be changed. |
| `ASSUMPTION` | Working hypothesis that must be confirmed. It always links to a question ID. |
| `OPEN` | Undecided. See the linked question. |
| `INTERPRETATION` | A reading of an ambiguous source or answer. It needs confirmation. |
| "default for X-nn" | A default applied to an open question so work can start. All defaults are listed in open-questions § Defaults. |

Question IDs: `B-xx` blocking (answered) · `F-xx` follow-up · `R-xx` business rule · `T-xx` technical · `N-xx` nice to clarify · `L-xx` external (legal/accounting) confirmation. Contradiction IDs: `C-xx`.
Story IDs: `US-NNN`, where the tens digit is the epic. ADR IDs: `ADR-NNNN`.

Diagrams are Mermaid code blocks. They render on GitHub and GitLab and stay readable as text for agents.

### Rules for coding agents

- Work from a story file. Read the ADRs it links, and check its open points before you start.
- Don't invent requirements. If something is `OPEN` and has no default, ask.
- Signed contractual data is never overwritten. Changes create revisions, and state changes go through SQL functions called by the API ([ADR-0007](adr/0007-contract-lifecycle-and-audit.md)).
- Never put real customer data in the repository, fixtures, seeds, screenshots, logs or tests, including data from the scanned reference documents. Use synthetic data.
- When code and docs disagree, raise it. Don't silently "fix" the docs to match the code.
- A changed decision means a new ADR that supersedes the old one ([ADR-0001](adr/0001-record-architecture-decisions.md)).

## Main risks

| Risk | Mitigation |
|---|---|
| A missed yearly Apple renewal stops the app on both phones | Runbook with a reminder 30 days ahead ([ADR-0003](adr/0003-ios-distribution-ad-hoc.md), US-093) |
| Staff refuse Developer Mode or the yearly reinstall on their personal phones | Fallback to an Unlisted App Store app (F-03) |
| Company enrolment with Apple is slow, or the company has no website on its own domain | Start on day one; individual membership only as a temporary fallback (F-02, US-001) |
| No Mac to investigate native crashes | Development builds, EAS logs and crash reporting ([ADR-0017](adr/0017-crash-reporting.md)) |
| The test iPhone is borrowed and not always at hand | Android emulator for day-to-day work; iOS checks on the iPhone within each story ([ADR-0018](adr/0018-development-and-test-devices.md)) |
| A staff phone turns out too old for the app | Models and iOS versions checked at registration (F-01, US-001) |
| A car returned without its client stays « En cours » until the client signs | The company's process (B-08); the Retour data is saved meanwhile (F-04, US-070) |
| Stamping and sealing in the API don't work as needed (one drawing on every page, PAdES seal, timestamp) | Spike first (US-009, part 2), before any feature builds on it ([ADR-0023](adr/0023-signatures-in-the-app-sealed-by-the-api.md)) |
| The stored Retour signature is contested: the client didn't see the new damage or the final amounts | Off by default, switched on per company, single use, an authorisation the client signs, and the lawyer's review (F-28, L-01, [ADR-0023](adr/0023-signatures-in-the-app-sealed-by-the-api.md)) |
| Page 1, now holding the pricing, overflows with long values | Field limits and a maximum-length PDF test on page 1 ([ADR-0010](adr/0010-contract-pdf-generation.md)) |
| The PDF layout breaks (overflow) | Explicit pages, field limits, and PDF tests rendered with Chromium in CI ([ADR-0010](adr/0010-contract-pdf-generation.md)) |
| The developer builds and runs the whole back end: API, logins, server, PDF sealing | Managed Postgres, pinned images, automatic system updates, uptime checks, staging first, runbook ([ADR-0019](adr/0019-backend-own-api-postgres-s3.md), US-093) |
| One server: while it is down, no handover can be signed | Uptime alerts, nightly off-site backups, paper fallback (B-03a) ([ADR-0015](adr/0015-backups.md)) |
| A drawn signature is weak evidence if contested | PAdES seal with a timestamp, a signature certificate page and our evidence record; lawyer's review, including the self-signed certificate and the repeated departure image (L-01, [ADR-0023](adr/0023-signatures-in-the-app-sealed-by-the-api.md)) |
| Reused reference photos, now four required angles, are weak evidence of the condition at a given handover | Optional angles, damage records with photos (also at the Départ), optional dashboard photo ([ADR-0024](adr/0024-vehicle-condition-four-angles-estimates.md)) |
| Client data leaves the app through shared or downloaded PDFs on personal phones, laptops and the agency computer | Minimum data on the devices, nothing kept in the browser, and a written device-use rule ([ADR-0013](adr/0013-personal-device-data-protection.md), [ADR-0021](adr/0021-web-app.md), L-03) |
| One person builds, runs and holds the accounts and keys | Data processing agreement, handover procedure in the runbook, sealed copy of the backup keys for the company (F-02, US-092, US-093) |

## Where each section of the original brief now lives

| Brief section | Where it is | Written with |
|---|---|---|
| 1 Product definition · 2 MVP scope | This README, [ADR-0006](adr/0006-contract-only-scope.md), the Must stories | — |
| 3 Roles and permissions | [ADR-0012](adr/0012-authentication-and-authorisation.md) (single role, default for R-16) | — |
| 4 Départ · 5 Retour | Stories US-050–058 and US-070–076; sequence diagrams in [`architecture/`](architecture/README.md) | Kept up to date with US-050 and US-070 |
| 6 Inventory · 7 Clients · 8 Maintenance and damage | Stories US-020–026, US-030–034, US-080–083; [ADR-0024](adr/0024-vehicle-condition-four-angles-estimates.md) | — |
| 9 Screens and navigation · 10 UX recommendations | US-003, US-020 and the flow stories | `screens.md` with US-003 |
| 11 Domain model · 14 Contract lifecycle | [ADR-0007](adr/0007-contract-lifecycle-and-audit.md) (contract and vehicle state diagrams), [ADR-0024](adr/0024-vehicle-condition-four-angles-estimates.md) | — |
| 12 Database schema | Table list in US-006; class diagrams in [`architecture/`](architecture/README.md) | Kept in step with the migrations in US-006 |
| 13 File storage | [ADR-0014](adr/0014-file-storage.md) | — |
| 15 PDF · 16 Signatures · 17 FR/EN | [ADR-0010](adr/0010-contract-pdf-generation.md), [ADR-0023](adr/0023-signatures-in-the-app-sealed-by-the-api.md), [ADR-0011](adr/0011-localisation.md); template v2 and its field map in [`contract-template/`](contract-template/README.md) | Ported to the API by US-040; signing in US-043 and US-044 |
| 18 iOS architecture · 19 Backend · 24 API boundaries | [ADR-0002](adr/0002-mobile-stack-expo.md), [ADR-0019](adr/0019-backend-own-api-postgres-s3.md); deployment, component and sequence diagrams in [`architecture/`](architecture/README.md) | Kept up to date with US-004 |
| 20 Auth · 21 Security and privacy | [ADR-0012](adr/0012-authentication-and-authorisation.md) to [ADR-0015](adr/0015-backups.md), [ADR-0017](adr/0017-crash-reporting.md) | — |
| 22 Distribution · 23 Offline | [ADR-0003](adr/0003-ios-distribution-ad-hoc.md) (iPhone), [ADR-0021](adr/0021-web-app.md) (web app), [ADR-0005](adr/0005-online-only.md) | — |
| 25 Implementation phases | [`stories/README.md`](stories/README.md) (P0–P6) | — |
| 26 Testing strategy | Definition of Done; database tests (US-006, US-007, US-057); API tests (US-004, US-044); PDF tests with Chromium (US-040) | `testing.md` with US-002 |
| 27 Technical risks | § Main risks above; Consequences sections of the ADRs | — |
| 28 Legal/accounting questions | open-questions L-01–L-07; US-092 | — |
| 29 Post-MVP | [`stories/README.md`](stories/README.md) § Post-MVP | — |
| Operations | US-093, US-094 | `runbook.md` with US-093 |

## Reference material (keep out of the repository)

| Document | What it is | Note |
|---|---|---|
| `current_template.pdf` | Scan of a completed MC Car Riviera contract (3 pages) | Contains a real renter's personal data |
| `model_template.pdf` | Scan of another rental company's completed agreement (3 pages) | Layout reference only. Contains a real renter's personal data |
| `meeting_client.pdf` | Scan of the handwritten meeting notes and wireframe (1 page) | No personal data |

Store these in a restricted shared folder and refer to them by name. The analysis in `discovery/` describes their
structure without reproducing any personal data.
