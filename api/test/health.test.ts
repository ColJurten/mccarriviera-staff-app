import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { healthResponseSchema } from '@mccarriviera/shared';
import {
  assertRoutePolicy,
  publicRoutes,
  requireSession,
} from '../src/route-policy.js';
import { readFile } from 'node:fs/promises';

const ok = async () => {};
const options = { database: ok, storage: ok, timeoutMs: 50 };

describe('health contract', () => {
  it('checks both dependencies, validates the response and registers only GET and HEAD health', async () => {
    const database = vi.fn(ok),
      storage = vi.fn(ok);
    const { app, routes } = await buildApp({ ...options, database, storage });
    try {
      const response = await app.inject('/api/health');
      expect(response.statusCode).toBe(200);
      expect(healthResponseSchema.parse(response.json())).toEqual({
        database: 'ok',
        storage: 'ok',
      });
      expect(database).toHaveBeenCalledOnce();
      expect(storage).toHaveBeenCalledOnce();
      expect(
        routes
          .filter((r) => !r.sessionCheck)
          .map((r) => `${r.method} ${r.url}`)
          .sort(),
      ).toEqual([...publicRoutes].sort());
      expect(() => assertRoutePolicy(routes)).not.toThrow();
      expect(
        (await app.inject({ method: 'HEAD', url: '/api/health' })).body,
      ).toBe('');
    } finally {
      await app.close();
    }
  });

  it.each(['database', 'storage'] as const)(
    'returns only sanitized statuses when %s fails',
    async (dependency) => {
      const { app } = await buildApp({
        ...options,
        [dependency]: async () => {
          throw new Error('synthetic-private-dependency-detail');
        },
      });
      try {
        const response = await app.inject('/api/health');
        expect(response.statusCode).toBe(503);
        expect(response.json()).toEqual({
          database: dependency === 'database' ? 'error' : 'ok',
          storage: dependency === 'storage' ? 'error' : 'ok',
        });
        expect(response.body).not.toContain('synthetic-private');
      } finally {
        await app.close();
      }
    },
  );

  it('bounds hung probes and aborts the storage request', async () => {
    let signal: AbortSignal | undefined;
    const { app } = await buildApp({
      ...options,
      storage: (value) => {
        signal = value;
        return new Promise(() => {});
      },
    });
    try {
      const started = performance.now();
      const response = await app.inject('/api/health');
      expect(response.statusCode).toBe(503);
      expect(response.json()).toEqual({ database: 'ok', storage: 'error' });
      expect(signal?.aborted).toBe(true);
      expect(performance.now() - started).toBeLessThan(1000);
    } finally {
      await app.close();
    }
  });

  it('rejects undeclared query input without echoing values', async () => {
    const { app } = await buildApp(options);
    try {
      const response = await app.inject(
        '/api/health?name=synthetic-private-name',
      );
      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({ error: 'invalid_request' });
    } finally {
      await app.close();
    }
  });

  it('does not log input, credentials or dependency errors, including malformed requests', async () => {
    const lines: string[] = [];
    const { app } = await buildApp(
      {
        ...options,
        database: async () => {
          throw new Error('synthetic-private-error');
        },
      },
      {
        write: (text) => {
          lines.push(text);
        },
      },
    );
    try {
      await app.inject({
        url: '/api/health?secret=synthetic-private-query',
        headers: {
          authorization: 'synthetic-private-auth',
          'x-request-id': 'synthetic-private-id',
        },
      });
      await app.inject('/api/health');
      await app.inject({
        method: 'POST',
        url: '/synthetic-private-path',
        payload: { name: 'synthetic-private-body' },
      });
      await app.inject({
        method: 'GET',
        url: '/api/health',
        headers: { 'content-type': 'application/json' },
        payload: '{synthetic-private-malformed',
      });
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.join('')).not.toContain('synthetic-private');
      for (const line of lines) {
        expect(Object.keys(JSON.parse(line)).sort()).toEqual(
          ['event', 'level', 'method', 'statusCode', 'time'].sort(),
        );
      }
    } finally {
      await app.close();
    }
  });

  it('rejects an invalid response before sending any injected fields', async () => {
    const lines: string[] = [];
    const { app } = await buildApp(options, {
      write: (text) => {
        lines.push(text);
      },
    });
    app.addHook('preSerialization', async (_request, _reply, payload) => {
      if (
        typeof payload === 'object' &&
        payload !== null &&
        'database' in payload
      ) {
        return { ...payload, database: 'synthetic-private-invalid-status' };
      }
      return payload;
    });
    try {
      const response = await app.inject('/api/health');
      expect(response.statusCode).toBe(500);
      expect(response.json()).toEqual({ error: 'internal_error' });
      expect(lines.join('') + response.body).not.toContain('synthetic-private');
    } finally {
      await app.close();
    }
  });

  it('generates the committed OpenAPI artifact from shared schemas', async () => {
    const { app } = await buildApp(options);
    try {
      await app.ready();
      const spec = app.swagger();
      expect(Object.keys(spec.paths ?? {})).toEqual([
        '/api/health',
        '/api/auth/native/sign-in',
        '/api/auth/web/sign-in',
        '/api/auth/web/enroll',
        '/api/auth/web/verify',
        '/api/auth/session',
        '/api/auth/sign-out',
      ]);
      expect(spec.paths?.['/api/health']?.get?.responses).toHaveProperty('503');
      expect(spec).toEqual(
        JSON.parse(
          await readFile(new URL('../openapi.json', import.meta.url), 'utf8'),
        ),
      );
    } finally {
      await app.close();
    }
  });
});

describe('route session audit', () => {
  it('rejects an actual unprotected route at startup, even with a convincing metadata flag', async () => {
    const { app, routes } = await buildApp(options);
    app.get(
      '/accidental',
      { config: { sessionProtected: true } },
      async () => ({ exposed: true }),
    );
    await expect(app.ready()).rejects.toThrow(
      'Missing session check: GET /accidental',
    );
    expect(() => assertRoutePolicy(routes)).toThrow('Missing session check');
    await app.close();
  });
  it('accepts the actual session hook and denies requests until US-010', async () => {
    const { app, routes } = await buildApp(options);
    app.get('/private', { preHandler: requireSession }, async () => ({
      exposed: true,
    }));
    try {
      await app.ready();
      expect(() => assertRoutePolicy(routes)).not.toThrow();
      expect((await app.inject('/private')).statusCode).toBe(401);
      expect(
        (await app.inject({ method: 'HEAD', url: '/private' })).statusCode,
      ).toBe(401);
    } finally {
      await app.close();
    }
  });
});
