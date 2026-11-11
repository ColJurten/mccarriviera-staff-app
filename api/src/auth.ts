import { createHash, createHmac, randomBytes } from 'node:crypto';
import { isIP } from 'node:net';
import { betterAuth, APIError } from 'better-auth';
import { symmetricDecrypt, symmetricEncrypt } from 'better-auth/crypto';
import { twoFactor } from 'better-auth/plugins';
import { sql, type Kysely } from 'kysely';
import type { DB } from './db/generated.js';
import type { Config } from './config.js';
import { resolveToken, type SessionIdentity } from './session.js';

export type AuthConfig = Pick<
  Config,
  'AUTH_SECRET' | 'AUTH_BASE_URL' | 'AUTH_TRUSTED_ORIGINS'
>;
export const WEB_COOKIE = '__Host-mcr-session';
export const FLOW_COOKIE = '__Host-mcr-flow';
const FLOW_SECONDS = 600;
export class AuthFailure extends Error {
  constructor(
    public status: 401 | 429,
    public code:
      | 'invalid_credentials'
      | 'invalid_factor'
      | 'unauthorized'
      | 'rate_limited',
  ) {
    super(code);
  }
}

// Separate contexts share identities, but native never invokes the web 2FA hook.
// These instances are internal only: no wildcard Better Auth handler is mounted.
export function createAuth(
  db: Kysely<DB>,
  config: AuthConfig,
  mode: 'native' | 'web_pending',
) {
  return betterAuth({
    appName: 'MC Car Riviera',
    baseURL: config.AUTH_BASE_URL,
    secret: config.AUTH_SECRET,
    trustedOrigins: config.AUTH_TRUSTED_ORIGINS,
    database: { db, type: 'postgres', transaction: false },
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
    },
    user: {
      modelName: 'auth_users',
      fields: {
        emailVerified: 'email_verified',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },
    account: {
      modelName: 'auth_accounts',
      fields: {
        userId: 'user_id',
        accountId: 'account_id',
        providerId: 'provider_id',
        accessToken: 'access_token',
        refreshToken: 'refresh_token',
        idToken: 'id_token',
        accessTokenExpiresAt: 'access_token_expires_at',
        refreshTokenExpiresAt: 'refresh_token_expires_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },
    session: {
      modelName: 'auth_sessions',
      fields: {
        userId: 'user_id',
        expiresAt: 'expires_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        ipAddress: 'ip_address',
        userAgent: 'user_agent',
      },
      expiresIn: mode === 'native' ? 30 * 86400 : FLOW_SECONDS,
      disableSessionRefresh: true,
      cookieCache: { enabled: false },
      additionalFields: {
        mode: {
          type: 'string',
          required: true,
          defaultValue: mode,
          input: false,
        },
      },
    },
    verification: {
      modelName: 'auth_verifications',
      fields: {
        expiresAt: 'expires_at',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      },
    },
    advanced: {
      // The Kysely adapter introspects via connection(), which transactions do
      // not support. db:check and integration tests verify the mapped schema.
      database: { generateId: 'uuid', validateSchema: false },
      useSecureCookies: true,
      cookiePrefix:
        mode === 'native' ? 'mcr-native-internal' : 'mcr-web-internal',
      defaultCookieAttributes: {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        path: '/',
      },
      ipAddress: { ipAddressHeaders: [] },
    },
    rateLimit: { enabled: true, window: 10, max: 3 },
    telemetry: { enabled: false },
    logger: { disabled: true },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const profile = await db
              .selectFrom('staff_profiles')
              .select('id')
              .where('auth_user_id', '=', session.userId)
              .where('active', '=', true)
              .executeTakeFirst();
            if (!profile) return false;
            return {
              data: { ...session, mode, ipAddress: null, userAgent: null },
            };
          },
        },
      },
    },
    plugins:
      mode === 'native'
        ? []
        : [
            twoFactor({
              issuer: 'MC Car Riviera',
              skipVerificationOnEnable: false,
              twoFactorCookieMaxAge: FLOW_SECONDS,
              schema: {
                user: { fields: { twoFactorEnabled: 'two_factor_enabled' } },
                twoFactor: {
                  modelName: 'auth_two_factors',
                  fields: {
                    userId: 'user_id',
                    backupCodes: 'backup_codes',
                    failedVerificationCount: 'failed_verification_count',
                    lockedUntil: 'locked_until',
                  },
                },
              },
            }),
          ],
  });
}

