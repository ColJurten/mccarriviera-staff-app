import type { FastifyInstance, preHandlerHookHandler } from 'fastify';

export const publicRoutes = new Set(['GET /api/health', 'HEAD /api/health']);
// US-010 replaces this fail-closed hook with the active staff session check.
export const requireSession: preHandlerHookHandler = async (
  _request,
  reply,
) => {
  await reply.code(401).send({ error: 'unauthorized' });
};
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

export function installRoutePolicy(app: FastifyInstance) {
  const routes: RegisteredRoute[] = [];
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
      await reply.code(401).send({ error: 'unauthorized' });
    }
  });
  app.addHook('onReady', async () => {
    assertRoutePolicy(routes);
  });
  return routes;
}
