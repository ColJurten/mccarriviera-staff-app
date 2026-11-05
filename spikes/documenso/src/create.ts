import { readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import { Client, type Envelope } from './client.js';
import {
  config,
  output,
  placeholder,
  save,
  cliLanguage,
  main,
  SafeError,
  type Language,
  type State,
} from './config.js';

export const manifestSchema = z
  .object({
    language: z.enum(['fr', 'en']),
    units: z.literal('percent-top-left'),
    pageCount: z.number().int().min(2),
    pdfSha256: z.string(),
    fields: z.array(
      z.object({
        page: z.number().int().min(1),
        positionX: z.number().min(0).max(100),
        positionY: z.number().min(0).max(100),
        width: z.number().positive().max(100),
        height: z.number().positive().max(100),
      }),
    ),
  })
  .superRefine((m, ctx) => {
    if (
      m.fields.length !== m.pageCount ||
      m.fields.some(
        (f, i) =>
          f.page !== i + 1 ||
          f.positionX + f.width > 100 ||
          f.positionY + f.height > 100,
      )
    )
      ctx.addIssue({ code: 'custom', message: 'Invalid page coordinates' });
  });
export const emailSettings = Object.fromEntries(
  [
    'recipientSigningRequest',
    'recipientRemoved',
    'recipientSigned',
    'documentPending',
    'documentCompleted',
    'documentDeleted',
    'ownerDocumentCompleted',
    'ownerRecipientExpired',
    'ownerDocumentCreated',
  ].map((key) => [key, false]),
);
export const silentMeta = {
  distributionMethod: 'NONE',
  emailSettings,
  reminderSettings: {
    sendAfter: { disabled: true },
    repeatEvery: { disabled: true },
  },
  typedSignatureEnabled: false,
  uploadSignatureEnabled: false,
  drawSignatureEnabled: true,
};

export async function fixture(lang: Language) {
  const manifest = manifestSchema.parse(
    JSON.parse(
      await readFile(resolve(output, `departure-${lang}.json`), 'utf8'),
    ),
  );
  const pdf = await readFile(resolve(output, `departure-${lang}.pdf`));
  if (
    manifest.language !== lang ||
    createHash('sha256').update(pdf).digest('hex') !== manifest.pdfSha256
  )
    throw new SafeError('PDF and manifest disagree; render again');
  return { manifest, pdf };
}
export function assertOwned(
  envelope: Envelope,
  state: Pick<State, 'id' | 'externalId' | 'recipientId' | 'itemId'>,
) {
  if (
    envelope.id !== state.id ||
    envelope.externalId !== state.externalId ||
    envelope.deletedAt ||
    envelope.recipients.length !== 1 ||
    envelope.recipients[0]?.id !== state.recipientId ||
    envelope.recipients[0]?.email !== placeholder ||
    envelope.envelopeItems.length !== 1 ||
    envelope.envelopeItems[0]?.id !== state.itemId
  )
    throw new SafeError('Envelope does not match this synthetic run');
}
export async function create(
  client: Client,
  lang: Language,
  externalId = `US009-${randomUUID()}`,
): Promise<State> {
  const { manifest, pdf } = await fixture(lang);
  const body = new FormData();
  body.set(
    'payload',
    JSON.stringify({
      title: `Synthetic US-009 ${lang}`,
      type: 'DOCUMENT',
      externalId,
      recipients: [
        {
          email: placeholder,
          name: 'Alex EXEMPLE',
          role: 'SIGNER',
          fields: manifest.fields.map((f) => ({
            ...f,
            type: 'SIGNATURE',
            identifier: 0,
          })),
        },
      ],
      meta: { ...silentMeta, language: lang },
    }),
  );
  body.append(
    'files',
    new Blob([new Uint8Array(pdf)], { type: 'application/pdf' }),
    `departure-${lang}.pdf`,
  );
  const { id } = z
    .object({ id: z.string() })
    .parse(await client.call('/envelope/create', body));
  // Preserve the ID even if subsequent verification/distribution fails.
  await save('creation.json', {
    id,
    externalId,
    language: lang,
    phase: 'created',
  });
  const envelope = await client.get(id);
  const recipientId = envelope.recipients[0]?.id;
  const itemId = envelope.envelopeItems[0]?.id;
  if (recipientId === undefined || !itemId)
    throw new SafeError(
      'Created envelope is missing signer/PDF; inspect creation.json',
    );
  assertOwned(envelope, { id, externalId, recipientId, itemId });
  const fields = [...envelope.fields].sort((a, b) => a.page - b.page);
  if (
    fields.length !== manifest.pageCount ||
    fields.some((f, i) => {
      const expected = manifest.fields[i];
      return (
        !expected ||
        f.page !== expected.page ||
        f.type !== 'SIGNATURE' ||
        f.recipientId !== recipientId ||
        (['positionX', 'positionY', 'width', 'height'] as const).some(
          (k) => Math.abs(f[k] - expected[k]) > 0.02,
        )
      );
    }) ||
    envelope.documentMeta.distributionMethod !== 'NONE' ||
    Object.keys(emailSettings).some(
      (k) => envelope.documentMeta.emailSettings?.[k] !== false,
    )
  )
    throw new SafeError(
      'Created fields/mail settings differ; inspect creation.json',
    );
  const sent = z
    .object({
      recipients: z.array(
        z.object({
          id: z.number(),
          email: z.string(),
          signingUrl: z.string().url(),
        }),
      ),
    })
    .parse(
      await client.call('/envelope/distribute', {
        envelopeId: id,
        meta: { distributionMethod: 'NONE', emailSettings },
      }),
    );
  const signer = sent.recipients.find(
    (r) => r.id === recipientId && r.email === placeholder,
  );
  if (!signer || new URL(signer.signingUrl).origin !== client.origin)
    throw new SafeError('Missing local signing URL');
  const state = {
    id,
    externalId,
    recipientId,
    itemId,
    signingUrl: signer.signingUrl,
    language: lang,
    deleted: false,
  };
  await save('state.json', state);
  await save('creation.json', {
    id,
    externalId,
    phase: 'distributed',
    pages: fields.length,
  });
  return state;
}
main(import.meta.url, async () => {
  try {
    await access(resolve(output, 'state.json'));
  } catch {
    /* first run */
    const cfg = await config();
    const state = await create(
      new Client(cfg.origin, cfg.token),
      cliLanguage(),
    );
    console.log(state.signingUrl);
    return;
  }
  throw new SafeError(
    'Existing state.json: use replace, or archive the output directory for a new run',
  );
});
