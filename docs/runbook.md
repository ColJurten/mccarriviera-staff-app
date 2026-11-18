# Staff accounts (US-010, US-012, US-015)

Developer-only commands, using the server's protected environment and owner
`MIGRATION_DATABASE_URL`. The running API uses restricted `DATABASE_URL`.
Apply migrations first. No public signup, account-administration or e-mail reset
endpoint exists. The frontend, device cleanup and lost-device policy (L-03)
remain separate work. Never run acceptance tests against staging/production.

Load the external environment as in [deploy](../deploy/README.md). Create a
mode-600 password file outside every checkout using a password manager or hidden
terminal input. Never put a password on the command line, in shell history,
environment examples or logs. A command accepts `--password-file` only, requires
a regular file without group/other access, refuses symlinks and bounds input.
Passwords are 12–128 characters; one trailing line ending is ignored.

From the repository root, using synthetic data locally:

```sh
pnpm --filter @mccarriviera/api staff create \
  --email staff@example.com --name 'Synthetic Staff' \
  --bootstrap --password-file /private/outside-checkout/staff-password
```

`--bootstrap` is only for the first auth account. Its profile is self-attributed,
matching the existing bootstrap convention. The command prints its new profile
UUID; record that ID in the protected operator session. Later commands require
`--actor <profile UUID>` of an active profile to attribute the developer's action.
The profile UUID and fixed reason codes are safe operator output; names, e-mails,
passwords and tokens are never printed. Success is reported only after commit.

```sh
pnpm --filter @mccarriviera/api staff create \
  --email another@example.com --name 'Another Synthetic Staff' \
  --actor <actor-profile-uuid> --password-file /private/outside-checkout/staff-password
pnpm --filter @mccarriviera/api staff deactivate --staff <staff-profile-uuid> --actor <actor-profile-uuid>
pnpm --filter @mccarriviera/api staff reactivate --staff <staff-profile-uuid> --actor <actor-profile-uuid>
pnpm --filter @mccarriviera/api staff reset-factor --staff <staff-profile-uuid> --actor <actor-profile-uuid>
pnpm --filter @mccarriviera/api staff reset-password --staff <staff-profile-uuid> --actor <actor-profile-uuid> \
  --password-file /private/outside-checkout/new-staff-password
```

Replace angle-bracket placeholders before running. After a lost phone or a staff
departure, run `deactivate` immediately: it sets the profile inactive and deletes
all native/web sessions, pending flows and the plugin's challenge records in
one transaction. The next request fails. Reactivation leaves revoked sessions
revoked; staff must sign in again. If the last active account has been disabled,
the developer can attribute reactivation to an existing historical/seed operator
profile; keep an operator profile active. Production bootstrap/handover procedures
will be completed with US-093.

`reset-factor` removes the encrypted TOTP secret and backup codes, clears the
enabled flag, and revokes every native/web session and challenge. The next
sign-in in either mode must enroll again. `reset-password` hashes
the new password with Better Auth and revokes every session/challenge too.
The developer and staff member do the first sign-in and TOTP enrollment together,
on either iPhone or web, and repeat this paired procedure after `reset-factor`.
The staff member verifies the authenticator code before business access and keeps
the backup codes privately in their password manager or another safe place.
Never copy their TOTP secret or backup codes into developer notes or support logs.
Every later new sign-in still needs a factor; Face ID only unlocks the app locally.

Share initial/reset passwords through a protected channel outside this tool;
remove the temporary password file after provisioning.

Each completed command writes one semantic event through the transactional
`pendingAuthAudit` hook in `api/src/auth-audit.ts`: `staff_created`,
`staff_deactivated`, `staff_reactivated`, `staff_password_reset` or
`staff_factor_reset`. Business triggers additionally record profile INSERT/UPDATE
snapshots. The command sets `app.actor_id` locally on its transaction before any
writes; bootstrap allocates its profile UUID first and uses that same actor for
both events. A missing/invalid actor or audit failure rolls back credentials,
profiles and revocations together. Semantic payloads contain only the action and
target profile UUID. Never attach passwords, addresses, session tokens, TOTP
secrets or backup codes.

Keep `AUTH_SECRET` stable in protected server configuration: it encrypts factor
material and flow cookies. Losing/changing it makes existing factor material
unreadable. A deliberate rotation must revoke sessions/flows and reset affected
factors through the commands before staff reenroll; key rotation automation and
backup restoration belong to the deployment/operations stories.

## Reading the audit trail (US-007, ticket #9)

Use a protected SQL session with read access, never application logs. Audit JSON
contains personal before/after values; apply the US-094 retention procedure when
it is implemented. File values are paths, UUIDs, hashes and metadata, never file
bytes. No credential tables are audited. Failed/unknown-account sign-ins and
factor/limiter writes have no staff actor and create no business audit events.
The seven exclusions are `auth_users`, `auth_accounts`, `auth_sessions`,
`auth_verifications`, `auth_two_factors`, `auth_flows` and `auth_rate_limits`;
`staff_profiles` is audited. A future `auth_*` name does not imply exclusion.

