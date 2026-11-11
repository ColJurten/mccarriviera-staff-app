import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { expect } from 'vitest';
import type { InjectOptions } from 'fastify';
import { createDatabase } from '../src/db.js';
import { readConfig } from '../src/config.js';
import { createAuthentication, WEB_COOKIE, FLOW_COOKIE } from '../src/auth.js';
import { createStaffAdmin } from '../src/staff-admin.js';
import { buildApp } from '../src/app.js';
import { requireSession } from '../src/route-policy.js';
import { publicSession } from '../src/session.js';

export async function authFixture() {
  if (process.env.DB_DISPOSABLE !== '1' || !process.env.MIGRATION_DATABASE_URL)
    throw new Error('Disposable owner database required');
  const config = readConfig();
  const owner = createDatabase(process.env.MIGRATION_DATABASE_URL, 10000);
  const runtime = createDatabase(config.DATABASE_URL, 10000);
  const auth = createAuthentication(runtime.db, config);
  const admin = createStaffAdmin(owner.db, config);
  const actorId = randomUUID();
  await owner.db
    .insertInto('staff_profiles')
    .values({
      id: actorId,
      created_by: actorId,
      display_name: 'Synthetic developer',
    })
    .execute();
  const email = `${randomUUID()}@example.com`;
  const password = randomBytes(18).toString('base64url');
  const staff = await admin.create({
    email,
    password,
    actorId,
    displayName: 'Synthetic staff',
  });
  const profile = await runtime.db
    .selectFrom('staff_profiles')
    .selectAll()
    .where('id', '=', staff.staffId)
    .executeTakeFirstOrThrow();
  const logs: string[] = [];
  const { app, routes } = await buildApp(
    {
      database: runtime.probe,
      storage: async () => {},
      timeoutMs: 1000,
      auth,
    },
    {
      write: (line) => {
        logs.push(line);
      },
    },
  );
  app.get(
    '/api/synthetic-protected',
    { preHandler: requireSession },
    async (request) => publicSession(request.staff!),
  );
  await app.register(
    async (plugin) => {
      plugin.get('/protected', { preHandler: requireSession }, async () => ({
        success: true,
      }));
    },
    { prefix: '/api/synthetic-plugin' },
  );
  const bytes = randomBytes(2);
  const remoteAddress = `198.18.${bytes[0]}.${bytes[1]}`;
  const origin = config.AUTH_TRUSTED_ORIGINS[0]!;
  const inject = (options: string | InjectOptions) =>
    app.inject(
      typeof options === 'string'
        ? { url: options, remoteAddress }
        : { ...options, remoteAddress },
    );
  return {
    config,
    owner: owner.db,
    runtime: runtime.db,
    auth,
    admin,
    app,
    routes,
    logs,
    remoteAddress,
    inject,
    actorId,
    staffId: staff.staffId,
    userId: profile.auth_user_id!,
    email,
    password,
    origin,
    async native() {
      const response = await inject({
        method: 'POST',
        url: '/api/auth/native/sign-in',
        payload: { email, password },
      });
      expect(response.statusCode, response.body).toBe(200);
      return response.json().token as string;
    },
    async web() {
      const response = await inject({
        method: 'POST',
        url: '/api/auth/web/sign-in',
        headers: { origin },
        payload: { email, password },
      });
      expect(response.statusCode, response.body).toBe(200);
      return {
        response,
        cookie:
          response.cookies.find((c) => c.name === FLOW_COOKIE)!.name +
          '=' +
          response.cookies.find((c) => c.name === FLOW_COOKIE)!.value,
      };
    },
    async enroll(cookie: string) {
      const response = await inject({
        method: 'POST',
        url: '/api/auth/web/enroll',
        headers: { origin, cookie },
        payload: { password },
      });
      expect(response.statusCode, response.body).toBe(200);
      const uri = new URL(response.json().totpURI);
      return {
        secret: uri.searchParams.get('secret')!,
        backupCodes: response.json().backupCodes as string[],
      };
    },
    async verify(
      cookie: string,
      code: string,
      kind: 'totp' | 'backup' = 'totp',
    ) {
      return inject({
        method: 'POST',
        url: '/api/auth/web/verify',
        headers: { origin, cookie },
        payload: { kind, code },
      });
    },
    async resetLimits() {
      await owner.db.deleteFrom('auth_rate_limits').execute();
    },
    async close() {
      await app.close();
      await Promise.all([owner.close(), runtime.close()]);
    },
  };
}

// Independent RFC 6238 test client: decode the enrollment URI's Base32 secret.
export function totp(secret: string) {
  let bits = '';
  for (const character of secret.toUpperCase().replace(/=+$/, ''))
    bits += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
      .indexOf(character)
      .toString(2)
      .padStart(5, '0');
  const key = Buffer.from(
    bits.match(/.{8}/g)!.map((byte) => Number.parseInt(byte, 2)),
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac('sha1', key).update(counter).digest();
  const offset = digest[digest.length - 1]! & 15;
  return ((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000)
    .toString()
    .padStart(6, '0');
}
export function sessionCookie(response: {
  cookies: { name: string; value: string }[];
}) {
  const cookie = response.cookies.find((c) => c.name === WEB_COOKIE)!;
  return `${cookie.name}=${cookie.value}`;
}
