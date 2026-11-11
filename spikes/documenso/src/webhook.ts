import { createServer, type Server } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { access, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { Client } from './client.js';
import { assertOwned } from './create.js';
import {
  callbackHost,
  config,
  externalSecret,
  loadState,
  main,
  output,
  save,
  type State,
} from './config.js';
import { signature } from './signature.js';

const eventSchema = z.object({
  event: z.literal('DOCUMENT_COMPLETED'),
  payload: z.object({ envelopeId: z.string() }),
});
const hash = (value: Buffer | string) =>
  createHash('sha256').update(value).digest('hex');
export function authenticated(
  actual: string | undefined,
  expected: string,
): boolean {
  return (
    Boolean(actual && expected) &&
    timingSafeEqual(
      Buffer.from(hash(actual ?? '')),
      Buffer.from(hash(expected)),
    )
  );
}
export function receiver(deps: {
  secret: string;
  client: Client;
  state: () => Promise<State>;
  exists: (id: string) => Promise<boolean>;
  complete: (state: State) => Promise<void>;
}): Server {
  // Serialize processing so concurrent duplicate callbacks cannot download twice.
  let queue = Promise.resolve();
  return createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST' || req.url !== '/webhook') {
      res.writeHead(404).end();
      return;
    }
    const secret = req.headers['x-documenso-secret'];
    if (
      !authenticated(
        typeof secret === 'string' ? secret : undefined,
        deps.secret,
      )
    ) {
      res.writeHead(401).end();
      return;
    }
    try {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        size += Buffer.byteLength(chunk);
        if (size > 128_000) {
          res.writeHead(413).end();
          return;
        }
        chunks.push(Buffer.from(chunk));
      }
      let body: unknown;
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } catch {
        res.writeHead(400).end();
        return;
      }
      const parsed = eventSchema.safeParse(body);
      if (!parsed.success) {
        res.writeHead(400).end();
        return;
      }
      const event = parsed.data;
      const job = queue.then(async () => {
        const state = await deps.state();
        if (state.deleted || event.payload.envelopeId !== state.id) {
          res.writeHead(409).end();
          return;
        }
        const envelope = await deps.client.get(state.id);
        assertOwned(envelope, state);
        if (
          envelope.status !== 'COMPLETED' ||
          envelope.recipients.some((r) => r.signingStatus !== 'SIGNED')
        ) {
          res.writeHead(409).end();
          return;
        }
        if (!(await deps.exists(state.id))) await deps.complete(state);
        res.writeHead(200).end('ok');
      });
      queue = job.catch(() => {});
      await job;
    } catch {
      res.writeHead(503).end('Completion not stored; retry');
    }
  });
}
export async function complete(client: Client, state: State) {
  const envelope = await client.get(state.id);
  assertOwned(envelope, state);
  const field = envelope.fields.find(
    (f) =>
      f.type === 'SIGNATURE' &&
      f.inserted &&
      f.recipientId === state.recipientId,
  );
  if (
    envelope.status !== 'COMPLETED' ||
    !field ||
    envelope.fields.some((f) => f.type !== 'SIGNATURE' || !f.inserted)
  )
    throw new Error('No fully completed signature fields');
  const pdf = await client.download(state.itemId);
  const extracted = await signature(client, state, field.id);
  // Use hashed IDs for filenames, never untrusted paths or signing tokens.
  const stem = hash(state.id);
  await writeFile(resolve(output, `${stem}-sealed.pdf`), pdf, { mode: 0o600 });
  if (extracted.image)
    await writeFile(resolve(output, `${stem}-signature.png`), extracted.image, {
      mode: 0o600,
    });
  await save(`${stem}-completed.json`, {
    id: state.id,
    recipientId: state.recipientId,
    receivedAt: new Date().toISOString(),
    pdfSha256: hash(pdf),
    signatureMethod: extracted.method,
    signatureSha256: extracted.image ? hash(extracted.image) : null,
  });
}
main(import.meta.url, async () => {
  const cfg = await config();
  const secret = await externalSecret(
    process.env.DOCUMENSO_WEBHOOK_SECRET_FILE,
  );
  const client = new Client(cfg.origin, cfg.token);
  const server = receiver({
    secret,
    client,
    state: loadState,
    exists: async (id) => {
      try {
        await access(resolve(output, `${hash(id)}-completed.json`));
        return true;
      } catch {
        return false;
      }
    },
    complete: (state) => complete(client, state),
  });
  server.requestTimeout = 15_000;
  const host = callbackHost(process.env.SPIKE_CALLBACK_HOST);
  server.listen(3210, host, () =>
    console.log(`Local completion receiver: http://${host}:3210/webhook`),
  );
});
