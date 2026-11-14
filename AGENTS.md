# Coding agent guidance

Start from [docs/README.md](docs/README.md) and follow its read order. Work from
one story, read its linked ADRs and open points, and follow the
[Definition of Done](docs/stories/README.md#definition-of-done).

The web app is built and released first, and the iPhone app follows from the
same code ([ADR-0025](docs/adr/0025-web-app-first.md)). Build screens with React
Native components only, keep device-specific code behind the platform modules,
and follow the [design reference](docs/design/README.md).

Follow the [ADRs](docs/adr/README.md). Never change an accepted ADR without
asking first (default for N-06). Stop and ask if implementation requires a
different decision; after approval, follow ADR-0001 for a superseding ADR.
Raise code/documentation disagreements instead of silently changing decisions.

Never use real customer data, including scanned reference data, in code,
fixtures, seeds, screenshots, logs or tests. Use synthetic data only.
Never commit secrets, credentials or local .env files. Keep .env.example free
of secret values; public app configuration must never contain credentials.

Use Node 22.21.1 (`nvm install && nvm use`) and pnpm 12.16.1, pinned in
package.json. Install pnpm with `npm install --global pnpm@12.16.1` if needed.
From the repository root run:

```sh
pnpm install
pnpm check
```

`pnpm check` runs strict TypeScript checks, ESLint, Prettier and tests for every
workspace. CI uses `pnpm install --frozen-lockfile`. Run `pnpm format` to format
maintained files; existing docs/assets are excluded except docs/testing.md.
See [docs/testing.md](docs/testing.md) for test layers and device checks.

Task-specific checklists for coding agents live in `.agents/skills/` (database
migrations, API routes, the contract PDF). Codex reads them there, and
`.claude/skills` links to the same folder for Claude Code. Keep one copy. They
point to the docs, which win when the two disagree.

Keep one story or goal per pull request. Cite its story and ADR IDs, describe
how it was tested, and update touched documentation. Keep unrelated refactors
out of scope. A person reviews and merges; never merge automatically.
