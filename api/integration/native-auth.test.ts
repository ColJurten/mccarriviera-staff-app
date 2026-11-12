import { randomBytes } from 'node:crypto';
import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import { FLOW_COOKIE, WEB_COOKIE } from '../src/auth.js';
import { authFixture, totp } from './auth-fixture.js';

describe('native MFA and absolute expiry (PR #25)', () => {
  it('issues only a constrained flow without headers, then requires enrollment and a factor on every new sign-in', async () => {
    const f = await authFixture();
    try {
      const start = await f.nativeSignIn();
      expect(start.statusCode).toBe(200);
      expect(start.json()).toEqual({
        next: 'enrollment',
        flowToken: expect.any(String),
      });
      expect(start.headers['set-cookie']).toBeUndefined();
      const { flowToken } = start.json() as { flowToken: string };
      const pending = await f.runtime
        .selectFrom('auth_sessions')
        .selectAll()
        .where('user_id', '=', f.userId)
        .executeTakeFirstOrThrow();
      expect(pending.mode).toBe('native_pending');
      for (const headers of [
        { authorization: `Bearer ${pending.token}` },
        { authorization: `Bearer ${flowToken}` },
        { cookie: `${WEB_COOKIE}=${pending.token}` },
      ])
        expect(
          (await f.inject({ url: '/api/synthetic-protected', headers }))
            .statusCode,
        ).toBe(401);
      const factor = await f.nativeEnroll(flowToken);
      expect(
        (
          await f.inject({
            url: '/api/auth/session',
            headers: { authorization: `Bearer ${pending.token}` },
          })
        ).statusCode,
      ).toBe(401);
      // Delay factor completion synthetically: promotion must retain password time.
      const original = new Date(Date.now() - 60000);
      await f.owner
        .updateTable('auth_flows')
        .set({ created_at: original })
        .where('user_id', '=', f.userId)
        .execute();
      const verified = await f.nativeVerify(flowToken, totp(factor.secret));
      expect(verified.statusCode, verified.body).toBe(200);
      const { token, session } = verified.json();
      expect(session).toMatchObject({ mode: 'native', staffId: f.staffId });
      expect(verified.headers['set-cookie']).toBeUndefined();
      const stored = await f.runtime
        .selectFrom('auth_sessions')
        .selectAll()
        .where('token', '=', token as string)
        .executeTakeFirstOrThrow();
      expect(stored.authenticated_at).toEqual(original);
      expect(
        (
          await f.inject({
            url: '/api/synthetic-protected',
            headers: { authorization: `Bearer ${token}` },
          })
        ).statusCode,
      ).toBe(200);
      expect(
        (await f.nativeVerify(flowToken, totp(factor.secret))).statusCode,
      ).toBe(401);
      await f.resetLimits();
      const challenge = await f.inject({
        method: 'POST',
        url: '/api/auth/native/sign-in',
        headers: { 'x-client': 'iphone', 'user-agent': 'Expo' },
        payload: { email: f.email, password: f.password },
      });
      expect(challenge.json()).toEqual({
        next: 'challenge',
        flowToken: expect.any(String),
      });
      const next = challenge.json().flowToken as string;
      const results = await Promise.all([
        f.nativeVerify(next, factor.backupCodes[0]!, 'backup'),
        f.nativeVerify(next, factor.backupCodes[0]!, 'backup'),
      ]);
      expect(results.map((r) => r.statusCode).sort()).toEqual([200, 401]);
      await f.resetLimits();
      const replay = await f.nativeSignIn();
      expect(
        (
          await f.nativeVerify(
            replay.json().flowToken as string,
            factor.backupCodes[0]!,
            'backup',
          )
        ).statusCode,
      ).toBe(401);
      for (const value of [
        f.password,
        token as string,
        flowToken,
        factor.secret,
        ...factor.backupCodes,
      ])
        expect(f.logs.join('')).not.toContain(value);
    } finally {
      await f.close();
    }
  });

  it('binds flows to transport, replaces pending flows, expires them and refuses trusted-device controls', async () => {
    const f = await authFixture();
    try {
      const first = (await f.nativeSignIn()).json().flowToken as string;
      const second = (await f.nativeSignIn()).json().flowToken as string;
      expect((await f.nativeVerify(first, '123456')).statusCode).toBe(401);
      await f.resetLimits();
      const web = await f.web();
      const webFlow = web.response.cookies.find(
        (c) => c.name === FLOW_COOKIE,
      )!.value;
      expect((await f.nativeVerify(webFlow, '123456')).statusCode).toBe(401);
      expect(
        (await f.verify(`${FLOW_COOKIE}=${second}`, '123456')).statusCode,
      ).toBe(401);
      await f.resetLimits();
      const factor = await f.nativeEnroll(second);
      expect(
        (
          await f.inject({
            method: 'POST',
            url: '/api/auth/native/verify',
            payload: {
              flowToken: second,
              kind: 'totp',
              code: totp(factor.secret),
              trustDevice: true,
            },
          })
        ).statusCode,
      ).toBe(400);
      expect(
        (
          await f.inject({
            method: 'POST',
            url: '/api/auth/native/enroll',
            headers: { origin: f.origin },
            payload: { flowToken: second, password: f.password },
          })
        ).statusCode,
      ).toBe(401);
      await f.owner
        .updateTable('auth_flows')
        .set({ expires_at: sql<Date>`clock_timestamp()` })
        .where('mode', '=', 'native')
        .execute();
      expect(
        (await f.nativeVerify(second, totp(factor.secret))).statusCode,
      ).toBe(401);
      expect(
        (
          await f.inject({
            method: 'POST',
            url: '/api/auth/native/enroll',
            payload: { flowToken: second, password: f.password },
          })
        ).statusCode,
      ).toBe(401);
      await f.resetLimits();
      expect(
        (await f.nativeVerify(randomBytes(32).toString('base64url'), '123456'))
          .statusCode,
      ).toBe(401);
    } finally {
      await f.close();
    }
  });

  it('invalidates password-only enrollment contexts in both modes when the first factor is completed', async () => {
    const f = await authFixture();
    try {
      const native = (await f.nativeSignIn()).json().flowToken as string;
      const web = await f.web();
      const factor = await f.nativeEnroll(native);
      expect(
        (await f.nativeVerify(native, totp(factor.secret))).statusCode,
      ).toBe(200);
      await f.resetLimits();
      expect(
        (
          await f.inject({
            method: 'POST',
            url: '/api/auth/web/enroll',
            headers: { origin: f.origin, cookie: web.cookie },
            payload: { password: f.password },
          })
        ).statusCode,
      ).toBe(401);
      expect((await f.verify(web.cookie, totp(factor.secret))).statusCode).toBe(
        401,
      );
      expect((await f.web()).response.json()).toEqual({ next: 'challenge' });
    } finally {
      await f.close();
    }
  });

  it('limits native factor attempts and requires enrollment again after reset-factor', async () => {
    const f = await authFixture();
    try {
      const flow = (await f.nativeSignIn()).json().flowToken as string;
      const factor = await f.nativeEnroll(flow);
      expect((await f.nativeVerify(flow, 'bad')).statusCode).toBe(401);
      expect((await f.nativeVerify(flow, 'bad', 'backup')).statusCode).toBe(
        401,
      );
      expect((await f.nativeVerify(flow, totp(factor.secret))).statusCode).toBe(
        429,
      );
      await f.resetLimits();
      expect((await f.nativeVerify(flow, totp(factor.secret))).statusCode).toBe(
        200,
      );
      const pending = (await f.nativeSignIn()).json().flowToken as string;
      const web = await f.web();
      await f.admin.change('reset-factor', f.staffId, f.actorId);
      expect(
        (await f.nativeVerify(pending, factor.backupCodes[0]!, 'backup'))
          .statusCode,
      ).toBe(401);
      await f.resetLimits();
      expect((await f.verify(web.cookie, totp(factor.secret))).statusCode).toBe(
        401,
      );
      expect((await f.nativeSignIn()).json().next).toBe('enrollment');
      expect((await f.web()).response.json().next).toBe('enrollment');
    } finally {
      await f.close();
    }
  });

  it('serializes native factor completion with developer deactivation and factor reset', async () => {
    for (const action of ['deactivate', 'reset-factor'] as const) {
      const f = await authFixture();
      try {
        const token = await f.native();
        const flow = (await f.nativeSignIn()).json().flowToken as string;
        await f.resetLimits();
        const [verification] = await Promise.all([
          f.nativeVerify(flow, totp(f.factor().secret)),
          f.admin.change(action, f.staffId, f.actorId),
        ]);
        expect([200, 401]).toContain(verification.statusCode);
        expect(
          (
            await f.inject({
              url: '/api/auth/session',
              headers: { authorization: `Bearer ${token}` },
            })
          ).statusCode,
        ).toBe(401);
        expect(
          await f.runtime
            .selectFrom('auth_sessions')
            .select('id')
            .where('user_id', '=', f.userId)
            .execute(),
        ).toEqual([]);
        expect(
          await f.runtime
            .selectFrom('auth_flows')
            .select('id')
            .where('user_id', '=', f.userId)
            .execute(),
        ).toEqual([]);
      } finally {
        await f.close();
      }
    }
  });

  it('renews within the 90-day deadline, never changes authenticated_at and refuses an overlong stored expiry at the cap', async () => {
    const f = await authFixture();
    try {
      const token = await f.native();
      const original = new Date(Date.now() - 89 * 86400000 - 86340000);
      await f.owner
        .updateTable('auth_sessions')
        .set({
          authenticated_at: original,
          expires_at: sql<Date>`clock_timestamp() + interval '100 days'`,
        })
        .where('token', '=', token)
        .execute();
      const headers = { authorization: `Bearer ${token}` };
      const active = await f.inject({ url: '/api/auth/session', headers });
      expect(active.statusCode).toBe(200);
      expect(Date.parse(active.json().expiresAt)).toBe(
        original.getTime() + 90 * 86400000,
      );
      const stored = await f.runtime
        .selectFrom('auth_sessions')
        .select('authenticated_at')
        .where('token', '=', token)
        .executeTakeFirstOrThrow();
      expect(stored.authenticated_at).toEqual(original);
      await f.owner
        .updateTable('auth_sessions')
        .set({
          authenticated_at: sql<Date>`clock_timestamp() - interval '90 days'`,
          expires_at: sql<Date>`clock_timestamp() + interval '100 days'`,
        })
        .where('token', '=', token)
        .execute();
      expect(
        (await f.inject({ url: '/api/auth/session', headers })).statusCode,
      ).toBe(401);
    } finally {
      await f.close();
    }
  });
});
