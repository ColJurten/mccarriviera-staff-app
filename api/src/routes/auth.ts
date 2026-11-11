import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  signInSchema,
  enrollmentSchema,
  factorSchema,
  emptyAuthSchema,
  nativeSignInResponseSchema,
  webSignInResponseSchema,
  enrollmentResponseSchema,
  staffSessionSchema,
  signOutResponseSchema,
  errorResponseSchema,
} from '@mccarriviera/shared';
import {
  AuthFailure,
  FLOW_COOKIE,
  WEB_COOKIE,
  type Authentication,
} from '../auth.js';
import { publicSession } from '../session.js';
import {
  authCookie,
  hasAuthCookie,
  isNativeRequest,
  isWebRequest,
  requireSession,
  webCookie,
} from '../route-policy.js';

const errors = {
  400: errorResponseSchema,
  401: errorResponseSchema,
  429: errorResponseSchema,
  500: errorResponseSchema,
};
export function registerAuth(app: FastifyInstance, auth?: Authentication) {
  const typed = app.withTypeProvider<ZodTypeProvider>();
  const web = (request: FastifyRequest) => {
    if (!auth || !isWebRequest(request, auth))
      throw new AuthFailure(401, 'unauthorized');
  };
  app.addHook('onSend', async (request, reply) => {
    if (request.routeOptions.url?.startsWith('/api/auth/'))
      reply.header('cache-control', 'no-store');
  });
  typed.post(
    '/api/auth/native/sign-in',
    {
      schema: {
        operationId: 'nativeSignIn',
        body: signInSchema,
        response: { 200: nativeSignInResponseSchema, ...errors },
      },
    },
    async (request) => {
      if (!auth || !isNativeRequest(request) || request.headers.authorization)
        throw new AuthFailure(401, 'unauthorized');
      await auth.limit(request.ip, 'password');
      const result = await auth.signIn(request.body, 'native');
      if (result.kind !== 'native') throw new Error('Unexpected auth mode');
      return { token: result.token, session: publicSession(result.session) };
    },
  );
  typed.post(
    '/api/auth/web/sign-in',
    {
      schema: {
        operationId: 'webSignIn',
        body: signInSchema,
        response: { 200: webSignInResponseSchema, ...errors },
      },
    },
    async (request, reply) => {
      web(request);
      await auth!.limit(request.ip, 'password');
      const result = await auth!.signIn(request.body, 'web');
      if (result.kind !== 'web') throw new Error('Unexpected auth mode');
      reply.header('set-cookie', [
        webCookie(FLOW_COOKIE, result.flowToken, 600),
        webCookie(WEB_COOKIE, '', 0),
      ]);
      return { next: result.next };
    },
  );
  typed.post(
    '/api/auth/web/enroll',
    {
      schema: {
        operationId: 'webEnroll',
        body: enrollmentSchema,
        response: { 200: enrollmentResponseSchema, ...errors },
      },
    },
    async (request) => {
      web(request);
      await auth!.limit(request.ip, 'factor');
      const flow = authCookie(request, FLOW_COOKIE);
      if (!flow || hasAuthCookie(request, WEB_COOKIE))
        throw new AuthFailure(401, 'invalid_factor');
      const result = await auth!.continueWeb(flow, request.body);
      if (result.kind !== 'enrollment')
        throw new Error('Unexpected auth state');
      return { totpURI: result.totpURI, backupCodes: result.backupCodes };
    },
  );
  typed.post(
    '/api/auth/web/verify',
    {
      schema: {
        operationId: 'webVerify',
        body: factorSchema,
        response: { 200: staffSessionSchema, ...errors },
      },
    },
    async (request, reply) => {
      web(request);
      await auth!.limit(request.ip, 'factor');
      const flow = authCookie(request, FLOW_COOKIE);
      if (!flow || hasAuthCookie(request, WEB_COOKIE))
        throw new AuthFailure(401, 'invalid_factor');
      const result = await auth!.continueWeb(flow, request.body);
      if (result.kind !== 'verified') throw new Error('Unexpected auth state');
      reply.header('set-cookie', [
        webCookie(
          WEB_COOKIE,
          result.token,
          Math.floor(
            (Date.parse(result.session.expiresAt) - Date.now()) / 1000,
          ),
        ),
        webCookie(FLOW_COOKIE, '', 0),
      ]);
      return publicSession(result.session);
    },
  );
  typed.get(
    '/api/auth/session',
    {
      preHandler: requireSession,
      schema: {
        operationId: 'staffSession',
        querystring: emptyAuthSchema,
        response: { 200: staffSessionSchema, ...errors },
      },
    },
    async (request) => publicSession(request.staff!),
  );
  typed.post(
    '/api/auth/sign-out',
    {
      preHandler: requireSession,
      schema: {
        operationId: 'staffSignOut',
        body: emptyAuthSchema,
        response: { 200: signOutResponseSchema, ...errors },
      },
    },
    async (request, reply) => {
      await auth!.signOut(request.staff!);
      if (request.staff!.mode === 'web')
        reply.header('set-cookie', [
          webCookie(WEB_COOKIE, '', 0),
          webCookie(FLOW_COOKIE, '', 0),
        ]);
      return { success: true as const };
    },
  );
}
