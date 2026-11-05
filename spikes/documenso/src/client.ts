import { z } from 'zod';
import { SafeError } from './config.js';

export const envelopeSchema = z.object({
  id: z.string(),
  externalId: z.string().nullable(),
  status: z.string(),
  deletedAt: z.string().nullable(),
  recipients: z.array(
    z.object({ id: z.number(), email: z.string(), signingStatus: z.string() }),
  ),
  envelopeItems: z.array(z.object({ id: z.string() })),
  fields: z.array(
    z.object({
      id: z.number(),
      recipientId: z.number(),
      type: z.string(),
      page: z.number(),
      positionX: z.coerce.number(),
      positionY: z.coerce.number(),
      width: z.coerce.number(),
      height: z.coerce.number(),
      inserted: z.boolean(),
    }),
  ),
  documentMeta: z.object({
    distributionMethod: z.string(),
    emailSettings: z.record(z.string(), z.boolean()).nullable(),
  }),
});
export type Envelope = z.infer<typeof envelopeSchema>;
export class ApiError extends SafeError {
  constructor(public readonly status: number) {
    super(`Documenso API rejected request (HTTP ${status}); response withheld`);
  }
}
export class Client {
  constructor(
    readonly origin: string,
    private token: string,
    private request: typeof fetch = fetch,
  ) {}
  async call(path: string, body?: unknown): Promise<unknown> {
    const form = body instanceof FormData;
    const response = await this.request(`${this.origin}/api/v2${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      redirect: 'error',
      headers: {
        Authorization: this.token,
        ...(!form && body !== undefined
          ? { 'Content-Type': 'application/json' }
          : {}),
      },
      ...(body === undefined
        ? {}
        : { body: form ? body : JSON.stringify(body) }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new ApiError(response.status);
    return response.json();
  }
  async get(id: string): Promise<Envelope> {
    return envelopeSchema.parse(
      await this.call(`/envelope/${encodeURIComponent(id)}`),
    );
  }
  async delete(id: string) {
    await this.call('/envelope/delete', { envelopeId: id });
  }
  async download(itemId: string): Promise<Buffer> {
    const response = await this.request(
      `${this.origin}/api/v2/envelope/item/${encodeURIComponent(itemId)}/download?version=signed`,
      {
        headers: { Authorization: this.token },
        redirect: 'error',
        signal: AbortSignal.timeout(30_000),
      },
    );
    if (!response.ok) throw new ApiError(response.status);
    const data = Buffer.from(await response.arrayBuffer());
    if (!data.subarray(0, 5).equals(Buffer.from('%PDF-')))
      throw new SafeError('Download was not a PDF');
    return data;
  }
}