function hash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
function cookieJar(headers: Headers, previous = '') {
  const jar = new Map(
    previous
      .split('; ')
      .filter(Boolean)
      .map((value) => {
        const at = value.indexOf('=');
        return [value.slice(0, at), value.slice(at + 1)];
      }),
  );
  for (const value of headers.getSetCookie()) {
    const pair = value.split(';')[0]!;
    const at = pair.indexOf('=');
    if (/max-age=0/i.test(value)) jar.delete(pair.slice(0, at));
    else jar.set(pair.slice(0, at), pair.slice(at + 1));
  }
  return [...jar].map(([key, value]) => `${key}=${value}`).join('; ');
}
function internalHeaders(cookie = '') {
  return new Headers({ cookie });
}
function authError(
  error: unknown,
  code: 'invalid_credentials' | 'invalid_factor',
) {
  if (
    error instanceof APIError &&
    [400, 401, 403, 429].includes(error.statusCode)
  ) {
    return new AuthFailure(
      error.statusCode === 429 ? 429 : 401,
      error.statusCode === 429 ? 'rate_limited' : code,
    );
  }
  throw error;
}

// Canonicalize IPv6 and group its /64 so rotating interface addresses cannot
// bypass limits. Forwarding headers never enter this function (trustProxy=false).
export function rateAddress(ip: string) {
  if (ip.startsWith('::ffff:') && isIP(ip.slice(7)) === 4) return ip.slice(7);
  if (isIP(ip) !== 6) return ip;
  const [left = '', right = ''] = ip.split('::');
  const a = left ? left.split(':') : [];
  const b = right ? right.split(':') : [];
  const groups = ip.includes('::')
    ? [...a, ...Array<string>(8 - a.length - b.length).fill('0'), ...b]
    : a;
  return groups
    .slice(0, 4)
    .map((v) => Number.parseInt(v, 16).toString(16))
    .join(':');
}

