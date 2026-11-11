import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Client, type Envelope } from '../src/client.js';
import { placeholder, type State } from '../src/config.js';
import { create, emailSettings } from '../src/create.js';
import { complete } from '../src/webhook.js';

// Never touch the ignored evidence folder from a test run.
const { dir } = vi.hoisted(() => ({
  dir: `${process.env.TMPDIR ?? '/tmp'}/us009-flow-${process.pid}/`,
}));
vi.mock('../src/config.js', async (original) => {
  const actual = await original<typeof import('../src/config.js')>();
  return {
    ...actual,
    output: dir,
    save: async (name: string, value: unknown) =>
      writeFile(join(dir, name), JSON.stringify(value)),
  };
});

const pdf = Buffer.from('%PDF-1.7 synthetic');
const sha = (value: Buffer) => createHash('sha256').update(value).digest('hex');
const box = { positionX: 5, positionY: 80, width: 20, height: 8 };
const manifest = {
  language: 'fr',
  units: 'percent-top-left',
  pageCount: 2,
  pdfSha256: sha(pdf),
  fields: [
    { page: 1, ...box },
    { page: 2, ...box },
  ],
};
const url = 'http://localhost:3000/sign/synthetic';
const envelope = (overrides: Partial<Envelope> = {}): Envelope => ({
  id: 'env-one',
  externalId: 'US009-synthetic',
  status: 'PENDING',
  deletedAt: null,
  recipients: [{ id: 7, email: placeholder, signingStatus: 'NOT_SIGNED' }],
  envelopeItems: [{ id: 'item-one' }],
  fields: manifest.fields.map((f, i) => ({
    ...f,
    id: i + 1,
    recipientId: 7,
    type: 'SIGNATURE',
    inserted: false,
  })),
  documentMeta: { distributionMethod: 'NONE', emailSettings },
  ...overrides,
});
type Reply = (path: string, init: RequestInit) => Response | undefined;
function fakeApi(value: Envelope, reply: Reply = () => undefined) {
  const calls: { path: string; init: RequestInit }[] = [];
  const request: typeof fetch = async (input, init = {}) => {
    const path = String(input).replace('http://localhost:3000/api/v2', '');
    calls.push({ path, init });
    const custom = reply(path, init);
    if (custom) return custom;
    if (path === '/envelope/create') return Response.json({ id: value.id });
    if (path === '/envelope/distribute')
      return Response.json({
        recipients: [{ id: 7, email: placeholder, signingUrl: url }],
      });
    if (path === `/envelope/${value.id}`) return Response.json(value);
    return new Response(null, { status: 404 });
  };
  return {
    client: new Client('http://localhost:3000', 'synthetic', request),
    calls,
  };
}
const body = (init: RequestInit) => JSON.parse(String(init.body));

beforeEach(async () => {
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'departure-fr.pdf'), pdf);
  await writeFile(join(dir, 'departure-fr.json'), JSON.stringify(manifest));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('envelope creation request', () => {
  it('sends one placeholder signer, one signature per page and no distribution', async () => {
    const { client, calls } = fakeApi(envelope());
    const state = await create(client, 'fr', 'US009-synthetic');
    expect(state.signingUrl).toBe(url);

    const sent = calls.find((c) => c.path === '/envelope/create')!;
    expect(sent.init.method).toBe('POST');
    const form = sent.init.body as FormData;
    const file = form.get('files') as File;
    expect(file.type).toBe('application/pdf');
    expect(Buffer.from(await file.arrayBuffer()).equals(pdf)).toBe(true);
    const payload = JSON.parse(String(form.get('payload')));
    expect(payload.recipients).toHaveLength(1);
    expect(payload.recipients[0]).toMatchObject({
      email: 'spike@nomail.example.test',
      role: 'SIGNER',
    });
    expect(
      payload.recipients[0].fields.map(
        (f: { page: number; type: string; positionX: number }) => [
          f.page,
          f.type,
          f.positionX,
        ],
      ),
    ).toEqual([
      [1, 'SIGNATURE', 5],
      [2, 'SIGNATURE', 5],
    ]);
    expect(payload.meta.distributionMethod).toBe('NONE');
    expect(Object.keys(payload.meta.emailSettings)).toHaveLength(9);
    expect(Object.values(payload.meta.emailSettings)).not.toContain(true);
    expect(payload.meta.reminderSettings).toEqual({
      sendAfter: { disabled: true },
      repeatEvery: { disabled: true },
    });

    const distribute = calls.find((c) => c.path === '/envelope/distribute')!;
    expect(body(distribute.init).meta.distributionMethod).toBe('NONE');
    expect(calls.map((c) => c.path)).toEqual([
      '/envelope/create',
      '/envelope/env-one',
      '/envelope/distribute',
    ]);
  });

  it('refuses a PDF that no longer matches its manifest before any API call', async () => {
    await writeFile(join(dir, 'departure-fr.pdf'), '%PDF-1.7 changed');
    const { client, calls } = fakeApi(envelope());
    await expect(create(client, 'fr')).rejects.toThrow('render again');
    expect(calls).toHaveLength(0);
  });

  it.each([
    ['a field is missing', { fields: envelope().fields.slice(0, 1) }],
    [
      'a box moved',
      {
        fields: envelope().fields.map((f) => ({ ...f, positionY: 10 })),
      },
    ],
    [
      'mail stays enabled',
      {
        documentMeta: {
          distributionMethod: 'NONE',
          emailSettings: { ...emailSettings, documentCompleted: true },
        },
      },
    ],
    [
      'distribution is not NONE',
      { documentMeta: { distributionMethod: 'EMAIL', emailSettings } },
    ],
  ] satisfies [string, Partial<Envelope>][])(
    'does not distribute when %s',
    async (_, overrides) => {
      const { client, calls } = fakeApi(envelope(overrides));
      await expect(create(client, 'fr', 'US009-synthetic')).rejects.toThrow(
        'differ',
      );
      expect(calls.map((c) => c.path)).not.toContain('/envelope/distribute');
      expect(await readdir(dir)).not.toContain('state.json');
    },
  );

  it('refuses a signing URL outside the local Documenso origin', async () => {
    const { client } = fakeApi(envelope(), (path) =>
      path === '/envelope/distribute'
        ? Response.json({
            recipients: [
              {
                id: 7,
                email: placeholder,
                signingUrl: 'https://elsewhere.example.test/sign/synthetic',
              },
            ],
          })
        : undefined,
    );
    await expect(create(client, 'fr', 'US009-synthetic')).rejects.toThrow(
      'signing URL',
    );
    expect(await readdir(dir)).not.toContain('state.json');
  });
});

