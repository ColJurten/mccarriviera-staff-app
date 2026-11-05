import { afterEach, describe, expect, it, vi } from 'vitest';
import { once } from 'node:events';
import type { Server } from 'node:http';
import { Client, ApiError, type Envelope } from '../src/client.js';
import { manifestSchema, silentMeta } from '../src/create.js';
import {
  callbackHost,
  localUrl,
  placeholder,
  type State,
} from '../src/config.js';
import { replace } from '../src/replace.js';
import { authenticated, receiver } from '../src/webhook.js';
import { png, signature, signatureQuery } from '../src/signature.js';
import { mailIds } from '../src/mail-check.js';

const state: State = {
  id: 'env-one',
  externalId: 'US009-synthetic',
  recipientId: 7,
  itemId: 'item-one',
  language: 'fr',
  deleted: false,
  signingUrl: 'http://localhost:3000/sign/synthetic',
};
const envelope = (overrides: Partial<Envelope> = {}): Envelope => ({
  id: state.id,
  externalId: state.externalId,
  status: 'PENDING',
  deletedAt: null,
  recipients: [{ id: 7, email: placeholder, signingStatus: 'NOT_SIGNED' }],
  envelopeItems: [{ id: state.itemId }],
  fields: [
    {
      id: 1,
      recipientId: 7,
      type: 'SIGNATURE',
      page: 1,
      positionX: 60,
      positionY: 80,
      width: 20,
      height: 5,
      inserted: false,
    },
  ],
  documentMeta: {
    distributionMethod: 'NONE',
    emailSettings: silentMeta.emailSettings,
  },
  ...overrides,
});
function mockClient(value = envelope()) {
  const client = new Client('http://localhost:3000', 'synthetic-test-token');
  vi.spyOn(client, 'get').mockResolvedValue(value);
  vi.spyOn(client, 'delete').mockResolvedValue();
  return client;
}

describe('input and API boundaries', () => {
  it('binds callback only on loopback or private local interfaces', () => {
    expect(callbackHost()).toBe('127.0.0.1');
    expect(callbackHost('172.18.0.1')).toBe('172.18.0.1');
    expect(() => callbackHost('0.0.0.0')).toThrow();
    expect(() => callbackHost('8.8.8.8')).toThrow();
  });
  it('restricts service targets to local origins', () => {
    expect(localUrl('http://localhost:3000')).toBe('http://localhost:3000');
    for (const url of [
      'https://example.test',
      'http://user:secret@localhost',
      'http://localhost/path',
    ])
      expect(() => localUrl(url)).toThrow();
  });
  it('rejects missing/duplicated/out-of-page manifest fields', () => {
    const field = {
      page: 1,
      positionX: 60,
      positionY: 80,
      width: 20,
      height: 5,
    };
    const m = {
      language: 'fr',
      units: 'percent-top-left',
      pageCount: 2,
      pdfSha256: 'hash',
      fields: [field, { ...field, page: 2 }],
    };
    expect(manifestSchema.safeParse(m).success).toBe(true);
    expect(manifestSchema.safeParse({ ...m, fields: [field] }).success).toBe(
      false,
    );
    expect(
      manifestSchema.safeParse({ ...m, fields: [field, field] }).success,
    ).toBe(false);
    expect(
      manifestSchema.safeParse({
        ...m,
        fields: [field, { ...field, page: 2, width: 80 }],
      }).success,
    ).toBe(false);
  });
  it('does not expose rejected API bodies or credentials', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('SECRET signing URL', { status: 401 }));
    const client = new Client('http://localhost:3000', 'SECRET', request);
    await expect(client.call('/envelope/x')).rejects.toThrow('HTTP 401');
    await expect(client.call('/envelope/x')).rejects.not.toThrow('SECRET');
  });
  it('rejects non-PDF downloads', async () => {
    const client = new Client(
      'http://localhost:3000',
      'synthetic',
      vi.fn<typeof fetch>().mockResolvedValue(new Response('html')),
    );
    await expect(client.download('item')).rejects.toThrow('not a PDF');
  });
});