export function createAuthentication(db: Kysely<DB>, config: AuthConfig) {
  return {
    config,
    async limit(ip: string, group: 'password' | 'factor') {
      const key = createHmac('sha256', config.AUTH_SECRET)
        .update(`${group}:${rateAddress(ip)}`)
        .digest('hex');
      await db
        .deleteFrom('auth_rate_limits')
        .where(
          'window_started_at',
          '<',
          sql<Date>`clock_timestamp() - interval '10 seconds'`,
        )
        .execute();
      const result = await sql<{
        count: number;
      }>`INSERT INTO auth_rate_limits(key, count, window_started_at)
        VALUES (${key}, 1, clock_timestamp()) ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN auth_rate_limits.window_started_at <= clock_timestamp() - interval '10 seconds' THEN 1 ELSE auth_rate_limits.count + 1 END,
        window_started_at = CASE WHEN auth_rate_limits.window_started_at <= clock_timestamp() - interval '10 seconds' THEN clock_timestamp() ELSE auth_rate_limits.window_started_at END
        RETURNING count`.execute(db);
      if (result.rows[0]!.count > 3) throw new AuthFailure(429, 'rate_limited');
    },
    resolve: (token: string, mode: 'native' | 'web') =>
      resolveToken(db, token, mode),
    async signIn(
      body: { email: string; password: string },
      mode: 'native' | 'web',
    ) {
      const result = await db.transaction().execute(async (trx) => {
        const profile = await trx
          .selectFrom('staff_profiles')
          .innerJoin('auth_users', (join) =>
            join.on(
              sql<boolean>`auth_users.id::text = staff_profiles.auth_user_id`,
            ),
          )
          .select([
            'staff_profiles.id',
            'staff_profiles.active',
            'auth_users.id as userId',
          ])
          .where('auth_users.email', '=', body.email.toLowerCase())
          .forUpdate('staff_profiles')
          .executeTakeFirst();
        const auth = createAuth(
          trx,
          config,
          mode === 'native' ? 'native' : 'web_pending',
        );
        // Run the library's password check even for unknown addresses (dummy hash).
        let response;
        try {
          response = await auth.api.signInEmail({
            body: { email: body.email, password: body.password },
            returnHeaders: true,
          });
        } catch (error) {
          if (error instanceof APIError && !profile?.active)
            return new AuthFailure(401, 'invalid_credentials');
          return authError(error, 'invalid_credentials');
        }
        if (!profile?.active)
          return new AuthFailure(401, 'invalid_credentials');
        if (mode === 'native') {
          if (!('token' in response.response) || !response.response.token)
            return new AuthFailure(401, 'invalid_credentials');
          const token = response.response.token;
          const session = await resolveToken(trx, token, 'native');
          if (!session) throw new Error('Missing new session');
          return { kind: 'native' as const, token, session };
        }
        await trx
          .deleteFrom('auth_flows')
          .where('user_id', '=', profile.userId)
          .execute();
        const cookie = cookieJar(response.headers);
        const challenged = 'twoFactorRedirect' in response.response;
        // Only one enrollment context per identity; old pending sessions never
        // become business sessions. Completed sessions remain independent.
        const current = challenged
          ? null
          : await auth.api.getSession({ headers: internalHeaders(cookie) });
        await trx
          .deleteFrom('auth_sessions')
          .where('user_id', '=', profile.userId)
          .where('mode', '=', 'web_pending')
          .$if(!!current, (q) => q.where('token', '!=', current!.session.token))
          .execute();
        const flowToken = randomBytes(32).toString('base64url');
        const state = challenged
          ? ('challenge' as const)
          : ('enrollment' as const);
        await trx
          .insertInto('auth_flows')
          .values({
            token_hash: hash(flowToken),
            user_id: profile.userId,
            state,
            internal_cookie: await symmetricEncrypt({
              key: config.AUTH_SECRET,
              data: cookie,
            }),
            expires_at: new Date(Date.now() + FLOW_SECONDS * 1000),
          })
          .execute();
        return { kind: 'web' as const, flowToken, next: state };
      });
      if (result instanceof AuthFailure) throw result;
      return result;
    },
    async continueWeb(
      flowToken: string,
      action: { password: string } | { kind: 'totp' | 'backup'; code: string },
    ) {
      const result = await db.transaction().execute(async (trx) => {
        // Same lock order as sign-in/admin; serializes backup consumption and
        // prevents a concurrently reset/deactivated profile being promoted.
        const reference = await trx
          .selectFrom('auth_flows')
          .select('user_id')
          .where('token_hash', '=', hash(flowToken))
          .executeTakeFirst();
        if (!reference) return new AuthFailure(401, 'invalid_factor');
        const profile = await trx
          .selectFrom('staff_profiles')
          .select(['id', 'active'])
          .where('auth_user_id', '=', reference.user_id)
          .forUpdate()
          .executeTakeFirst();
        const flow = await trx
          .selectFrom('auth_flows')
          .selectAll()
          .where('token_hash', '=', hash(flowToken))
          .where('expires_at', '>', sql<Date>`clock_timestamp()`)
          .forUpdate()
          .executeTakeFirst();
        if (!profile?.active || !flow)
          return new AuthFailure(401, 'invalid_factor');
        const cookie = await symmetricDecrypt({
          key: config.AUTH_SECRET,
          data: flow.internal_cookie,
        });
        const auth = createAuth(trx, config, 'web_pending');
        const headers = internalHeaders(cookie);
        try {
          if ('password' in action) {
            if (flow.state !== 'enrollment')
              return new AuthFailure(401, 'invalid_factor');
            const response = await auth.api.enableTwoFactor({
              headers,
              body: { password: action.password, method: 'totp' },
              returnHeaders: true,
            });
            if (response.response.method !== 'totp')
              throw new Error('Unexpected factor');
            await trx
              .updateTable('auth_flows')
              .set({
                internal_cookie: await symmetricEncrypt({
                  key: config.AUTH_SECRET,
                  data: cookieJar(response.headers, cookie),
                }),
              })
              .where('id', '=', flow.id)
              .execute();
            return {
              kind: 'enrollment' as const,
              totpURI: response.response.totpURI,
              backupCodes: response.response.backupCodes,
            };
          }
          if (flow.state === 'enrollment' && action.kind === 'backup')
            return new AuthFailure(401, 'invalid_factor');
          const response =
            action.kind === 'totp'
              ? await auth.api.verifyTOTP({
                  headers,
                  body: { code: action.code, trustDevice: false },
                  returnHeaders: true,
                })
              : await auth.api.verifyBackupCode({
                  headers,
                  body: { code: action.code, trustDevice: false },
                  returnHeaders: true,
                });
          const current = await auth.api.getSession({
            headers: internalHeaders(cookieJar(response.headers, cookie)),
          });
          if (!current || current.user.id !== flow.user_id)
            return new AuthFailure(401, 'invalid_factor');
          const token = current.session.token;
          await trx
            .updateTable('auth_sessions')
            .set({
              mode: 'web',
              authenticated_at: flow.created_at,
              updated_at: new Date(),
              expires_at: new Date(
                Math.min(
                  Date.now() + 1800000,
                  flow.created_at.getTime() + 43200000,
                ),
              ),
            })
            .where('token', '=', token)
            .where('mode', '=', 'web_pending')
            .executeTakeFirstOrThrow();
          await trx
            .deleteFrom('auth_flows')
            .where('id', '=', flow.id)
            .execute();
          const session = await resolveToken(trx, token, 'web');
          if (!session) throw new Error('Missing verified session');
          return { kind: 'verified' as const, token, session };
        } catch (error) {
          return authError(error, 'invalid_factor');
        }
      });
      // Commit failed-attempt counters before returning a generic failure.
      if (result instanceof AuthFailure) throw result;
      return result;
    },
    async signOut(identity: SessionIdentity) {
      await db
        .deleteFrom('auth_sessions')
        .where('id', '=', identity.sessionId)
        .execute();
    },
  };
}
export type Authentication = ReturnType<typeof createAuthentication>;
