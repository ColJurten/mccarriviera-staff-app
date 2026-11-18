# US-007 · Record an audit trail and protect signed data

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E0 · Foundations | Must | P0 | M | To do |

- **Depends on:** [US-006](US-006-core-database-schema-and-storage.md)
- **Decisions:** [ADR-0007](../adr/0007-contract-lifecycle-and-audit.md) · [ADR-0012](../adr/0012-authentication-and-authorisation.md)
- **Open points:** L-03 (see [open questions](../discovery/open-questions.md))

## Story

As the company, I want every change to business data recorded with who and when, and signed data impossible to modify, so that contracts stay trustworthy and disputes can be investigated.

## Acceptance criteria

- [ ] Triggers on business tables add a row to `audit_events` with the server time, the actor (the staff user, set by the API for each transaction), the action, the table, the row ID, and the values before and after (JSON).
- [ ] The tables protected in US-006 reject UPDATE and DELETE from the app, and status columns change only through SQL functions. Tests prove it.
- [ ] Audit rows hold references to files, never the files themselves.
- [ ] The runbook has SQL snippets to see the audit trail of a contract, a vehicle or a client.
- [ ] All audit and signature timestamps come from the server, not from the phone's clock.
- [ ] Audit rows contain personal values (before and after). Their anonymisation follows the retention procedure ([US-094](US-094-retention-and-erasure.md)).

## Implementation (ticket #9; US-007/012/015, ADR-0007/0012)

`20261117000000_audit_trail.sql` installs row audit triggers, mandatory
transaction-local profile attribution and server-owned audit/signature times.
The API uses `withActor` for business transactions; bootstrap allocates its UUID
before its self-attributed profile insert. Catalog tests discover every business
table independently and reject missing/disabled triggers. New migrations attach
`business_mutation_audit`; no privileged DDL event trigger is required.

The developer confirmed on 2026-11-18 that auth-only sign-in, factor and limiter
transactions have no staff actor and create no business audit rows. Exclusions
are exactly `auth_users`, `auth_accounts`, `auth_sessions`, `auth_verifications`,
`auth_two_factors`, `auth_flows` and `auth_rate_limits`, plus audit self-recursion
and migration bookkeeping. `staff_profiles` is audited; an `auth_*` prefix alone
never excludes a future business table. Failed sign-ins are never attributed to
the account they targeted, and no system profile is invented.

## Staff account command integration (tickets #7 and #9)

The transactional `pendingAuthAudit` hook in
[`api/src/auth-audit.ts`](../../api/src/auth-audit.ts) now invokes the owner-only,
allowlisted SQL writer for account creation, deactivation, reactivation, password
reset and factor reset. Every command requires an actor, including auth-only
resets. Command events contain only action/target IDs; profile mutation snapshots
are recorded separately. Writer failure rolls back the whole command.
Credentials, tokens, TOTP secrets and backup codes never enter audit payloads.

This supplies the deferred audit implementation of US-012 AC4 and US-015's
factor-reset criterion. The [runbook](../runbook.md) includes parameterized
contract, vehicle, client and staff history queries. Database/API integration
checks cover event contents, rollback, pool reuse, bootstrap, credential
exclusion and existing evidence/status protections. Acceptance checkboxes stay
unchanged for human review. Frontend and policy criteria remain separate;
anonymisation is US-094, and withdrawal/lifecycle functions belong to the
Départ/Retour/maintenance stories.
