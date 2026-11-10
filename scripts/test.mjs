import { spawnSync } from 'node:child_process';
import process from 'node:process';
// Keep the ticket's public verification command: pnpm test --filter db.
const args = process.argv.slice(2);
if (args.length && args.join(' ') !== '--filter db')
  throw new Error('Use pnpm test or pnpm test --filter db');
const result = spawnSync(
  'pnpm',
  args.length
    ? ['--filter', '@mccarriviera/db', 'test:integration']
    : ['-r', 'test'],
  { stdio: 'inherit', timeout: 240000 },
);
process.exit(result.status ?? 1);