describe('replacement', () => {
  it.each(['COMPLETED', 'REJECTED'])(
    'refuses %s without deleting',
    async (status) => {
      const client = mockClient(envelope({ status }));
      await expect(
        replace(client, state, 'en', vi.fn(), vi.fn()),
      ).rejects.toThrow('Refusing');
      expect(client.delete).not.toHaveBeenCalled();
    },
  );
  it('refuses partially inserted fields and unrelated ownership', async () => {
    const original = envelope();
    original.fields[0]!.inserted = true;
    await expect(
      replace(mockClient(original), state, 'en', vi.fn(), vi.fn()),
    ).rejects.toThrow('Refusing');
    await expect(
      replace(
        mockClient(envelope({ externalId: 'unrelated' })),
        state,
        'en',
        vi.fn(),
        vi.fn(),
      ),
    ).rejects.toThrow('match');
  });
  it('never creates on delete failure', async () => {
    const client = mockClient();
    vi.mocked(client.delete).mockRejectedValue(new ApiError(500));
    const make = vi.fn();
    await expect(replace(client, state, 'en', make, vi.fn())).rejects.toThrow();
    expect(make).not.toHaveBeenCalled();
  });
  it('records deletion before creation, reuses reference, and records success', async () => {
    const client = mockClient();
    vi.mocked(client.get)
      .mockResolvedValueOnce(envelope())
      .mockRejectedValueOnce(new ApiError(404));
    const record = vi.fn().mockResolvedValue(undefined);
    const make = vi.fn().mockImplementation(async () => {
      expect(record).toHaveBeenCalledWith('state.json', {
        ...state,
        deleted: true,
      });
      return { ...state, id: 'env-two', language: 'en' };
    });
    await expect(
      replace(client, state, 'en', make, record),
    ).resolves.toMatchObject({ id: 'env-two' });
    expect(make).toHaveBeenCalledWith(client, 'en', state.externalId);
    expect(record).toHaveBeenLastCalledWith('replacement.json', {
      oldId: state.id,
      newId: 'env-two',
      phase: 'replaced',
    });
  });
  it('reports partial failure after deletion', async () => {
    const client = mockClient();
    vi.mocked(client.get)
      .mockResolvedValueOnce(envelope())
      .mockRejectedValueOnce(new ApiError(404));
    await expect(
      replace(
        client,
        state,
        'en',
        vi.fn().mockRejectedValue(new Error()),
        vi.fn(),
      ),
    ).rejects.toThrow('Old envelope deleted');
  });
});

