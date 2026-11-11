import { randomUUID } from 'node:crypto';
import { sql, type Kysely } from 'kysely';
import { z } from 'zod';
import { passwordSchema } from '@mccarriviera/shared';
import type { DB } from './db/generated.js';
import { createAuth, type AuthConfig } from './auth.js';
import {
  pendingAuthAudit,
  type AuthAuditHook,
  type AuthAuditEvent,
} from './auth-audit.js';

const creationSchema = z.strictObject({
  email: z
    .email()
    .max(254)
    .transform((value) => value.toLowerCase()),
  displayName: z.string().trim().min(1).max(80),
  password: passwordSchema,
  actorId: z.uuid().nullable(),
});
type Action = 'deactivate' | 'reactivate' | 'reset-password' | 'reset-factor';
const actions: Record<Action, AuthAuditEvent['action']> = {
  deactivate: 'staff_deactivated',
  reactivate: 'staff_reactivated',
  'reset-password': 'staff_password_reset',
  'reset-factor': 'staff_factor_reset',
};
async function revoke(db: Kysely<DB>, userId: string) {
  await db.deleteFrom('auth_sessions').where('user_id', '=', userId).execute();
  await db.deleteFrom('auth_flows').where('user_id', '=', userId).execute();
  // The plugin's challenge points at the user; removing it invalidates its
  // attempts record as well, even before that harmless record expires.
  await db
    .deleteFrom('auth_verifications')
    .where('value', '=', userId)
    .execute();
}
export function createStaffAdmin(
  db: Kysely<DB>,
  config: AuthConfig,
  audit: AuthAuditHook = pendingAuthAudit,
) {
  return {
    async create(input: z.input<typeof creationSchema>) {
      const data = creationSchema.parse(input);
      return db.transaction().execute(async (trx) => {
        // Serialize bootstrap and account creation across command processes.
        await sql`select pg_advisory_xact_lock(7110010)`.execute(trx);
        if (data.actorId) {
          await trx
            .selectFrom('staff_profiles')
            .select('id')
            .where('id', '=', data.actorId)
            .where('active', '=', true)
            .executeTakeFirstOrThrow();
        } else {
          if (
            await trx.selectFrom('auth_users').select('id').executeTakeFirst()
          )
            throw new Error('Bootstrap requires an empty account store');
        }
        const context = await createAuth(trx, config, 'native').$context;
        const user = await context.internalAdapter.createUser(
          { name: data.displayName, email: data.email, emailVerified: true },
          { method: 'email-password' },
        );
        const id = randomUUID();
        const actorId = data.actorId ?? id;
        await trx
          .insertInto('staff_profiles')
          .values({
            id,
            created_by: actorId,
            display_name: data.displayName,
            auth_user_id: user.id,
            active: true,
          })
          .execute();
        await context.internalAdapter.createAccount({
          userId: user.id,
          accountId: user.id,
          providerId: 'credential',
          password: await context.password.hash(data.password),
        });
        await audit({ action: 'staff_created', actorId, staffId: id }, trx);
        return { staffId: id };
      });
    },
    async change(
      action: Action,
      staffId: string,
      actorId: string,
      password?: string,
    ) {
      z.enum([
        'deactivate',
        'reactivate',
        'reset-password',
        'reset-factor',
      ]).parse(action);
      z.uuid().parse(staffId);
      z.uuid().parse(actorId);
      if (action === 'reset-password') passwordSchema.parse(password);
      return db.transaction().execute(async (trx) => {
        await trx
          .selectFrom('staff_profiles')
          .select('id')
          .where('id', '=', actorId)
          .where('active', '=', true)
          .executeTakeFirstOrThrow();
        const profile = await trx
          .selectFrom('staff_profiles')
          .selectAll()
          .where('id', '=', staffId)
          .forUpdate()
          .executeTakeFirstOrThrow();
        if (!profile.auth_user_id) throw new Error('Profile has no account');
        if (action === 'deactivate' || action === 'reactivate') {
          await trx
            .updateTable('staff_profiles')
            .set({ active: action === 'reactivate' })
            .where('id', '=', staffId)
            .execute();
        } else if (action === 'reset-factor') {
          await trx
            .deleteFrom('auth_two_factors')
            .where('user_id', '=', profile.auth_user_id)
            .execute();
          await trx
            .updateTable('auth_users')
            .set({ two_factor_enabled: false, updated_at: new Date() })
            .where('id', '=', profile.auth_user_id)
            .executeTakeFirstOrThrow();
        } else {
          const context = await createAuth(trx, config, 'native').$context;
          const hash = await context.password.hash(password!);
          const updated = await trx
            .updateTable('auth_accounts')
            .set({ password: hash, updated_at: new Date() })
            .where('user_id', '=', profile.auth_user_id)
            .where('provider_id', '=', 'credential')
            .executeTakeFirstOrThrow();
          if (updated.numUpdatedRows !== 1n)
            throw new Error('Missing credential');
        }
        // Reactivation also invalidates any sessions added outside this command;
        // no action can restore a previously revoked credential.
        await revoke(trx, profile.auth_user_id);
        await audit({ action: actions[action], actorId, staffId }, trx);
        return { staffId };
      });
    },
  };
}