Run these parameterized statements once per SQL session, then `EXECUTE` with the
relevant UUID. Read both JSON snapshots so deletes and changed links stay visible.
Each result is ordered by database time and event UUID. Rows before the audit
migration have no backfilled history. These queries include the history of linked
rows; their timestamps need not fall within the rental's duration.

Contract history includes revisions, drivers, inspections, documents, signatures,
found damage, inspection baselines and their photos:

```sql
PREPARE contract_audit(uuid) AS
WITH direct AS (
  SELECT DISTINCT e.table_name, e.row_id
  FROM audit_events e
  CROSS JOIN LATERAL (VALUES (e.before_values), (e.after_values)) v(data)
  WHERE (e.table_name = 'contracts' AND e.row_id = $1)
     OR v.data->>'contract_id' = $1::text
     OR v.data->>'found_contract_id' = $1::text
), baselines AS (
  SELECT DISTINCT (v.data->>'baseline_id')::uuid AS id
  FROM audit_events e
  CROSS JOIN LATERAL (VALUES (e.before_values), (e.after_values)) v(data)
  WHERE e.table_name = 'inspections' AND v.data->>'contract_id' = $1::text
    AND v.data->>'baseline_id' IS NOT NULL
), related AS (
  SELECT * FROM direct
  UNION SELECT 'condition_baselines', id FROM baselines
  UNION
  SELECT e.table_name, e.row_id FROM audit_events e
  CROSS JOIN LATERAL (VALUES (e.before_values), (e.after_values)) v(data)
  WHERE e.table_name = 'photos' AND (
    EXISTS (SELECT FROM direct d WHERE
      (d.table_name = 'inspections' AND v.data->>'inspection_id' = d.row_id::text)
      OR (d.table_name = 'damages' AND v.data->>'damage_id' = d.row_id::text))
    OR EXISTS (SELECT FROM baselines b WHERE v.data->>'baseline_id' = b.id::text))
)
SELECT e.* FROM audit_events e JOIN related r USING (table_name, row_id)
ORDER BY e.created_at, e.id;
```

Vehicle history includes its baselines, maintenance, damage, contract headers and
reference/damage/dashboard photos (including historical links):

```sql
PREPARE vehicle_audit(uuid) AS
WITH direct AS (
  SELECT DISTINCT e.table_name, e.row_id FROM audit_events e
  CROSS JOIN LATERAL (VALUES (e.before_values), (e.after_values)) v(data)
  WHERE (e.table_name = 'vehicles' AND e.row_id = $1)
     OR v.data->>'vehicle_id' = $1::text
), inspections_for_vehicle AS (
  SELECT DISTINCT e.row_id FROM audit_events e
  CROSS JOIN LATERAL (VALUES (e.before_values), (e.after_values)) v(data)
  JOIN direct d ON d.table_name = 'contracts' AND v.data->>'contract_id' = d.row_id::text
  WHERE e.table_name = 'inspections'
), related AS (
  SELECT * FROM direct
  UNION SELECT 'inspections', row_id FROM inspections_for_vehicle
  UNION
  SELECT e.table_name, e.row_id FROM audit_events e
  CROSS JOIN LATERAL (VALUES (e.before_values), (e.after_values)) v(data)
  WHERE e.table_name = 'photos' AND (
    EXISTS (SELECT FROM direct d WHERE
      (d.table_name = 'condition_baselines' AND v.data->>'baseline_id' = d.row_id::text)
      OR (d.table_name = 'damages' AND v.data->>'damage_id' = d.row_id::text))
    OR EXISTS (SELECT FROM inspections_for_vehicle i WHERE v.data->>'inspection_id' = i.row_id::text))
)
SELECT e.* FROM audit_events e JOIN related r USING (table_name, row_id)
ORDER BY e.created_at, e.id;
```

Client history includes document references and contract-driver links. To inspect
the corresponding signed snapshots, use those contract IDs with `contract_audit`:

```sql
PREPARE client_audit(uuid) AS
WITH related AS (
  SELECT DISTINCT e.table_name, e.row_id FROM audit_events e
  CROSS JOIN LATERAL (VALUES (e.before_values), (e.after_values)) v(data)
  WHERE (e.table_name = 'clients' AND e.row_id = $1)
     OR v.data->>'client_id' = $1::text
)
SELECT e.* FROM audit_events e JOIN related r USING (table_name, row_id)
ORDER BY e.created_at, e.id;
```

Staff-account history includes automatic profile mutations and all five semantic
commands. Password/factor resets appear even when no profile column changes.
`actor_id` identifies who ran the command; `row_id` identifies its target:

```sql
PREPARE staff_audit(uuid) AS
SELECT * FROM audit_events
WHERE table_name = 'staff_profiles' AND row_id = $1
ORDER BY created_at, id;
```

For example, after replacing this synthetic UUID with the required record ID:

```sql
EXECUTE contract_audit('00000000-0000-4000-8000-000000000001');
EXECUTE vehicle_audit('00000000-0000-4000-8000-000000000001');
EXECUTE client_audit('00000000-0000-4000-8000-000000000001');
EXECUTE staff_audit('00000000-0000-4000-8000-000000000001');
```