describe('completion receiver', () => {
  const servers: Server[] = [];
  afterEach(async () => {
    for (const server of servers.splice(0))
      await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  async function setup(
    value = envelope({
      status: 'COMPLETED',
      recipients: [{ id: 7, email: placeholder, signingStatus: 'SIGNED' }],
    }),
  ) {
    const client = mockClient(value);
    const complete = vi.fn().mockResolvedValue(undefined);
    let done = false;
    const server = receiver({
      secret: 'synthetic-secret',
      client,
      state: async () => state,
      exists: async () => done,
      complete: async (s) => {
        await complete(s);
        done = true;
      },
    });
    servers.push(server);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error();
    const post = (
      secret: string | undefined = 'synthetic-secret',
      body: unknown = {
        event: 'DOCUMENT_COMPLETED',
        payload: { envelopeId: state.id },
      },
    ) =>
      fetch(`http://127.0.0.1:${address.port}/webhook`, {
        method: 'POST',
        headers: secret === undefined ? {} : { 'X-Documenso-Secret': secret },
        body: JSON.stringify(body),
      });
    return { post, complete, client };
  }
  it('authenticates exact shared secret and rejects missing/empty values', () => {
    expect(authenticated('synthetic', 'synthetic')).toBe(true);
    expect(authenticated(undefined, 'synthetic')).toBe(false);
    expect(authenticated('wrong', 'synthetic')).toBe(false);
    expect(authenticated('', '')).toBe(false);
  });
  it('rejects wrong secret/event/envelope without downloads or writes', async () => {
    const { post, complete, client } = await setup();
    expect((await post('wrong')).status).toBe(401);
    expect(
      (
        await post('synthetic-secret', {
          event: 'DOCUMENT_SENT',
          payload: { envelopeId: state.id },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await post('synthetic-secret', {
          event: 'DOCUMENT_COMPLETED',
          payload: { envelopeId: 'other' },
        })
      ).status,
    ).toBe(409);
    expect(complete).not.toHaveBeenCalled();
    expect(client.get).not.toHaveBeenCalled();
  });
  it('handles concurrent duplicates exactly once', async () => {
    const { post, complete } = await setup();
    expect((await Promise.all([post(), post()])).map((r) => r.status)).toEqual([
      200, 200,
    ]);
    expect(complete).toHaveBeenCalledTimes(1);
  });
  it('refuses incomplete envelopes and allows retry after API errors', async () => {
    const { post, complete, client } = await setup(envelope());
    expect((await post()).status).toBe(409);
    expect(complete).not.toHaveBeenCalled();
    vi.mocked(client.get).mockRejectedValueOnce(new ApiError(500));
    expect((await post()).status).toBe(503);
    vi.mocked(client.get).mockResolvedValue(
      envelope({
        status: 'COMPLETED',
        recipients: [{ id: 7, email: placeholder, signingStatus: 'SIGNED' }],
      }),
    );
    expect((await post()).status).toBe(200);
  });
});

describe('image retrieval and Mailpit', () => {
  const image = 'data:image/png;base64,iVBORw0KGgo='; // Synthetic PNG magic, no personal drawing.
  it('tries public API then scoped read-only DB extraction', async () => {
    const client = mockClient();
    vi.spyOn(client, 'call').mockResolvedValue({ id: 1, recipientId: 7 });
    const fallback = vi.fn().mockResolvedValue(image);
    expect((await signature(client, state, 1, fallback)).method).toBe(
      'database-read-only',
    );
    expect(fallback).toHaveBeenCalledWith(state);
    expect(signatureQuery).toContain('e.id = $1');
    expect(signatureQuery).toContain('r.id = $3');
    vi.mocked(client.call).mockResolvedValue({
      id: 1,
      recipientId: 7,
      signatureImageAsBase64: image,
    });
    fallback.mockClear();
    expect((await signature(client, state, 1, fallback)).method).toBe('api');
    expect(fallback).not.toHaveBeenCalled();
  });
  it('records unavailable extraction honestly and rejects malformed images', async () => {
    expect(png('data:image/svg+xml;base64,PHN2Zz4=')).toBeUndefined();
    const client = mockClient();
    vi.spyOn(client, 'call').mockResolvedValue({ id: 1, recipientId: 7 });
    expect(
      (
        await signature(
          client,
          state,
          1,
          vi.fn().mockRejectedValue(new Error('SECRET')),
        )
      ).method,
    ).toContain('extraction failed');
  });
  it('filters recipient mail, paginates and ignores setup mail', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        Response.json({
          messages: [{ ID: 'one', To: [{ Address: placeholder }] }],
          messages_count: 3,
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          messages: [
            { ID: 'setup', To: [{ Address: 'admin@example.test' }] },
            { ID: 'two', To: [{ Address: placeholder }] },
          ],
          messages_count: 3,
        }),
      );
    expect(await mailIds('http://localhost:8025', request)).toEqual([
      'one',
      'two',
    ]);
    expect(request.mock.calls[1]?.[0]).toContain('start=1');
  });
});
