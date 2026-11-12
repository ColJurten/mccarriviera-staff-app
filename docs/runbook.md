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
passwords and tokens are never printed. Success output includes the audit limitation.

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

Each completed command invokes exactly one transactional `AuthAuditHook` with
`action`, `actorId`, `staffId` in `api/src/auth-audit.ts`. **Audit persistence is
pending US-007**: the default hook does nothing, and no audit event is claimed
to have been stored. US-007 must wire its agreed actor/event writer at this
seam, using the provided transaction. Hook failure rolls back the entire command.
Never attach passwords, addresses, session tokens, TOTP secrets or backup codes.

Keep `AUTH_SECRET` stable in protected server configuration: it encrypts factor
material and flow cookies. Losing/changing it makes existing factor material
unreadable. A deliberate rotation must revoke sessions/flows and reset affected
factors through the commands before staff reenroll; key rotation automation and
backup restoration belong to the deployment/operations stories.
