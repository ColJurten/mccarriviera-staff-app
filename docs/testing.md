# Testing

US-002 establishes the check pipeline for [ADR-0016](adr/0016-repository-environments-ci.md).
Only one trivial Vitest smoke test per workspace runs today. These prove the
runner is wired, not application behaviour. No database, API, PDF, browser or
iPhone suite exists yet; add those with their implementation stories.

Use synthetic data throughout, including fixtures, PDFs, screenshots and logs.
Never copy scanned customer documents into tests. Keep credentials out of test
output and artifacts.

## Running checks

Use the Node and pnpm versions in the root guidance. Run `pnpm install` and
`pnpm check` from the root. The latter runs strict typechecking, ESLint,
Prettier and every workspace's tests, and fails if any check fails. Run
`pnpm --filter @mccarriviera/shared test` to target one package.
CI runs the same checks after `pnpm install --frozen-lockfile` on every pull
request and push to main, with the pnpm store cached. No services or secrets
are needed for the placeholder tests.

## Unit tests

Use Vitest for small, isolated tests of shared schemas, validation and pure
logic as they arrive. Test boundary values and rejected inputs as well as happy
paths. App components and FR/EN translation-key parity checks arrive with the
app and localisation stories. Every workspace currently has its own smoke test.

## Database tests

With the database stories, apply migrations from scratch to disposable Postgres
of the same major version as production, then load synthetic seeds. Test
constraints, grants and SQL functions, including atomic transitions, immutable
signed data, audit entries and rejected operations. Regenerate database types
and fail CI if committed types differ. Tear down the database after the run;
never target staging or production for destructive tests.

## API tests

With the Fastify API, exercise requests through its test injection interface and
use disposable services for integration cases. Verify every protected route
requires an active staff session, rejects missing, expired or revoked sessions,
and enforces authorisation. Cover validation, transaction failures, signing and
private storage access without real credentials or customer data.

## Contract PDF tests with Chromium

With the PDF story, render synthetic FR/EN contract cases using the server's
Chromium renderer and pinned fonts/version. Check explicit A4 pages, overflow,
long fields, accents, photo annexes and signature placement. Compare snapshots
for departure, return and amendment pages; review intentional visual changes.
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
- Documenso opens correctly, one drawn signature fills the required pages,
  mandatory departure/return signing completes, and cancellation resumes safely.
- Sealed PDF retrieval and the native share sheet, including cancel and retry.
- Network loss, recovery and duplicate taps without duplicate state changes;
  the app explains its online-only requirement.
- Main departure/return flows match the browser version, and no customer data
  remains in app storage or visible after sign-out.

Device execution is not applicable to US-002, which introduces no user-facing
behaviour. Later PRs record both automated results and relevant device/browser
evidence in their testing notes.
