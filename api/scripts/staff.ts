import { open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { parseArgs } from 'node:util';
import { createStaffAdmin } from '../src/staff-admin.js';
import { createDatabase } from '../src/db.js';
import { readConfig } from '../src/config.js';

async function readPassword(path: string | undefined) {
  if (!path) throw new Error('Password file required');
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || (stat.mode & 0o077) !== 0 || stat.size > 1024)
      throw new Error('Password file must be protected');
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
  if (positionals.length !== 1) throw new Error('One action required');
  const config = readConfig();
  if (!process.env.MIGRATION_DATABASE_URL)
    throw new Error('Owner connection required for account administration');
  database = createDatabase(process.env.MIGRATION_DATABASE_URL, 10000);
  const admin = createStaffAdmin(database.db, config);
  if (action === 'create') {
    if (
      !values.email ||
      !values.name ||
      (values.bootstrap ? !!values.actor : !values.actor)
    )
      throw new Error('Invalid create arguments');
    await admin.create({
      email: values.email,
      displayName: values.name,
      actorId: values.actor ?? null,
      password: await readPassword(values['password-file']),
    });
  } else if (
    action === 'deactivate' ||
    action === 'reactivate' ||
    action === 'reset-password' ||
    action === 'reset-factor'
  ) {
    if (!values.staff || !values.actor || values.bootstrap)
      throw new Error('Actor and staff required');
    await admin.change(
      action,
      values.staff,
      values.actor,
      action === 'reset-password'
        ? await readPassword(values['password-file'])
        : undefined,
    );
  } else throw new Error('Unknown action');
  process.stdout.write(
    'Staff command completed. Audit persistence pending US-007.\n',
  );
} catch {
  // Never print validation details, arguments, credentials or driver errors.
  process.stderr.write(
    'Staff command failed. Check action, IDs and protected input.\n',
  );
  process.exitCode = 1;
} finally {
  await database?.close();
}
