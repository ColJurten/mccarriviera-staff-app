# Testing

Follow [ADR-0016](adr/0016-repository-environments-ci.md) and the
[Definition of Done](stories/README.md#definition-of-done). All fixtures, seeds,
screenshots and test logs must use synthetic data, including staging. Never use
customer data or scanned reference PDFs.

## Available now (US-002)

Use Node 22.14.0 and pnpm 10.6.5. From the repository root:

```sh
pnpm install
pnpm check
```

The aggregate command runs strict TypeScript checks, ESLint, one trivial Vitest
placeholder test in each of app, API and shared, and Prettier validation. Individual
commands are `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm format:check`.
Run `pnpm format` to format maintained files. Existing documentation and contract
assets are excluded from formatting, except this new testing guide.

CI runs these checks on every pull request and push to main, using a frozen
lockfile and a cached pnpm store. These placeholders prove the checks work; they
provide no application behavior coverage. No database or browser is needed yet.

## Test layers to add with their owning stories

These suites are planned, not implemented by US-002. Each owning story must add
its tests to the aggregate checks and CI as its implementation arrives.

- **Unit tests:** exercise business rules, shared Zod schemas and isolated app/API
  logic, including invalid input and boundary cases.
- **Database tests:** apply migrations to a throwaway Postgres of the production
  major version; test constraints, grants, SQL functions, transactional state
  changes, audit records and immutability with synthetic seeds. Discard it after
  the suite; never connect tests to production.
- **API tests:** exercise routes against an isolated stack; verify session
  requirements for every protected route, invalid/revoked sessions, authorization,
  validation, expected responses and database effects.
- **Contract PDF tests:** render synthetic French and English cases with Chromium,
  the production rendering engine. Check explicit A4 pages, overflow, long and
  boundary field values, signature placement and photo annexes. Review snapshots
  against the versioned template; never approve snapshot changes blindly.
- **End-to-end tests:** build the web app and run main flows in a headless browser
  against a throwaway stack, including sign-in, Départ, signing, Retour and PDF
  access. Cover session expiry and error paths as those features arrive.
- **Consistency checks:** add translation-key parity/missing-key checks when
  catalogues arrive, and regenerate database types and fail on drift when type
  generation exists, as required by ADR-0016.

## Real-iPhone checklist for future user-facing stories

Automated tests do not replace checks on a registered real iPhone with a staging
build, as required by [ADR-0018](adr/0018-development-and-test-devices.md). Use
synthetic data and record the build, device model, iOS version, story, result and
any defects in the PR. Also demonstrate the story in a browser against staging.
Check the applicable items as each feature becomes available:

- Installation, launch, sign-in, Face ID lock, background/resume and sign-out.
- Navigation, touch targets, keyboard behavior, scrolling and validation on the
  actual screen, including long values and French accents.
- Camera/photo capture, permissions, upload and interrupted-network recovery.
- Contract preview in both languages, readable pages without clipping, signing
  gestures and signature placement, including mandatory departure/return signing.
- PDF opening, download and the native iOS share sheet.
- Session revocation, connectivity loss and safe recovery without exposing cached
  personal data or leaving a partial state change.

This repository setup has no user-facing app to demonstrate yet. Future stories
must provide the relevant device and browser evidence before human review.
