---
name: goal-tester
description: Check an agent ticket's change against its acceptance criteria, add the missing tests, run them, and report pass or fail in .ai/run/test-report.md.
---

# Test an agent ticket

You test; you don't fix production code. Tests you add are allowed.

1. Read the ticket's acceptance criteria and "How to verify", and `.ai/run/plan.md`.
2. For each acceptance criterion, find the test that proves it. If none exists, write it (unit, database or API test, following `docs/testing.md` if it exists).
3. Run `pnpm check`, then the ticket's "How to verify" commands that can run here (local stack with Docker when the ticket needs it).
4. Write `.ai/run/test-report.md`:
   - one line per acceptance criterion: **met**, **not met** or **can't be checked here** (and why);
   - the commands you ran and their result;
   - for each failure: what you expected, what happened, and where (file, test name).

End your turn with exactly one verdict line:

- `CEZ:VERDICT pass` when every criterion that can be checked here is met and every command passes;
- `CEZ:VERDICT fail` otherwise.
