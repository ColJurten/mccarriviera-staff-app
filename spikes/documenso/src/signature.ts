import pg from 'pg';
import { z } from 'zod';
import { type Client } from './client.js';
import { type State, externalSecret } from './config.js';

// v2.20.0's public field schema contains no signature relation. Its internal
// getEnvelopeFieldSignatures is session-only tRPC, not a public API endpoint.
export const signatureQuery = `SELECT s."signatureImageAsBase64" AS image
 FROM "Signature" s
 JOIN "Field" f ON f.id = s."fieldId"
 JOIN "Recipient" r ON r.id = s."recipientId"
 JOIN "Envelope" e ON e.id = f."envelopeId"
 WHERE e.id = $1 AND e."externalId" = $2 AND e.status = 'COMPLETED'
 AND e."deletedAt" IS NULL AND r.id = $3 AND r.email = $4
 AND r."envelopeId" = e.id AND f."recipientId" = r.id
 AND f.type = 'SIGNATURE' AND f.inserted = true
 ORDER BY f.page LIMIT 1`;

export function png(value: unknown): Buffer | undefined {
  if (typeof value !== 'string') return undefined;
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if (!match?.[1] || match[1].length > 8_000_000) return undefined;
  const data = Buffer.from(match[1], 'base64');
  return data
    .subarray(0, 8)
    .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    ? data
    : undefined;
}
export async function databaseImage(state: State): Promise<unknown> {
  if (!process.env.DOCUMENSO_DB_URL_FILE) return undefined;
  const connectionString = await externalSecret(
    process.env.DOCUMENSO_DB_URL_FILE,
  );
  const url = new URL(connectionString);
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    url.pathname !== '/documenso'
  )
    throw new Error('Only disposable local Documenso DB allowed');
  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: 5000,
    statement_timeout: 5000,
  });
  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    const result = await client.query<{ image: unknown }>(signatureQuery, [
      state.id,
      state.externalId,
      state.recipientId,
      'spike@nomail.example.test',
    ]);
    await client.query('ROLLBACK');
    return result.rows[0]?.image;
  } finally {
    await client.end();
  }
}
export async function signature(
  client: Client,
  state: State,
  fieldId: number,
  fallback = databaseImage,
) {
  const field = z
    .object({
      id: z.number(),
      recipientId: z.number(),
      signatureImageAsBase64: z.string().optional(),
    })
    .parse(await client.call(`/envelope/field/${fieldId}`));
  if (field.id !== fieldId || field.recipientId !== state.recipientId)
    throw new Error('Unexpected field');
  const apiImage = png(field.signatureImageAsBase64);
  if (apiImage) return { method: 'api', image: apiImage };
  try {
    const image = png(await fallback(state));
    return image
      ? { method: 'database-read-only', image }
      : {
          method:
            'unavailable: API omits image; no drawn PNG found/configured in local DB',
        };
  } catch {
    return {
      method: 'unavailable: API omits image; local DB extraction failed',
    };
  }
}
