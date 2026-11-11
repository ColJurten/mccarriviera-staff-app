import type {
  FastifyInstance,
  FastifyRequest,
  preHandlerHookHandler,
} from 'fastify';
import { FLOW_COOKIE, WEB_COOKIE, type Authentication } from './auth.js';
import type { SessionIdentity } from './session.js';

declare module 'fastify' {
  interface FastifyRequest {
    staff: SessionIdentity | null;
  }
}
export const publicRoutes = new Set([
  'GET /api/health',
  'HEAD /api/health',
  'POST /api/auth/native/sign-in',
  'POST /api/auth/web/sign-in',
  'POST /api/auth/web/enroll',
  'POST /api/auth/web/verify',
]);
export const requireSession: preHandlerHookHandler = async (request, reply) => {
  if (!request.staff) await reply.code(401).send({ error: 'unauthorized' });
};

export function authCookie(request: FastifyRequest, name: string) {
  const matches = (request.headers.cookie ?? '')
    .split(';')
    .map((v) => v.trim())
    .filter((v) => v.startsWith(`${name}=`));
  if (matches.length !== 1) return null;
  const value = matches[0]!.slice(name.length + 1);
  return /^[a-zA-Z0-9_-]{20,256}$/.test(value) ? value : null;
}
export function hasAuthCookie(request: FastifyRequest, name: string) {
  return (request.headers.cookie ?? '')
    .split(';')
    .some((v) => v.trim().startsWith(`${name}=`));
}
export function isNativeRequest(request: FastifyRequest) {
  return (
    !request.headers.origin &&
    !Object.keys(request.headers).some((key) => key.startsWith('sec-fetch-')) &&
    !request.headers.cookie
  );
}
export function isWebRequest(request: FastifyRequest, auth?: Authentication) {
  const origin = request.headers.origin;
  return (
    !request.headers.authorization &&
    request.headers['sec-fetch-site'] !== 'cross-site' &&
    (origin
      ? !!auth?.config.AUTH_TRUSTED_ORIGINS.includes(origin)
      : ['GET', 'HEAD'].includes(request.method))
  );
}
export function webCookie(name: string, token: string, seconds: number) {
  return `${name}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${seconds}`;
}
export interface RegisteredRoute {
  method: string;
  url: string;
  sessionCheck: boolean;
}

export function assertRoutePolicy(
  routes: RegisteredRoute[],
  allowed = publicRoutes,
) {
  for (const route of routes) {
    if (!allowed.has(`${route.method} ${route.url}`) && !route.sessionCheck) {
      throw new Error(`Missing session check: ${route.method} ${route.url}`);
    }
  }
}

export function installRoutePolicy(
  app: FastifyInstance,
  auth?: Authentication,
) {
  const routes: RegisteredRoute[] = [];
  app.decorateRequest('staff', null);
  app.addHook('onRoute', (route) => {
    const hooks =
      route.preHandler === undefined
        ? []
        : Array.isArray(route.preHandler)
          ? route.preHandler
          : [route.preHandler];
    for (const method of Array.isArray(route.method)
      ? route.method
      : [route.method]) {
      routes.push({
        method,
        url: route.url,
        sessionCheck: hooks.includes(requireSession),
      });
    }
  });
  // Deny by default even if someone forgets the per-route hook. The audit above
  // still fails ready() and the route inventory test for that mistake.
  app.addHook('onRequest', async (request, reply) => {
    if (!publicRoutes.has(`${request.method} ${request.routeOptions.url}`)) {
      try {
        const authorization = request.headers.authorization;
        if (authorization && isNativeRequest(request)) {
          const match = /^Bearer ([a-zA-Z0-9_-]{20,256})$/i.exec(authorization);
          if (match && auth)
            request.staff = await auth.resolve(match[1]!, 'native');
        } else if (
          !authorization &&
          isWebRequest(request, auth) &&
          !hasAuthCookie(request, FLOW_COOKIE)
        ) {
          const token = authCookie(request, WEB_COOKIE);
          if (token && auth) request.staff = await auth.resolve(token, 'web');
          if (request.staff)
            reply.header(
              'set-cookie',
              webCookie(
                WEB_COOKIE,
                token!,
                Math.max(
                  0,
                  Math.floor(
                    (Date.parse(request.staff.expiresAt) - Date.now()) / 1000,
                  ),
                ),
              ),
            );
        }
      } catch {
        request.staff = null;
      }
      if (!request.staff) await reply.code(401).send({ error: 'unauthorized' });
    }
  });
  app.addHook('onReady', async () => {
    assertRoutePolicy(routes);
  });
  return routes;
}
