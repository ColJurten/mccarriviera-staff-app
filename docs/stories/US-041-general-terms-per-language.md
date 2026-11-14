# US-041 · Manage the general terms (CGV) per language

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E4 · Contract document | Must | P2 | S | To do |

- **Depends on:** [US-006](US-006-core-database-schema-and-storage.md)
- **Decisions:** [ADR-0011](../adr/0011-localisation.md) · [ADR-0010](../adr/0010-contract-pdf-generation.md)
- **Open points:** R-17, L-02 (see [open questions](../discovery/open-questions.md))

## Story

As the company, I want the general terms stored as versioned texts in French and English, so that each contract prints the version that applied when it was signed.

## Acceptance criteria

- [ ] The `terms_versions` table holds the language, a version label, the effective date, and the HTML body split into pages with explicit page breaks, so pagination is predictable. The active version for each language is the latest effective one.
- [ ] The French text of the current contract is loaded as FR v1: [`contract-template/terms/cgv-fr-v1.md`](../contract-template/terms/cgv-fr-v1.md), typed from the scan on 2026-11-02 and split into pages. Words cut off by the scan are marked […]; the client's source file fills them before go-live (T-02).
- [ ] EN v1 is loaded once the client provides an approved translation (R-17). Until then, an English PDF can't be generated, and the app says why (default for R-17).
- [ ] Each contract revision stores the IDs of the terms versions in force at signature, per language. There is no English ID if no approved text existed then.
- [ ] The developer loads a new version with a command, run with the database owner's connection and attributed to a staff profile, because each version records who created it and a migration can't name a staff profile (`RECOMMENDED`). The API's own database role can't add or change a version. The local seed uses the same code. There is no in-app editor in the MVP.

## Notes

- The lawyer's update of the terms (L-02) produces FR v2. Contracts signed earlier keep v1.
