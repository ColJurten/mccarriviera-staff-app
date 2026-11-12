import { randomBytes } from 'node:crypto';
import { expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createAuthentication, rateAddress } from '../src/auth.js';
import { createDatabase } from '../src/db.js';
import { requireSession } from '../src/route-policy.js';

it('canonicalizes addresses and groups IPv6 interface rotations for rate limits', () => {
  expect(rateAddress('::ffff:192.0.2.1')).toBe('192.0.2.1');
  expect(rateAddress('2001:db8:0:0::1')).toBe(rateAddress('2001:0db8::ff'));
});
it('fails closed when session storage fails, with no dependency detail or tokens in logs', async () => {
  const db = createDatabase('postgresql://synthetic@127.0.0.1:1/synthetic', 50);
  const auth = createAuthentication(db.db, {
    AUTH_SECRET: randomBytes(32).toString('hex'),
    AUTH_BASE_URL: 'https://app.example.com',
    AUTH_TRUSTED_ORIGINS: ['https://app.example.com'],
  });
  const logs: string[] = [];
  const { app } = await buildApp(
    { database: async () => {}, storage: async () => {}, timeoutMs: 50, auth },
    {
      write: (text) => {
        logs.push(text);
      },
    },
  );
  app.get('/private', { preHandler: requireSession }, async () => ({
    exposed: true,
  }));
  try {
    const response = await app.inject({
      url: '/private',
      headers: { authorization: 'Bearer synthetic-private-token' },
    });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toEqual({ error: 'internal_error' });
    expect(logs.join('')).toContain('auth_storage_unavailable');
    expect(logs.join('')).not.toMatch(/synthetic|ECONN|token/);
  } finally {
    await app.close();
    await db.close();
  }
});
