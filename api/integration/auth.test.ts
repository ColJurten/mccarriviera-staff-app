import { describe, expect, it } from 'vitest';
import { sql } from 'kysely';
import { authFixture, sessionCookie, totp } from './auth-fixture.js';
import { buildApp } from '../src/app.js';
import { createAuthentication, WEB_COOKIE, FLOW_COOKIE } from '../src/auth.js';
import { assertRoutePolicy, publicRoutes } from '../src/route-policy.js';

describe('US-010/012/015 real Postgres sessions', () => {
  it('signs in invite-only, resolves across instances, audits actual guards and revokes on sign-out', async () => {
    const f = await authFixture();
    const second = await buildApp({
      database: async () => {},
      storage: async () => {},
      timeoutMs: 50,
      auth: createAuthentication(f.runtime, f.config),
    });
    try {
      const token = await f.native();
      const headers = { authorization: `Bearer ${token}` };
      expect(
        (await f.inject({ url: '/api/synthetic-protected', headers })).json(),
      ).toMatchObject({ staffId: f.staffId, mode: 'native' });
      expect(
        (await second.app.inject({ url: '/api/auth/session', headers }))
          .statusCode,
      ).toBe(200);
      expect(
        (
          await f.runtime
            .selectFrom('auth_sessions')
            .selectAll()
            .where('token', '=', token)
            .executeTakeFirstOrThrow()
        ).mode,
      ).toBe('native');
      for (const url of [
        '/api/synthetic-plugin/protected',
        '/api/synthetic-protected',
      ]) {
        expect(
          (await f.inject({ method: 'HEAD', url, headers })).statusCode,
        ).toBe(200);
      }
      expect(f.logs.join('')).not.toContain(token);
      assertRoutePolicy(f.routes);
      for (const route of f.routes.filter(
        (r) => !publicRoutes.has(`${r.method} ${r.url}`),
      )) {
        expect(
          (await f.inject({ method: route.method as 'GET', url: route.url }))
            .statusCode,
        ).toBe(401);
      }
      for (const url of [
        '/api/auth/sign-up/email',
        '/api/auth/admin/create-user',
        '/api/auth/two-factor/disable',
      ]) {
        expect(
          (await f.inject({ method: 'POST', url, payload: {} })).statusCode,
        ).toBe(401);
      }
      expect((await f.inject('/api/auth/native/sign-in')).statusCode).toBe(401);
      expect(
        (
          await f.inject({
            url: '/api/synthetic-protected',
            headers: { authorization: 'Bearer malformed' },
          })
        ).statusCode,
      ).toBe(401);
      expect(
        (
          await f.inject({
            method: 'POST',
            url: '/api/auth/sign-out',
            headers,
            payload: {},
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (await second.app.inject({ url: '/api/auth/session', headers }))
          .statusCode,
      ).toBe(401);
    } finally {
      await second.app.close();
      await f.close();
    }
  });

  it('uses generic password errors and persisted HTTP limits with spoofed proxy headers ignored', async () => {
    const f = await authFixture();
    try {
      const login = (email: string, password: string, forwarded: string) =>
        f.inject({
          method: 'POST',
          url: '/api/auth/native/sign-in',
          headers: { 'x-forwarded-for': forwarded },
          payload: { email, password },
        });
      const wrong = await login(
        f.email,
        'synthetic-wrong-password',
        '192.0.2.1',
      );
      const unknown = await login(
        'unknown@example.com',
        f.password,
        '192.0.2.2',
      );
      expect([wrong.statusCode, wrong.json()]).toEqual([
        401,
        { error: 'invalid_credentials' },
      ]);
      expect([unknown.statusCode, unknown.json()]).toEqual([
        wrong.statusCode,
        wrong.json(),
      ]);
      await login(f.email, f.password, '192.0.2.3');
      const limited = await login(f.email, f.password, '192.0.2.4');
      expect(limited.statusCode).toBe(429);
      await f.owner
        .updateTable('auth_rate_limits')
        .set({
          window_started_at: sql<Date>`clock_timestamp() - interval '11 seconds'`,
        })
        .execute();
      expect((await login(f.email, f.password, '192.0.2.5')).statusCode).toBe(
        200,
      );
    } finally {
      await f.close();
    }
  });

  it('requires enrollment and a verified factor, with strict cookies, no disclosed web tokens and one-use backup codes', async () => {
    const f = await authFixture();
    try {
      const pending = await f.web();
      expect(pending.response.json()).toEqual({ next: 'enrollment' });
      expect(pending.response.headers['cache-control']).toBe('no-store');
      expect(pending.response.headers['set-auth-token']).toBeUndefined();
      expect(
        (
          await f.inject({
            url: '/api/synthetic-protected',
            headers: { cookie: pending.cookie },
          })
        ).statusCode,
      ).toBe(401);
      const enrolled = await f.enroll(pending.cookie);
      expect(
        (
          await f.inject({
            url: '/api/synthetic-protected',
            headers: { cookie: pending.cookie },
          })
        ).statusCode,
      ).toBe(401);
      const verified = await f.verify(pending.cookie, totp(enrolled.secret));
      expect(verified.statusCode, verified.body).toBe(200);
      expect(verified.json()).toMatchObject({
        staffId: f.staffId,
        mode: 'web',
      });
      expect(verified.body).not.toMatch(/token|secret|backupCodes/);
      expect(verified.headers['set-auth-token']).toBeUndefined();
      const cookie = sessionCookie(verified);
      const set = verified.headers['set-cookie'] as string[];
      expect(set.find((v) => v.startsWith(`${WEB_COOKIE}=`))).toMatch(
        /HttpOnly; Secure; SameSite=Strict/,
      );
      expect(
        (
          await f.inject({
            url: '/api/synthetic-protected',
            headers: { cookie },
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (await f.verify(pending.cookie, totp(enrolled.secret))).statusCode,
      ).toBe(401);
      await f.resetLimits();
      const challenge = await f.web();
      expect(challenge.response.json()).toEqual({ next: 'challenge' });
      expect(
        (
          await f.inject({
            url: '/api/synthetic-protected',
            headers: { cookie: challenge.cookie },
          })
        ).statusCode,
      ).toBe(401);
      const concurrent = await Promise.all([
        f.verify(challenge.cookie, enrolled.backupCodes[0]!, 'backup'),
        f.verify(challenge.cookie, enrolled.backupCodes[0]!, 'backup'),
      ]);
      expect(concurrent.map((r) => r.statusCode).sort()).toEqual([200, 401]);
      const backup = concurrent.find((r) => r.statusCode === 200)!;
      expect(backup.statusCode, backup.body).toBe(200);
      await f.resetLimits();
      const replay = await f.web();
      expect(
        (await f.verify(replay.cookie, enrolled.backupCodes[0]!, 'backup'))
          .statusCode,
      ).toBe(401);
      expect(
        (await f.verify(replay.cookie, 'invalid-code', 'totp')).json(),
      ).toEqual({ error: 'invalid_factor' });
      expect(await f.native()).toEqual(expect.any(String));
      for (const secret of [
        f.password,
        enrolled.secret,
        ...enrolled.backupCodes,
      ])
        expect(f.logs.join('')).not.toContain(secret);
    } finally {
      await f.close();
    }
  });

  it('rate-limits TOTP/backup/enrollment attempts together and refuses trusted-device input', async () => {
    const f = await authFixture();
    try {
      const pending = await f.web();
      const enrolled = await f.enroll(pending.cookie);
      expect((await f.verify(pending.cookie, 'bad')).statusCode).toBe(401);
      expect((await f.verify(pending.cookie, 'bad', 'backup')).statusCode).toBe(
        401,
      );
      expect(
        (await f.verify(pending.cookie, totp(enrolled.secret))).statusCode,
      ).toBe(429);
      await f.owner
        .updateTable('auth_rate_limits')
        .set({
          window_started_at: sql<Date>`clock_timestamp() - interval '11 seconds'`,
        })
        .execute();
      expect(
        (await f.verify(pending.cookie, totp(enrolled.secret))).statusCode,
      ).toBe(200);
      await f.resetLimits();
      const challenge = await f.web();
      expect(
        (
          await f.inject({
            method: 'POST',
            url: '/api/auth/web/verify',
            headers: { origin: f.origin, cookie: challenge.cookie },
            payload: {
              kind: 'totp',
              code: totp(enrolled.secret),
              trustDevice: true,
            },
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await f.inject({
            method: 'POST',
            url: '/api/auth/web/enroll',
            headers: { origin: f.origin, cookie: challenge.cookie },
            payload: { password: f.password },
          })
        ).statusCode,
      ).toBe(401);
    } finally {
      await f.close();
    }
  });

  it('separates native, pending and complete web credentials and enforces origin/CSRF rules', async () => {
    const f = await authFixture();
    try {
      const native = await f.native();
      await f.resetLimits();
      const pending = await f.web();
      const enrollment = f.factor();
      const verified = await f.verify(pending.cookie, totp(enrollment.secret));
      expect(verified.statusCode, verified.body).toBe(200);
      const cookie = sessionCookie(verified);
      const webToken = verified.cookies.find(
        (c) => c.name === WEB_COOKIE,
      )!.value;
      for (const headers of [
        { cookie: `${WEB_COOKIE}=${native}` },
        { authorization: `Bearer ${webToken}` },
        { authorization: `Bearer ${native}`, origin: f.origin },
        { authorization: `Bearer ${native}`, cookie },
        { cookie, origin: 'https://untrusted.example.com' },
        { cookie: `${cookie}; ${FLOW_COOKIE}=synthetic-pending-token` },
        { cookie: `${cookie}; ${cookie}` },
      ])
        expect(
          (await f.inject({ url: '/api/synthetic-protected', headers }))
            .statusCode,
        ).toBe(401);
      expect(
        (
          await f.inject({
            method: 'POST',
            url: '/api/auth/native/sign-in',
            headers: { origin: f.origin },
            payload: { email: f.email, password: f.password },
          })
        ).statusCode,
      ).toBe(401);
      expect(
        (
          await f.inject({
            method: 'POST',
            url: '/api/auth/web/sign-in',
            payload: { email: f.email, password: f.password },
          })
        ).statusCode,
      ).toBe(401);
      expect(
        (
          await f.inject({
            method: 'POST',
            url: '/api/auth/sign-out',
            headers: { cookie },
            payload: {},
          })
        ).statusCode,
      ).toBe(401);
      const out = await f.inject({
        method: 'POST',
        url: '/api/auth/sign-out',
        headers: { cookie, origin: f.origin },
        payload: {},
      });
      expect(out.statusCode).toBe(200);
      expect(
        (out.headers['set-cookie'] as string[]).filter((v) =>
          v.startsWith(`${WEB_COOKIE}=`),
        ),
      ).toEqual([expect.stringMatching(/^__Host-mcr-session=;/)]);
      expect(out.headers['set-cookie']).toEqual(
        expect.arrayContaining([expect.stringContaining('Max-Age=0')]),
      );
      expect(
        (
          await f.inject({
            url: '/api/synthetic-protected',
            headers: { cookie },
          })
        ).statusCode,
      ).toBe(401);
    } finally {
      await f.close();
    }
  });

  it('renews native idle time and web idle time without extending the web hard cap', async () => {
    const f = await authFixture();
    try {
      const native = await f.native();
      await f.owner
        .updateTable('auth_sessions')
        .set({
          expires_at: sql<Date>`clock_timestamp() + interval '1 minute'`,
          authenticated_at: sql<Date>`clock_timestamp() - interval '60 days'`,
        })
        .where('token', '=', native)
        .execute();
      const active = await f.inject({
        url: '/api/synthetic-protected',
        headers: { authorization: `Bearer ${native}` },
      });
      expect(Date.parse(active.json().expiresAt) - Date.now()).toBeGreaterThan(
        29 * 86400000,
      );
      await f.owner
        .updateTable('auth_sessions')
        .set({ expires_at: sql<Date>`clock_timestamp()` })
        .where('token', '=', native)
        .execute();
      expect(
        (
          await f.inject({
            url: '/api/synthetic-protected',
            headers: { authorization: `Bearer ${native}` },
          })
        ).statusCode,
      ).toBe(401);
      const pending = await f.web();
      const enrollment = f.factor();
      const verified = await f.verify(pending.cookie, totp(enrollment.secret));
      expect(verified.statusCode, verified.body).toBe(200);
      const cookie = sessionCookie(verified);
      const token = cookie.split('=')[1]!;
      await f.owner
        .updateTable('auth_sessions')
        .set({
          expires_at: sql<Date>`clock_timestamp() + interval '1 second'`,
          authenticated_at: sql<Date>`clock_timestamp() - interval '11 hours 59 minutes'`,
        })
        .where('token', '=', token)
        .execute();
      const nearingCap = await f.inject({
        url: '/api/synthetic-protected',
        headers: { cookie },
      });
      expect(nearingCap.statusCode).toBe(200);
      expect(
        Date.parse(nearingCap.json().expiresAt) - Date.now(),
      ).toBeLessThanOrEqual(60000);
      await f.owner
        .updateTable('auth_sessions')
        .set({
          authenticated_at: sql<Date>`clock_timestamp() - interval '12 hours'`,
        })
        .where('token', '=', token)
        .execute();
      expect(
        (
          await f.inject({
            url: '/api/synthetic-protected',
            headers: { cookie },
          })
        ).statusCode,
      ).toBe(401);
      await f.owner
        .updateTable('auth_sessions')
        .set({
          authenticated_at: new Date(),
          expires_at: sql<Date>`clock_timestamp()`,
        })
        .where('token', '=', token)
        .execute();
      expect(
        (
          await f.inject({
            url: '/api/synthetic-protected',
            headers: { cookie },
          })
        ).statusCode,
      ).toBe(401);
    } finally {
      await f.close();
    }
  });

  it('expires pending flows and refuses their internal sessions as business credentials', async () => {
    const f = await authFixture();
    try {
      const pending = await f.web();
      const session = await f.runtime
        .selectFrom('auth_sessions')
        .select('token')
        .where('user_id', '=', f.userId)
        .where('mode', '=', 'web_pending')
        .executeTakeFirstOrThrow();
      expect(
        (
          await f.inject({
            url: '/api/synthetic-protected',
            headers: { authorization: `Bearer ${session.token}` },
          })
        ).statusCode,
      ).toBe(401);
      expect(
        (
          await f.inject({
            url: '/api/synthetic-protected',
            headers: { cookie: `${WEB_COOKIE}=${session.token}` },
          })
        ).statusCode,
      ).toBe(401);
      await f.owner
        .updateTable('auth_flows')
        .set({ expires_at: sql<Date>`clock_timestamp()` })
        .where('user_id', '=', f.userId)
        .execute();
      expect((await f.verify(pending.cookie, '123456')).statusCode).toBe(401);
      expect(
        (
          await f.inject({
            method: 'POST',
            url: '/api/auth/web/enroll',
            headers: { cookie: pending.cookie, origin: f.origin },
            payload: { password: f.password },
          })
        ).statusCode,
      ).toBe(401);
    } finally {
      await f.close();
    }
  });

  it('refuses missing/inactive profiles immediately, including new sign-in and pending factor completion', async () => {
    const f = await authFixture();
    try {
      const token = await f.native();
      await f.resetLimits();
      const pending = await f.web();
      const enrollment = f.factor();
      await f.owner
        .updateTable('staff_profiles')
        .set({ active: false })
        .where('id', '=', f.staffId)
        .execute();
      expect(
        (
          await f.inject({
            url: '/api/synthetic-protected',
            headers: { authorization: `Bearer ${token}` },
          })
        ).statusCode,
      ).toBe(401);
      expect(
        (await f.verify(pending.cookie, totp(enrollment.secret))).statusCode,
      ).toBe(401);
      expect(
        (
          await f.inject({
            method: 'POST',
            url: '/api/auth/native/sign-in',
            payload: { email: f.email, password: f.password },
          })
        ).json(),
      ).toEqual({ error: 'invalid_credentials' });
      await f.owner
        .updateTable('staff_profiles')
        .set({ active: true, auth_user_id: null })
        .where('id', '=', f.staffId)
        .execute();
      expect(
        (
          await f.inject({
            url: '/api/synthetic-protected',
            headers: { authorization: `Bearer ${token}` },
          })
        ).statusCode,
      ).toBe(401);
    } finally {
      await f.close();
    }
  });
});
