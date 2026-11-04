---
name: goal-coder
description: Implement an agent ticket from .ai/run/plan.md, or fix the findings in .ai/run/test-report.md and .ai/run/review.md, within the ticket's scope.
---

# Implement or fix an agent ticket

1. Read `.ai/run/plan.md`, `AGENTS.md` if it exists, and the stories and ADRs the ticket links to. On a rework cycle, also read `.ai/run/test-report.md` and `.ai/run/review.md`, and fix every finding. On a resumed run (`## Resumed` in the plan), part of the work is already on the branch: check what is done (`git log`, the code, the tests) and only do what remains.
2. Change only what the ticket and the plan need. Respect "Out of scope". Don't rename, reformat or refactor unrelated code.
3. Follow the decisions in `docs/adr/`. Never edit an accepted ADR: if the work seems to need a different decision, stop, and write the question under `## Blocked` in `.ai/run/plan.md`.
4. Write or update the tests for what you change. Run `pnpm check` (or the narrowest equivalent) before finishing, and fix what fails.
5. Never commit secrets, credentials, real customer data or the scanned reference PDFs. Use synthetic data only.
6. Update the docs the change touches (story checkboxes stay as they are: a person ticks them after review).
7. Don't open a pull request and don't touch the GitHub board: the conductor does that. Commits are made by the checkpoints; you may also commit with clear messages.
