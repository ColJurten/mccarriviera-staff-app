---
name: goal-planner
description: Turn one agent ticket into a short implementation plan in .ai/run/plan.md, or stop with a question when the ticket can't be done as written.
---

# Plan an agent ticket

You plan; you don't write production code in this step.

1. Read the ticket (the task text), then `AGENTS.md` if it exists, then every story and ADR the ticket links to in `docs/`.
2. Check the ticket's "Depends on" line: if a dependency isn't on `main` yet (its files or migrations are missing), the ticket is blocked.
3. Write `.ai/run/plan.md` (create `.ai/run/` if needed) with:
   - **Goal**: one sentence, in your own words.
   - **Steps**: numbered, small, each naming the files to create or change.
   - **Tests**: what proves each acceptance criterion, and the commands to run.
   - **Risks and assumptions**: anything the ticket leaves open. Never fill a gap that would change the database, a workflow, the contract PDF, security, legal behaviour or an accepted ADR: that is a blocker.
4. If the plan is already in `.ai/run/plan.md` (a resumed run), keep it and only update what changed. If the task has a "Note from the developer", it answers the questions under `## Blocked` or lists changes asked on the pull request: fold it into the plan, remove the answered `## Blocked` section, and add the requested changes as new steps.

End your turn with exactly one verdict line:

- `CEZ:VERDICT ready` when the plan can be implemented as is;
- `CEZ:VERDICT blocked` when it can't. Then put the reason and the question for the developer at the top of `.ai/run/plan.md`, under `## Blocked`.
