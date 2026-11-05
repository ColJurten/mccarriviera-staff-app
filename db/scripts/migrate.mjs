import process from 'node:process';
import { spawnSync } from 'node:child_process';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const result = spawnSync(
  'dbmate',
  ['--migrations-dir', 'migrations', '--no-dump-schema', 'up'],
  { stdio: 'inherit', timeout: 120000 },
);
process.exit(result.status ?? 1);
