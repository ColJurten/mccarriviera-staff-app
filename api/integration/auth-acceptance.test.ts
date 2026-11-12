// Ticket #7 acceptance gaps found by the test step: web-mode parity with the
// native checks (generic errors, rate limit, inactive profile) and the web
// cookie's 30-minute lifetime as seen by the browser.
import { describe, expect, it } from 'vitest';
import { authFixture, sessionCookie, totp } from './auth-fixture.js';
import { WEB_COOKIE } from '../src/auth.js';

const maxAge = (setCookie: string | string[] | undefined) => {
  const value = (Array.isArray(setCookie) ? setCookie : [setCookie ?? ''])
    .filter((v) => v.startsWith(`${WEB_COOKIE}=`))
    .at(-1);
  expect(value).toBeDefined();
  expect(value).toMatch(/; Path=\/; HttpOnly; Secure; SameSite=Strict;/);
  return Number(/Max-Age=(\d+)/.exec(value!)![1]);
};

describe('US-010/015 web-mode acceptance (test step)', () => {
  it('gives the same generic error for wrong password, unknown e-mail and inactive profile on web sign-in', async () => {
    const f = await authFixture();
    try {
      const login = (email: string, password: string) =>
        f.inject({
          method: 'POST',
          url: '/api/auth/web/sign-in',
          headers: { origin: f.origin },
          payload: { email, password },
        });
      const wrong = await login(f.email, 'synthetic-wrong-password');
      const unknown = await login('unknown-web@example.com', f.password);
      await f.resetLimits();
      await f.owner
        .updateTable('staff_profiles')
        .set({ active: false })
        .where('id', '=', f.staffId)
        .execute();
      const inactive = await login(f.email, f.password);
      for (const response of [wrong, unknown, inactive]) {
        expect([response.statusCode, response.json()]).toEqual([
          401,
          { error: 'invalid_credentials' },
        ]);
        expect(response.headers['set-cookie']).toBeUndefined();
      }
    } finally {
      await f.close();
    }
  });

  it('rate-limits web password attempts, even with the correct password', async () => {
    const f = await authFixture();
    try {
      const login = (password: string) =>
        f.inject({
          method: 'POST',
          url: '/api/auth/web/sign-in',
          headers: { origin: f.origin },
          payload: { email: f.email, password },
        });
      for (let attempt = 0; attempt < 3; attempt++)
        expect((await login('synthetic-wrong-password')).statusCode).toBe(401);
      const limited = await login(f.password);
      expect([limited.statusCode, limited.json()]).toEqual([
        429,
        { error: 'rate_limited' },
      ]);
    } finally {
      await f.close();
    }
  });

  it('issues a web cookie that lasts at most 30 minutes and is renewed for at most 30 minutes on use', async () => {
    const f = await authFixture();
    try {
      const pending = await f.web();
      const enrolled = await f.enroll(pending.cookie);
      const verified = await f.verify(pending.cookie, totp(enrolled.secret));
      expect(verified.statusCode, verified.body).toBe(200);
      const issued = maxAge(verified.headers['set-cookie']);
      expect(issued).toBeGreaterThan(1790);
      expect(issued).toBeLessThanOrEqual(1800);
      const used = await f.inject({
        url: '/api/auth/session',
        headers: { cookie: sessionCookie(verified), origin: f.origin },
      });
      expect(used.statusCode).toBe(200);
      const renewed = maxAge(used.headers['set-cookie']);
      expect(renewed).toBeGreaterThan(1790);
      expect(renewed).toBeLessThanOrEqual(1800);
      expect(
        Date.parse(used.json().expiresAt) - Date.now(),
      ).toBeLessThanOrEqual(1800000);
    } finally {
      await f.close();
    }
  });

  it('refuses a previously verified web session on its next request once the profile is inactive', async () => {
    const f = await authFixture();
    try {
      const pending = await f.web();
      const enrolled = await f.enroll(pending.cookie);
      const verified = await f.verify(pending.cookie, totp(enrolled.secret));
      expect(verified.statusCode, verified.body).toBe(200);
      const cookie = sessionCookie(verified);
      expect(
        (await f.inject({ url: '/api/auth/session', headers: { cookie } }))
          .statusCode,
      ).toBe(200);
      await f.owner
        .updateTable('staff_profiles')
        .set({ active: false })
        .where('id', '=', f.staffId)
        .execute();
      const refused = await f.inject({
        url: '/api/auth/session',
        headers: { cookie },
      });
      expect([refused.statusCode, refused.json()]).toEqual([
        401,
        { error: 'unauthorized' },
      ]);
    } finally {
      await f.close();
    }
  });
});
