# Testing

US-002 establishes the check pipeline for [ADR-0016](adr/0016-repository-environments-ci.md).
US-004 adds API/shared contract tests, a registered-route session audit, and
real PostgreSQL 17/Garage integration checks. US-006 adds database constraints,
privileges, immutable evidence and concurrent numbering checks. US-010/012/015
add real native/web auth, second-factor and account-command tests. Other workspaces still have smoke
tests. PDF, app browser and iPhone suites arrive with their stories.

Use synthetic data throughout, including fixtures, PDFs, screenshots and logs.
Never copy scanned customer documents into tests. Keep credentials out of test
output and artifacts.

## Running checks

Use the Node and pnpm versions in the root guidance. Run `pnpm install` and
`pnpm check` from the root. The latter runs strict typechecking, ESLint,
Prettier and every workspace's tests, and fails if any check fails. Run
`pnpm --filter @mccarriviera/shared test` to target one package.
CI runs the same checks after `pnpm install --frozen-lockfile` on every pull
request and push to main, with the pnpm store cached. Unit checks need no services.
Then CI generates disposable external credentials, starts pinned PostgreSQL
17.11 and Garage 2.1.0, applies migrations twice, loads the synthetic seed twice, runs database tests, checks generated types and runs
the API integration suite. It builds the API container and removes volumes even
on failure. No deployment credentials or customer data are used.

## Unit tests

Use Vitest for small, isolated tests of shared schemas, validation and pure
logic as they arrive. Test boundary values and rejected inputs as well as happy
paths. App components and FR/EN translation-key parity checks arrive with the
app and localisation stories. Every workspace currently has its own smoke test.

## Database tests

Load the external configuration from [deploy](../deploy/README.md), apply
migrations to disposable PostgreSQL 17 (ADR-0022), and run:

```sh
pnpm db:migrate
export DB_DISPOSABLE=1
pnpm db:seed
pnpm db:seed
pnpm test --filter db
pnpm db:check
```

The integration suite requires separate owner (`MIGRATION_DATABASE_URL`) and
restricted runtime (`DATABASE_URL`) connections and fails when configuration
is absent. It verifies the 18-table catalog, types, limits, status sets, unique
active contracts, evidence ownership, owner-level immutability guards and runtime
column grants. Eight independent runtime connections exercise concurrent
reservations and same-contract retries. Tests also cover confirmation, rollback,
year separation, missing reservations and counter exhaustion. Fixtures use unique
synthetic identifiers and remain in the throwaway database. CI runs this suite
after fresh migrations and two seed runs. Never target staging or production.

US-007 adds audit-generation checks; transition-function tests arrive with their
feature stories. No iPhone or PDF feature check applies to this database-only
slice. Class-diagram SVGs and the architecture PDF are rebuilt from PlantUML
when physical columns change.

## API tests

`pnpm --filter @mccarriviera/api test` exercises Fastify injection: health
success/failures, aborted timeouts, strict input validation, sanitized logs,
OpenAPI artifact parity and actual route hook coverage (including generated
HEAD routes and a negative test with misleading metadata). The global guard
resolves current database sessions and active profiles, failing closed on storage
errors. Unit checks also cover auth schemas, sanitized dependency errors and
address normalization. Health and OpenAPI generation remain service-free.

`pnpm --filter @mccarriviera/api test:integration` requires the external local
environment and migrated services from [deploy/README.md](../deploy/README.md).
It queries the real PostgreSQL version and business schema with the restricted role, checks authenticated
access to all four app buckets, denies access to Documenso's bucket and rejects
anonymous/invalid storage credentials. Missing prerequisites fail the suite.
`pnpm db:check` regenerates types into a temporary directory and detects drift.

The same integration suite creates unique synthetic staff accounts using the
owner connection and calls real Fastify HTTP wrappers through the restricted
runtime connection. It checks native sign-in across app instances, generic
credential errors, persisted password/factor rate limits and spoofed forwarding
headers, first web enrollment, mandatory TOTP, one-use backup codes, strict
cookie flags, token non-disclosure, origin/CSRF checks and transport separation.
Database timestamps exercise native idle renewal, web idle/hard expiry and
pending-flow expiry without long sleeps. Missing/inactive profiles and revoked
sessions fail immediately. Developer tests exercise deactivation, reactivation,
factor/password reset, protected file input, transactional rollback and exactly
one audit-hook invocation per completed command. US-007 will test event persistence;
this slice's default hook explicitly persists nothing.

Run with `DB_DISPOSABLE=1`, both database URLs and the external auth settings.
Files run serially because they deliberately expire/reset the shared persisted
limiter window; individual fixtures use unique accounts and synthetic connection
addresses. Cookie tests use injection so Secure remains enabled. Browser/Keychain
and real-iPhone sign-in checks belong to the frontend stories.

For the local-stack smoke check, start the whole stack, check health and
Documenso certificate status, bootstrap the synthetic admin and request its
password-reset mail in Mailpit. Keep signup disabled. Repeat startup on existing
volumes, check database isolation, stop each API dependency and confirm HTTP 503,
then restart and confirm recovery. Container/browser checks require Docker access;
record unavailable checks explicitly. No iPhone check applies to this
infrastructure-only US-004 slice.

