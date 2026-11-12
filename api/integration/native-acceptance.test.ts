// Ticket #7 / PR #25 acceptance gaps found by the test step: the native
// bearer session's 30-day idle bound as an upper limit (issuance and renewal),
// and refusal of one revoked native session while another stays valid.
import { sql } from 'kysely';
import { describe, expect, it } from 'vitest';
import { authFixture } from './auth-fixture.js';

const DAY = 86400000;

describe('US-010/012 native-mode acceptance (test step)', () => {
  it('issues and renews a native bearer session for at most 30 days idle and refuses it once idle past that', async () => {
    const f = await authFixture();
    try {
      const token = await f.native();
      const headers = { authorization: `Bearer ${token}` };
      const stored = async () =>
        (
          await f.runtime
            .selectFrom('auth_sessions')
            .select(['expires_at', 'authenticated_at'])
            .where('token', '=', token)
            .executeTakeFirstOrThrow()
        ).expires_at.getTime();
      const issued = await stored();
      expect(issued - Date.now()).toBeLessThanOrEqual(30 * DAY + 5000);
      expect(issued - Date.now()).toBeGreaterThan(30 * DAY - 60000);

      // Used shortly before its idle deadline: renewed for at most 30 days.
      await f.owner
        .updateTable('auth_sessions')
        .set({ expires_at: sql<Date>`clock_timestamp() + interval '1 minute'` })
        .where('token', '=', token)
        .execute();
      const used = await f.inject({ url: '/api/synthetic-protected', headers });
      expect(used.statusCode).toBe(200);
      const renewed = Date.parse(used.json().expiresAt) - Date.now();
      expect(renewed).toBeLessThanOrEqual(30 * DAY + 5000);
      expect(renewed).toBeGreaterThan(30 * DAY - 60000);
      expect(await stored()).toBe(Date.parse(used.json().expiresAt));

      // Idle just past its deadline: refused, and not renewed by the attempt.
      await f.owner
        .updateTable('auth_sessions')
        .set({ expires_at: sql<Date>`clock_timestamp() - interval '1 second'` })
        .where('token', '=', token)
        .execute();
      const before = await stored();
      const refused = await f.inject({
        url: '/api/synthetic-protected',
        headers,
      });
      expect([refused.statusCode, refused.json()]).toEqual([
        401,
        { error: 'unauthorized' },
      ]);
      expect(await stored()).toBe(before);
    } finally {
      await f.close();
    }
  });

  it('refuses a revoked native session on its next request while another session of the same account keeps working', async () => {
    const f = await authFixture();
    try {
      const first = await f.native();
      const second = await f.native();
      expect(second).not.toBe(first);
      const call = (token: string) =>
        f.inject({
          url: '/api/synthetic-protected',
          headers: { authorization: `Bearer ${token}` },
        });
      expect((await call(first)).statusCode).toBe(200);
      expect((await call(second)).statusCode).toBe(200);
      const revoked = await f.inject({
        method: 'POST',
        url: '/api/auth/sign-out',
        headers: { authorization: `Bearer ${first}` },
        payload: {},
      });
      expect(revoked.statusCode).toBe(200);
      expect(
        await f.runtime
          .selectFrom('auth_sessions')
          .select('id')
          .where('token', '=', first)
          .executeTakeFirst(),
      ).toBeUndefined();
      const refused = await call(first);
      expect([refused.statusCode, refused.json()]).toEqual([
        401,
        { error: 'unauthorized' },
      ]);
      expect((await call(second)).statusCode).toBe(200);
      expect(f.logs.join('')).not.toContain(first);
      expect(f.logs.join('')).not.toContain(second);
    } finally {
      await f.close();
    }
  });
});
