import { URL, fileURLToPath } from 'node:url';
import process from 'node:process';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const directory = await mkdtemp(join(tmpdir(), 'mcr-codegen-'));
const generated = join(directory, 'generated.ts');
const committed = new URL('../../api/src/db/generated.ts', import.meta.url);
try {
  const result = spawnSync(
    'kysely-codegen',
    ['--dialect', 'postgres', '--out-file', generated],
    { stdio: 'inherit', timeout: 120000 },
  );
  if (result.status !== 0) throw new Error('Database type generation failed');
  const formatted = spawnSync(
    'prettier',
    [
      '--config',
      fileURLToPath(new URL('../../.prettierrc.json', import.meta.url)),
      '--write',
      generated,
    ],
    { stdio: 'pipe', timeout: 30000 },
  );
  if (formatted.status !== 0)
    throw new Error('Generated type formatting failed');
  if (process.argv.includes('--check')) {
    if (
      (await readFile(generated, 'utf8')) !==
      (await readFile(committed, 'utf8'))
    )
      throw new Error('Database types differ; run pnpm db:generate');
  } else {
    await copyFile(generated, committed);
  }
} finally {
  await rm(directory, { recursive: true, force: true });
}
