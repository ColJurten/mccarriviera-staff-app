import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import {
  assertRoutePolicy,
  publicRoutes,
  requireSession,
} from '../src/route-policy.js';

const ok = async () => {};
const options = { database: ok, storage: ok, timeoutMs: 50 };

describe('route inventory', () => {
  it('declares only health and the exact sign-in/continuation methods as public', () => {
    expect([...publicRoutes].sort()).toEqual([
      'GET /api/health',
      'HEAD /api/health',
      'POST /api/auth/native/enroll',
      'POST /api/auth/native/sign-in',
      'POST /api/auth/native/verify',
      'POST /api/auth/web/enroll',
      'POST /api/auth/web/sign-in',
      'POST /api/auth/web/verify',
    ]);
  });

  it('lists routes registered inside prefixed plugins and rejects them unprotected', async () => {
    const { app, routes } = await buildApp(options);
    await app.register(
      async (plugin) => {
        plugin.post('/customers', async () => ({ exposed: true }));
      },
      { prefix: '/api' },
    );
    expect(routes.map((r) => `${r.method} ${r.url}`)).toContain(
      'POST /api/customers',
    );
    await expect(app.ready()).rejects.toThrow(
      'Missing session check: POST /api/customers',
    );
    await app.close();
  });

  it('checks each method of a multi-method route separately', () => {
    expect(() =>
      assertRoutePolicy([
        { method: 'GET', url: '/api/health', sessionCheck: false },
        { method: 'DELETE', url: '/api/health', sessionCheck: false },
      ]),
    ).toThrow('Missing session check: DELETE /api/health');
  });

  it('takes the public list as its input', () => {
    const route = { method: 'POST', url: '/api/sign-in', sessionCheck: false };
    expect(() => assertRoutePolicy([route])).toThrow('Missing session check');
    expect(() =>
      assertRoutePolicy([route], new Set(['POST /api/sign-in'])),
    ).not.toThrow();
  });

  it('accepts the session hook inside a list of hooks', async () => {
    const { app, routes } = await buildApp(options);
    app.get('/private', { preHandler: [ok, requireSession] }, async () => ({
      exposed: true,
    }));
    try {
      await app.ready();
      expect(routes.find((r) => r.url === '/private')?.sessionCheck).toBe(true);
    } finally {
      await app.close();
    }
  });

  it('fails closed on unknown paths and undeclared methods', async () => {
    const { app } = await buildApp(options);
    try {
      for (const request of [
        { method: 'GET', url: '/synthetic-unknown' },
        { method: 'POST', url: '/api/health' },
      ] as const) {
        const response = await app.inject(request);
        expect(response.statusCode).toBe(401);
        expect(response.json()).toEqual({ error: 'unauthorized' });
      }
    } finally {
      await app.close();
    }
  });
});
