import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import { createAuthentication } from '../src/auth.js';
import { authFixture } from './auth-fixture.js';

const caddy = '192.0.2.10';
describe('trusted Caddy and account password budgets (PR #25)', () => {
  it('separates clients behind Caddy but ignores forged preceding hops and untrusted forwarding', async () => {
    const f = await authFixture(caddy);
    const login = (ip: string, forwarded: string, email = f.email) =>
      f.inject({
        method: 'POST',
        url: '/api/auth/native/sign-in',
        remoteAddress: ip,
        headers: { 'x-forwarded-for': forwarded },
        payload: { email, password: f.password },
      });
    try {
      await f.resetLimits();
      for (let attempt = 0; attempt < 3; attempt++)
        expect((await login(caddy, '198.51.100.1')).statusCode).toBe(200);
      expect((await login(caddy, '203.0.113.8, 198.51.100.1')).statusCode).toBe(
        429,
      );
      expect((await login(caddy, '198.51.100.2')).statusCode).toBe(200);
      expect(
        (await login('::ffff:192.0.2.10', '198.51.100.9')).statusCode,
      ).toBe(200);
      for (let attempt = 0; attempt < 3; attempt++)
        expect(
          (await login('192.0.2.11', `198.51.100.${attempt + 1}`)).statusCode,
        ).toBe(200);
      expect(
        (await login('192.0.2.11', '203.0.113.9, 198.51.100.10')).statusCode,
      ).toBe(429);
    } finally {
      await f.close();
    }
  });

  it('shares failed-password limits across normalized accounts, transports, IPs and app instances, without counting successes', async () => {
    const f = await authFixture(caddy);
    const second = await buildApp({
      database: async () => {},
      storage: async () => {},
      timeoutMs: 1000,
      trustedProxyIp: caddy,
      auth: createAuthentication(f.runtime, f.config),
    });
    const login = (
      n: number,
      email: string,
      password: string,
      web = false,
      app = f.app,
    ) =>
      app.inject({
        method: 'POST',
        url: `/api/auth/${web ? 'web' : 'native'}/sign-in`,
        remoteAddress: caddy,
        headers: {
          'x-forwarded-for': `198.51.100.${n}`,
          ...(web ? { origin: f.origin } : {}),
        },
        payload: { email, password },
      });
    try {
      await f.resetLimits();
      for (let n = 1; n <= 4; n++)
        expect(
          (await login(n, f.email, f.password, n % 2 === 0)).statusCode,
        ).toBe(200);
      for (let n = 5; n <= 7; n++)
        expect(
          (
            await login(
              n,
              n === 6 ? f.email.toUpperCase() : f.email,
              'synthetic-wrong-password',
              n % 2 === 0,
            )
          ).statusCode,
        ).toBe(401);
      const blocked = await login(
        8,
        f.email.toUpperCase(),
        f.password,
        true,
        second.app,
      );
      expect([blocked.statusCode, blocked.json()]).toEqual([
        429,
        { error: 'rate_limited' },
      ]);
      expect(
        (await login(9, `${randomUUID()}@example.com`, f.password)).statusCode,
      ).toBe(401);
      await f.owner
        .updateTable('auth_rate_limits')
        .set({
          window_started_at: sql<Date>`clock_timestamp() - interval '11 seconds'`,
        })
        .execute();
      expect((await login(10, f.email, f.password)).statusCode).toBe(200);
      const counters = await f.runtime
        .selectFrom('auth_rate_limits')
        .selectAll()
        .execute();
      expect(JSON.stringify(counters)).not.toContain(f.email);
      for (const row of counters) expect(row.key).toMatch(/^[a-f0-9]{64}$/);
    } finally {
      await second.app.close();
      await f.close();
    }
  });

  it('applies the same account budget to unknown and inactive accounts, and serializes concurrent failures without losing counters', async () => {
    const f = await authFixture(caddy);
    try {
      await f.resetLimits();
      await f.owner
        .updateTable('staff_profiles')
        .set({ active: false })
        .where('id', '=', f.staffId)
        .execute();
      for (const email of [f.email, `${randomUUID()}@example.com`]) {
        await f.resetLimits();
        const login = (n: number) =>
          f.inject({
            method: 'POST',
            url: '/api/auth/native/sign-in',
            remoteAddress: caddy,
            headers: { 'x-forwarded-for': `203.0.113.${n}` },
            payload: { email, password: f.password },
          });
        const results = await Promise.all([1, 2, 3, 4].map(login));
        expect(results.map((r) => r.statusCode).sort()).toEqual([
          401, 401, 401, 429,
        ]);
        for (const r of results.filter((r) => r.statusCode === 401))
          expect(r.json()).toEqual({ error: 'invalid_credentials' });
        expect((await login(5)).statusCode).toBe(429);
      }
    } finally {
      await f.close();
    }
  });

  it('counts failed enrollment passwords with sign-in failures, commits failures after auth rollback, and counts no correct enrollment password', async () => {
    const f = await authFixture(caddy);
    const request = (n: number, url: string, payload: Record<string, string>) =>
      f.inject({
        method: 'POST',
        url,
        remoteAddress: caddy,
        headers: { 'x-forwarded-for': `198.51.100.${n}` },
        payload,
      });
    try {
      await f.resetLimits();
      const start = await f.nativeSignIn();
      const flowToken = start.json().flowToken as string;
      const enroll = (n: number, password: string) =>
        request(n, '/api/auth/native/enroll', { flowToken, password });
      expect((await enroll(1, f.password)).statusCode).toBe(200);
      expect(
        (
          await request(2, '/api/auth/web/sign-in', {
            email: f.email,
            password: 'synthetic-wrong-password',
          })
        ).statusCode,
      ).toBe(401); // Origin required separately
      // Use native for the wrong password; the refused transport above consumes no budget.
      expect(
        (
          await request(3, '/api/auth/native/sign-in', {
            email: f.email,
            password: 'synthetic-wrong-password',
          })
        ).statusCode,
      ).toBe(401);
      expect((await enroll(4, 'synthetic-wrong-password')).statusCode).toBe(
        401,
      );
      expect((await enroll(5, 'synthetic-wrong-password')).statusCode).toBe(
        401,
      );
      expect((await enroll(6, f.password)).statusCode).toBe(429);
      expect(
        (
          await request(7, '/api/auth/native/sign-in', {
            email: f.email.toUpperCase(),
            password: f.password,
          })
        ).statusCode,
      ).toBe(429);
      await f.owner
        .updateTable('auth_rate_limits')
        .set({
          window_started_at: sql<Date>`clock_timestamp() - interval '11 seconds'`,
        })
        .execute();
      expect((await enroll(8, f.password)).statusCode).toBe(200);
    } finally {
      await f.close();
    }
  });
});
