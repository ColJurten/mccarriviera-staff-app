import process from 'node:process';
import { spawnSync } from 'node:child_process';
if (!process.env.MIGRATION_DATABASE_URL)
  throw new Error('MIGRATION_DATABASE_URL (migration owner) is required');
process.env.DATABASE_URL = process.env.MIGRATION_DATABASE_URL;
const result = spawnSync(
  'dbmate',
  ['--migrations-dir', 'migrations', '--no-dump-schema', 'up'],
  { stdio: 'inherit', timeout: 120000 },
);
process.exit(result.status ?? 1);
