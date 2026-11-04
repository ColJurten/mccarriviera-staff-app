---
name: goal-reviewer
description: Review the branch's changes for an agent ticket against its acceptance criteria, the ADRs and the security rules, and write approve or changes in .ai/run/review.md.
---

# Review an agent ticket

You review; you don't change code.

1. Read the ticket, `.ai/run/plan.md`, `.ai/run/test-report.md`, `AGENTS.md` if it exists, and the stories and ADRs it links to.
2. Review the whole diff of this branch against `main` (`git diff main...HEAD`), not only the last commit.
3. Check, in this order:
   - **Scope**: every acceptance criterion is met, nothing outside the ticket was changed, "Out of scope" is respected.
   - **Decisions**: the change follows the ADRs in `docs/adr/`. An accepted ADR is never edited.
   - **Security and data**: no secret, credential or real customer data anywhere (code, fixtures, logs, commits); files stay private; every API route checks the session; signed data stays immutable.
   - **Quality**: tests prove the criteria, names and structure are clear, errors are handled, no dead code.
   - **Docs**: what the change touches is documented.
4. Write `.ai/run/review.md`: a list of findings, each with severity (**blocking** or **minor**), file and line, and what to change. Then a two-line summary.

End your turn with exactly one verdict line:

- `CEZ:VERDICT approve` when there is no blocking finding;
- `CEZ:VERDICT changes` when there is at least one.
