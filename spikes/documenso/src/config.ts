import {
  readFile,
  mkdir,
  writeFile,
  rename,
  realpath,
  stat,
} from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, relative, isAbsolute, dirname } from 'node:path';
import { isIP } from 'node:net';
import { z } from 'zod';

export const output = fileURLToPath(new URL('../output/', import.meta.url));
export const placeholder = 'spike@nomail.example.test';
export const language = z.enum(['fr', 'en']);
export type Language = z.infer<typeof language>;
export const stateSchema = z.object({
  id: z.string().min(1),
  externalId: z.string().startsWith('US009-'),
  recipientId: z.number().int(),
  itemId: z.string(),
  signingUrl: z.string().url(),
  language,
  deleted: z.boolean().default(false),
});
export type State = z.infer<typeof stateSchema>;

export function localUrl(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== 'http:' ||
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  ) {
    throw new Error('Only a loopback HTTP service origin is allowed');
  }
  return url.origin;
}

export async function externalSecret(
  path: string | undefined,
): Promise<string> {
  if (!path || !isAbsolute(path))
    throw new Error('Configure an absolute external secret file');
  const actual = await realpath(path);
  if ((await stat(actual)).mode & 0o077)
    throw new Error('Secret file must have mode 600');
  // Reject any checkout, including sibling worktrees, after resolving symlinks.
  for (
    let parent = dirname(actual);
    dirname(parent) !== parent;
    parent = dirname(parent)
  ) {
    try {
      await stat(resolve(parent, '.git'));
    } catch {
      continue;
    }
    throw new Error('Secret files must be outside every checkout');
  }
  const repo = fileURLToPath(new URL('../../../', import.meta.url));
  const rel = relative(repo, actual);
  if (!rel.startsWith('..'))
    throw new Error('Secret files must be outside the checkout');
  const value = (await readFile(actual, 'utf8')).trim();
  if (!value) throw new Error('Secret file is empty');
  return value;
}

export async function config() {
  return {
    origin: localUrl(process.env.DOCUMENSO_URL ?? 'http://localhost:3000'),
    token: await externalSecret(process.env.DOCUMENSO_TOKEN_FILE),
  };
}
export async function save(name: string, value: unknown) {
  await mkdir(output, { recursive: true, mode: 0o700 });
  const target = resolve(output, name);
  if (!target.startsWith(output)) throw new Error('Invalid output path');
  await writeFile(`${target}.tmp`, JSON.stringify(value, null, 2), {
    mode: 0o600,
  });
  await rename(`${target}.tmp`, target);
}
export async function loadState(): Promise<State> {
  return stateSchema.parse(
    JSON.parse(await readFile(resolve(output, 'state.json'), 'utf8')),
  );
}
export function cliLanguage(): Language {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  if (args.length === 0) return 'fr';
  if (args.length !== 2 || args[0] !== '--lang')
    throw new Error('Use --lang fr|en');
  return language.parse(args[1]);
}
export function main(file: string, run: () => Promise<void>) {
  if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(file)) {
    void run().catch((error: unknown) => {
      // Network responses, URLs, DB errors and Zod input can contain credentials.
      console.error(
        error instanceof SafeError
          ? error.message
          : 'Spike failed; check local prerequisites/configuration. No response body logged.',
      );
      process.exitCode = 1;
    });
  }
}
export class SafeError extends Error {}

export function callbackHost(value = '127.0.0.1'): string {
  if (value === '127.0.0.1') return value;
  const parts = value.split('.').map(Number);
  if (
    isIP(value) === 4 &&
    (parts[0] === 10 ||
      (parts[0] === 172 && parts[1]! >= 16 && parts[1]! <= 31) ||
      (parts[0] === 192 && parts[1] === 168))
  )
    return value;
  throw new SafeError(
    'Callback host must be loopback or a local private IPv4 interface',
  );
}
