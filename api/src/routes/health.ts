import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  healthQuerySchema,
  healthResponseSchema,
  errorResponseSchema,
} from '@mccarriviera/shared';

export type Probe = (signal: AbortSignal) => Promise<void>;
export interface HealthOptions {
  database: Probe;
  storage: Probe;
  timeoutMs: number;
}

async function status(
  probe: Probe,
  timeoutMs: number,
): Promise<'ok' | 'error'> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      Promise.resolve().then(() => probe(controller.signal)),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('Probe timeout'));
        }, timeoutMs);
      }),
    ]);
    return 'ok';
  } catch {
    return 'error';
  } finally {
    clearTimeout(timer);
  }
}

export function registerHealth(app: FastifyInstance, options: HealthOptions) {
  app.withTypeProvider<ZodTypeProvider>().get(
    '/api/health',
    {
      schema: {
        operationId: 'health',
        querystring: healthQuerySchema,
        response: {
          200: healthResponseSchema,
          503: healthResponseSchema,
          400: errorResponseSchema,
        },
      },
    },
    async (_request, reply) => {
      const [database, storage] = await Promise.all([
        status(options.database, options.timeoutMs),
        status(options.storage, options.timeoutMs),
      ]);
      return reply
        .code(database === 'ok' && storage === 'ok' ? 200 : 503)
        .send({ database, storage });
    },
  );
}