describe('completion artifacts', () => {
  const state: State = {
    id: 'env-one',
    externalId: 'US009-synthetic',
    recipientId: 7,
    itemId: 'item-one',
    language: 'fr',
    deleted: false,
    signingUrl: url,
  };
  const signed = envelope({
    status: 'COMPLETED',
    recipients: [{ id: 7, email: placeholder, signingStatus: 'SIGNED' }],
    fields: envelope().fields.map((f) => ({ ...f, inserted: true })),
  });
  const stem = createHash('sha256').update(state.id).digest('hex');
  const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const download: Reply = (path) =>
    path.startsWith('/envelope/item/') ? new Response(pdf) : undefined;

  it('asks for the signed version and saves the PDF, image and hashes', async () => {
    const { client, calls } = fakeApi(signed, (path, init) =>
      path === '/envelope/field/1'
        ? Response.json({
            id: 1,
            recipientId: 7,
            signatureImageAsBase64: `data:image/png;base64,${png.toString('base64')}`,
          })
        : download(path, init),
    );
    await complete(client, state);
    expect(calls.map((c) => c.path)).toContain(
      '/envelope/item/item-one/download?version=signed',
    );
    expect(await readFile(join(dir, `${stem}-sealed.pdf`))).toEqual(pdf);
    expect(await readFile(join(dir, `${stem}-signature.png`))).toEqual(png);
    expect(
      JSON.parse(await readFile(join(dir, `${stem}-completed.json`), 'utf8')),
    ).toMatchObject({
      id: state.id,
      pdfSha256: sha(pdf),
      signatureMethod: 'api',
      signatureSha256: sha(png),
    });
  });

  it('keeps the sealed PDF and records why no image could be read', async () => {
    vi.stubEnv('DOCUMENSO_DB_URL_FILE', '');
    const { client } = fakeApi(signed, (path, init) =>
      path === '/envelope/field/1'
        ? Response.json({ id: 1, recipientId: 7 })
        : download(path, init),
    );
    await complete(client, state);
    vi.unstubAllEnvs();
    const files = await readdir(dir);
    expect(files).toContain(`${stem}-sealed.pdf`);
    expect(files).not.toContain(`${stem}-signature.png`);
    const record = JSON.parse(
      await readFile(join(dir, `${stem}-completed.json`), 'utf8'),
    );
    expect(record.signatureMethod).toContain('unavailable');
    expect(record.signatureSha256).toBeNull();
  });

  it('writes nothing when a field is still unsigned', async () => {
    const partial = envelope({
      status: 'COMPLETED',
      fields: signed.fields.map((f, i) => ({ ...f, inserted: i === 0 })),
    });
    const { client, calls } = fakeApi(partial, download);
    await expect(complete(client, state)).rejects.toThrow('fully completed');
    expect(calls.some((c) => c.path.startsWith('/envelope/item/'))).toBe(false);
    expect((await readdir(dir)).filter((f) => f.startsWith(stem))).toEqual([]);
  });
});

describe('production build exclusion', () => {
  const root = new URL('../../../', import.meta.url);
  const text = (path: string) => readFile(new URL(path, root), 'utf8');

  it('keeps the spike out of Docker contexts and production images', async () => {
    expect((await text('.dockerignore')).split('\n')).toContain('spikes');
    expect(await text('api/Dockerfile')).not.toContain('spikes');
    for (const file of ['api/package.json', 'app/package.json'])
      expect(await text(file)).not.toContain('documenso-spike');
  });

  it('gives the spike no build script and keeps its output untracked', async () => {
    const manifestFile = JSON.parse(
      await text('spikes/documenso/package.json'),
    );
    expect(manifestFile.private).toBe(true);
    expect(manifestFile.scripts.build).toBeUndefined();
    expect((await text('spikes/documenso/.gitignore')).split('\n')).toContain(
      'output/',
    );
  });
});
