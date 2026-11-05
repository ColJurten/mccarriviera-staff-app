import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import {
  main,
  localUrl,
  placeholder,
  output,
  save,
  SafeError,
} from './config.js';

const resultsSchema = z.object({
  messages: z.array(
    z.object({
      ID: z.string(),
      To: z.array(z.object({ Address: z.string() })),
    }),
  ),
  messages_count: z.number(),
});
export async function mailIds(
  origin: string,
  request: typeof fetch = fetch,
): Promise<string[]> {
  const ids: string[] = [];
  let start = 0;
  for (;;) {
    const response = await request(
      `${origin}/api/v1/search?query=${encodeURIComponent(`to:${placeholder}`)}&start=${start}&limit=100`,
      { signal: AbortSignal.timeout(10_000), redirect: 'error' },
    );
    if (!response.ok) throw new SafeError('Mailpit search failed');
    const result = resultsSchema.parse(await response.json());
    ids.push(
      ...result.messages
        .filter((m) =>
          m.To.some((r) => r.Address.toLowerCase() === placeholder),
        )
        .map((m) => m.ID),
    );
    start += result.messages.length;
    if (start >= result.messages_count) return ids;
    if (!result.messages.length)
      throw new SafeError('Mailpit pagination incomplete');
  }
}
main(import.meta.url, async () => {
  const args = process.argv.slice(2).filter((a) => a !== '--');
  const baseline = args.length === 1 && args[0] === '--baseline';
  if (args.length && !baseline)
    throw new SafeError('Use mail-check [--baseline]');
  const ids = await mailIds(
    localUrl(process.env.MAILPIT_URL ?? 'http://localhost:8025'),
  );
  if (baseline) {
    await save('mail-baseline.json', { ids, at: new Date().toISOString() });
    console.log(`Baseline: ${ids.length} placeholder messages`);
    return;
  }
  const before = z
    .object({ ids: z.array(z.string()), at: z.string() })
    .parse(
      JSON.parse(await readFile(resolve(output, 'mail-baseline.json'), 'utf8')),
    );
  if (before.ids.some((id) => !ids.includes(id)))
    throw new SafeError(
      'Mailpit baseline messages disappeared; evidence invalid',
    );
  const added = ids.filter((id) => !before.ids.includes(id));
  await save(`mail-${Date.now()}.json`, {
    baselineAt: before.at,
    at: new Date().toISOString(),
    matchingMessages: added.length,
    ids: added,
  });
  console.log(`New placeholder messages since baseline: ${added.length}`);
});
