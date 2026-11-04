# Coding agent guidance

Start at [docs/README.md](docs/README.md), then read the assigned story, its linked
ADRs and open questions. Follow the accepted decisions in [docs/adr/](docs/adr/README.md)
and the story's scope and Definition of Done. Do not invent requirements.

Never change an accepted ADR without asking. If a decision needs to change, stop
and explain the question; an approved replacement decision needs a new ADR that
supersedes the old one (ADR-0001; default for N-06).

Use synthetic data only. Never use real customer data in code, fixtures, seeds,
screenshots, logs or tests, including data from scanned reference PDFs. Never
commit secrets, credentials, local environment files or scanned reference PDFs.

## Setup and checks

Use Node 22.14.0 (also in `.node-version`) and pnpm 10.6.5 (in `packageManager`).
With that Node version active, install pnpm once and ensure its global binary
directory is on your PATH (including in new shells):

```sh
npm install --global pnpm@10.6.5
pnpm --version
```

Then run at the repository root:

```sh
pnpm install
pnpm check
```

`pnpm check` runs strict typechecking, ESLint, workspace tests and formatting
validation. `pnpm format` formats maintained files. Every TypeScript package must
extend the root configuration and expose typecheck, lint and test scripts.

US-002 supplies placeholders only; Expo, Fastify and infrastructure arrive in
later stories. See [docs/testing.md](docs/testing.md) for the eventual test pipeline
and the checks currently executable.

Keep each pull request to one story or goal. Cite the story and ADR IDs, include
testing evidence, and update affected docs. Leave story checkboxes to human review.
A person reviews and merges; never merge automatically.
