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
    public failedPassword = false,
  ) {
    super(code);
  }
}

// Separate transport contexts share identities and require the same library MFA.
// These instances are internal only: no wildcard Better Auth handler is mounted.
export function createAuth(
  db: Kysely<DB>,
  config: AuthConfig,
  mode: 'native_pending' | 'web_pending',
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
      expiresIn: FLOW_SECONDS,
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
        mode === 'native_pending' ? 'mcr-native-internal' : 'mcr-web-internal',
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
    plugins: [
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
  failedPassword = code === 'invalid_credentials',
) {
  if (
    error instanceof APIError &&
    [400, 401, 403, 429].includes(error.statusCode)
  ) {
    return new AuthFailure(
      error.statusCode === 429 ? 429 : 401,
      error.statusCode === 429 ? 'rate_limited' : code,
      error.statusCode !== 429 && failedPassword,
    );
  }
  throw error;
}

// Canonicalize IPv6 and group its /64 so rotating interface addresses cannot
// bypass limits. Only Fastify's validated connection/proxy address enters here.
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

// Shared with developer commands; runtime does not need profile UPDATE grants.
export async function lockStaffAuth(db: Kysely<DB>, userId: string) {
  await sql`SELECT pg_advisory_xact_lock(hashtextextended(${'staff-auth:' + userId}, 0))`.execute(
    db,
  );
}
async function incrementLimit(db: Kysely<DB>, key: string) {
  const result = await sql<{
    count: number;
  }>`INSERT INTO auth_rate_limits(key, count, window_started_at)
    VALUES (${key}, 1, clock_timestamp()) ON CONFLICT (key) DO UPDATE SET
    count = CASE WHEN auth_rate_limits.window_started_at <= clock_timestamp() - interval '10 seconds' THEN 1 ELSE auth_rate_limits.count + 1 END,
    window_started_at = CASE WHEN auth_rate_limits.window_started_at <= clock_timestamp() - interval '10 seconds' THEN clock_timestamp() ELSE auth_rate_limits.window_started_at END
    RETURNING count`.execute(db);
  return result.rows[0]!.count;
}
export function createAuthentication(db: Kysely<DB>, config: AuthConfig) {
  const limitKey = (value: string) =>
    createHmac('sha256', config.AUTH_SECRET).update(value).digest('hex');
  // Serialize the account budget. A savepoint lets failed authentication work
  // roll back while its failed-password counter still commits on this connection.
  async function passwordAttempt<T>(
    email: string,
    operation: (trx: Kysely<DB>) => Promise<T | AuthFailure>,
  ): Promise<T> {
    const key = limitKey(`account-password:${email.toLowerCase()}`);
    const result = await db.transaction().execute(async (budget) => {
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`.execute(
        budget,
      );
      const counter = await budget
        .selectFrom('auth_rate_limits')
        .select('count')
        .where('key', '=', key)
        .where(
          'window_started_at',
          '>',
          sql<Date>`clock_timestamp() - interval '10 seconds'`,
        )
        .executeTakeFirst();
      if (counter && counter.count >= 3)
        return new AuthFailure(429, 'rate_limited');
      await sql`SAVEPOINT password_attempt`.execute(budget);
      let value: T | AuthFailure;
      try {
        value = await operation(budget);
      } catch (error) {
        if (!(error instanceof AuthFailure)) throw error;
        value = error;
      }
      if (value instanceof AuthFailure) {
        await sql`ROLLBACK TO SAVEPOINT password_attempt`.execute(budget);
        if (value.failedPassword) await incrementLimit(budget, key);
      }
      await sql`RELEASE SAVEPOINT password_attempt`.execute(budget);
      return value;
    });
    if (result instanceof AuthFailure) throw result;
    return result;
  }
  return {
    config,
    async limit(ip: string, group: 'password' | 'factor') {
      const key = limitKey(`${group}:${rateAddress(ip)}`);
      await db
        .deleteFrom('auth_rate_limits')
        .where(
          'window_started_at',
          '<',
          sql<Date>`clock_timestamp() - interval '10 seconds'`,
        )
        .execute();
      if ((await incrementLimit(db, key)) > 3)
        throw new AuthFailure(429, 'rate_limited');
    },
    resolve: (token: string, mode: 'native' | 'web') =>
      resolveToken(db, token, mode),
    async signIn(
      body: { email: string; password: string },
      mode: 'native' | 'web',
    ) {
      return passwordAttempt(body.email, async (trx) => {
        const user = await trx
          .selectFrom('auth_users')
          .select('id')
          .where('email', '=', body.email.toLowerCase())
          .executeTakeFirst();
        if (user) await lockStaffAuth(trx, user.id);
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
          .executeTakeFirst();
        const auth = createAuth(
          trx,
          config,
          mode === 'native' ? 'native_pending' : 'web_pending',
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
            return new AuthFailure(401, 'invalid_credentials', true);
          return authError(error, 'invalid_credentials');
        }
        if (!profile?.active)
          return new AuthFailure(401, 'invalid_credentials', true);
        await trx
          .deleteFrom('auth_flows')
          .where('user_id', '=', profile.userId)
          .where('mode', '=', mode)
          .execute();
        const cookie = cookieJar(response.headers);
        const challenged = 'twoFactorRedirect' in response.response;
        // One pending context per identity and mode; old pending sessions never
        // become business sessions. Completed sessions remain independent.
        const current = challenged
          ? null
          : await auth.api.getSession({ headers: internalHeaders(cookie) });
        await trx
          .deleteFrom('auth_sessions')
          .where('user_id', '=', profile.userId)
          .where('mode', '=', `${mode}_pending`)
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
            mode,
            state,
            internal_cookie: await symmetricEncrypt({
              key: config.AUTH_SECRET,
              data: cookie,
            }),
            expires_at: new Date(Date.now() + FLOW_SECONDS * 1000),
          })
          .execute();
        return { flowToken, next: state };
      });
    },
    async continueFlow(
      flowToken: string,
      mode: 'native' | 'web',
      action: { password: string } | { kind: 'totp' | 'backup'; code: string },
    ) {
      const attempt = async (trx: Kysely<DB>) => {
        // Same lock order as sign-in/admin; serializes backup consumption and
        // prevents a concurrently reset/deactivated profile being promoted.
        const reference = await trx
          .selectFrom('auth_flows')
          .select('user_id')
          .where('token_hash', '=', hash(flowToken))
          .where('mode', '=', mode)
          .executeTakeFirst();
        if (!reference) return new AuthFailure(401, 'invalid_factor');
        await lockStaffAuth(trx, reference.user_id);
        const profile = await trx
          .selectFrom('staff_profiles')
          .select(['id', 'active'])
          .where('auth_user_id', '=', reference.user_id)
          .executeTakeFirst();
        const flow = await trx
          .selectFrom('auth_flows')
          .selectAll()
          .where('token_hash', '=', hash(flowToken))
          .where('expires_at', '>', sql<Date>`clock_timestamp()`)
          .where('mode', '=', mode)
          .forUpdate()
          .executeTakeFirst();
        if (!profile?.active || !flow)
          return new AuthFailure(401, 'invalid_factor');
        const user = await trx
          .selectFrom('auth_users')
          .select('two_factor_enabled')
          .where('id', '=', reference.user_id)
          .executeTakeFirstOrThrow();
        // A simultaneous first enrollment in the other transport supersedes
        // this password-only context; it must never replace an enabled factor.
        if (flow.state === 'enrollment' && user.two_factor_enabled)
          return new AuthFailure(401, 'invalid_factor');
        const cookie = await symmetricDecrypt({
          key: config.AUTH_SECRET,
          data: flow.internal_cookie,
        });
        const auth = createAuth(trx, config, `${mode}_pending`);
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
          const promoted = await trx
            .updateTable('auth_sessions')
            .set({
              mode,
              authenticated_at: flow.created_at,
              updated_at: new Date(),
              expires_at: new Date(
                Math.min(
                  Date.now() + (mode === 'native' ? 30 * 86400000 : 1800000),
                  flow.created_at.getTime() +
                    (mode === 'native' ? 90 * 86400000 : 43200000),
                ),
              ),
            })
            .where('token', '=', token)
            .where('mode', '=', `${mode}_pending`)
            .executeTakeFirstOrThrow();
          if (promoted.numUpdatedRows !== 1n)
            throw new Error('Missing pending session');
          if (flow.state === 'enrollment') {
            await trx
              .deleteFrom('auth_flows')
              .where('user_id', '=', flow.user_id)
              .execute();
            await trx
              .deleteFrom('auth_sessions')
              .where('user_id', '=', flow.user_id)
              .where('mode', 'in', ['native_pending', 'web_pending'])
              .execute();
            await trx
              .deleteFrom('auth_verifications')
              .where('value', '=', flow.user_id)
              .execute();
          } else {
            await trx
              .deleteFrom('auth_flows')
              .where('id', '=', flow.id)
              .execute();
          }
          const session = await resolveToken(trx, token, mode);
          if (!session) throw new Error('Missing verified session');
          return { kind: 'verified' as const, token, session };
        } catch (error) {
          return authError(error, 'invalid_factor', 'password' in action);
        }
      };
      if (!('password' in action)) {
        const result = await db.transaction().execute(attempt);
        // Commit the library's factor-attempt counters before reporting failure.
        if (result instanceof AuthFailure) throw result;
        return result;
      }
      const flow = await db
        .selectFrom('auth_flows')
        .innerJoin('auth_users', 'auth_users.id', 'auth_flows.user_id')
        .select('auth_users.email')
        .where('token_hash', '=', hash(flowToken))
        .where('mode', '=', mode)
        .executeTakeFirst();
      if (!flow) throw new AuthFailure(401, 'invalid_factor');
      return passwordAttempt(flow.email, attempt);
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
