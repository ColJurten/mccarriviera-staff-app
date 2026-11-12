import { open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { parseArgs } from 'node:util';
import { ZodError } from 'zod';
import { createStaffAdmin, StaffAdminFailure } from '../src/staff-admin.js';
import { createDatabase } from '../src/db.js';
import { readConfig } from '../src/config.js';

class CommandFailure extends Error {
  constructor(public code: string) {
    super(code);
  }
}
async function readPassword(path: string | undefined) {
  if (!path) throw new CommandFailure('password_file_required');
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || (stat.mode & 0o077) !== 0 || stat.size > 1024)
      throw new CommandFailure('password_file_unprotected');
    return (await file.readFile('utf8')).replace(/\r?\n$/, '');
  } finally {
    await file.close();
  }
}
let database: ReturnType<typeof createDatabase> | undefined;
try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      email: { type: 'string' },
      name: { type: 'string' },
      actor: { type: 'string' },
      staff: { type: 'string' },
      bootstrap: { type: 'boolean' },
      'password-file': { type: 'string' },
    },
  });
  const [action] = positionals;
  if (positionals.length !== 1) throw new CommandFailure('invalid_arguments');
  const config = (() => {
    try {
      return readConfig();
    } catch {
      throw new CommandFailure('invalid_configuration');
    }
  })();
  if (!process.env.MIGRATION_DATABASE_URL)
    throw new CommandFailure('owner_connection_required');
  database = createDatabase(process.env.MIGRATION_DATABASE_URL, 10000);
  const admin = createStaffAdmin(database.db, config);
  if (action === 'create') {
    if (
      !values.email ||
      !values.name ||
      (values.bootstrap ? !!values.actor : !values.actor)
    )
      throw new CommandFailure('invalid_arguments');
    const created = await admin.create({
      email: values.email,
      displayName: values.name,
      actorId: values.actor ?? null,
      password: await readPassword(values['password-file']),
    });
    process.stdout.write(`Staff profile: ${created.staffId}\n`);
  } else if (
    action === 'deactivate' ||
    action === 'reactivate' ||
    action === 'reset-password' ||
    action === 'reset-factor'
  ) {
    if (!values.staff || !values.actor || values.bootstrap)
      throw new CommandFailure('invalid_arguments');
    await admin.change(
      action,
      values.staff,
      values.actor,
      action === 'reset-password'
        ? await readPassword(values['password-file'])
        : undefined,
    );
  } else throw new CommandFailure('unknown_action');
  process.stdout.write(
    'Staff command completed. Audit persistence pending US-007.\n',
  );
} catch (error) {
  // Only our fixed reason codes; no validation details, values or driver errors.
  const code =
    error instanceof CommandFailure || error instanceof StaffAdminFailure
      ? error.code
      : error instanceof ZodError
        ? 'invalid_input'
        : 'command_failed';
  process.stderr.write(`Staff command failed: ${code}.\n`);
  process.exitCode = 1;
} finally {
  await database?.close();
}