The auth integration inventory exercises every nonpublic registered route
without a session, including generated HEAD and prefixed plugin routes. Future
business routes extend success/refusal cases with real active, expired, revoked
and enrollment-only sessions. Cover validation, transaction failures, signing
and private storage access without real credentials or customer data.

## Contract PDF tests with Chromium

With the PDF story, render synthetic FR/EN contract cases using the server's
Chromium renderer and pinned fonts/version. Check explicit A4 pages, overflow,
long fields, accents, photo annexes and signature placement. Compare snapshots
for the departure and final PDFs, with and without a stored Retour signature;
review intentional visual changes. Render page 1 with every field at its
maximum length.
Verify the repeated departure signature never appears beside values it does not
cover. Keep the existing documentation template assets intact until their
implementation story. See [ADR-0010](adr/0010-contract-pdf-generation.md).

## End-to-end tests in a headless browser

With the web app, build its production bundle and test main flows against a
throwaway stack in a headless browser. Cover sign-in and second factor, idle
sign-out, departure, signing, active rentals, return and PDF download. Assert
French UI and both contract languages, session enforcement and browser data
cleanup. Use isolated synthetic accounts and reset services between runs.
Add this build and suite to PR CI when implemented; see
[ADR-0021](adr/0021-web-app.md).

## Real-iPhone checklist

For each story with a user-facing part, use a registered physical test iPhone
and staging build, as required by [ADR-0018](adr/0018-development-and-test-devices.md).
Record story ID, commit/build, device model, iOS version, date, tester and each
result (pass, fail or not applicable with reason). Attach synthetic evidence
and issues; never customer data. A headless browser cannot replace this check.

As the features become available, verify:

- Installation and launch, sign-in/out, Face ID, background lock and revocation.
- Navigation, touch targets, keyboard, scrolling and French text on the device.
- Camera, photo capture, document selection and uploads with permissions both
  granted and denied; no unnecessary local copies remain.
- PDF preview in FR/EN, zoom, page layout and photo annexes on the small screen.
- The signature pad works in portrait and landscape, one drawing fills every
  page, mandatory departure/return signing completes, and cancellation resumes
  safely. A change before signing produces a new preview, and only it can be signed.
- Sealed PDF retrieval and the native share sheet, including cancel and retry.
- Network loss, recovery and duplicate taps without duplicate state changes;
  the app explains its online-only requirement.
- Main departure/return flows match the browser version, and no customer data
  remains in app storage or visible after sign-out.

Device execution is not applicable to US-002, which introduces no user-facing
behaviour. Later PRs record both automated results and relevant device/browser
evidence in their testing notes.

CI first waits for PostgreSQL TCP readiness and Garage, then runs the Garage
initializer synchronously with `run --build --rm --no-deps garage-init`. Its exit status
must succeed before migration and integration checks begin. The initializer is
not selected in `up --wait`: it is a one-shot job, not a long-running service.
The API image normalizes copied file permissions before switching to `USER node`,
so pnpm-written mode-600 manifests do not prevent startup.

## Disposable Documenso API/browser spike (US-009 part 1)

The `spikes/documenso` workspace participates in `pnpm check` but is excluded
from the production Docker context. Its Vitest suite checks manifest bounds,
API failure handling, replacement refusal/partial failure, webhook authentication,
ownership, completion and duplicate delivery, image fallback and Mailpit filtering.
These service-free checks do not establish Documenso behaviour.

Follow [the spike runbook](../spikes/documenso/README.md) for the pinned Python
renderer, local stack/API token setup, Mailpit baseline, creation, replacement
and completion receiver. The tested callback helper shares Documenso’s network
namespace and forwards loopback DB access without host firewall changes. It
requires Node 22.21.1 and the pinned Node runtime image in the runbook.
Render both languages explicitly; the renderer rejects
overflow, signed boxes and FR/EN coordinate differences. Generated artifacts
and run state are ignored. Keep all credentials in mode-600 files outside every
checkout. Retain only sanitized findings in
[US-009 findings](spikes/US-009-findings.md).

Drawing once, counting field taps and Adobe Reader's seal/modified-copy checks
remain « to confirm by hand » until a person records evidence. The iPhone web
view, data cleanup and sharing checks belong to part 2. US-009's story checkboxes
remain unchanged; a person reviews them after the complete story is verified.

## Staff authentication revision (ticket #7 / PR #25)

The disposable API suite exercises native and web MFA enrollment/challenge,
one-use backup codes, mode-bound/expired/replaced flows, mandatory factors even
without browser headers, immediate deactivation/reset/revocation, and sanitized
logs. Native sessions renew for 30 days idle with a 90-day absolute deadline;
web cookies keep the 30-minute/12-hour policy. Timestamp fixtures check the caps
without long sleeps. Account/IP limit tests inject trusted/untrusted Caddy peers,
forged multi-hop chains, case variants and concurrent failures, and recreate an
app instance to check persistence. Successful passwords do not count as account
failures; expired limiter windows recover without waiting in real time.

`db` integration checks include owner-only profile activation and auth flow mode
storage. Upgrade verification applies the additive MFA migration over synthetic
legacy sessions; those password-only sessions must be removed. Audit-hook tests
remain separate from persistent audit generation, which is deferred to US-007.
