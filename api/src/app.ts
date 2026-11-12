import { BlockList } from 'node:net';
import Fastify, { LogController } from 'fastify';
import swagger from '@fastify/swagger';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import { installRoutePolicy } from './route-policy.js';
import { registerHealth, type HealthOptions } from './routes/health.js';
import { registerAuth } from './routes/auth.js';
import { AuthFailure, type Authentication } from './auth.js';

export async function buildApp(
  options: HealthOptions & {
    auth?: Authentication;
    trustedProxyIp?: string | undefined;
  },
  logStream?: { write: (text: string) => void },
) {
  const trustedProxy = new BlockList();
  if (options.trustedProxyIp) {
    trustedProxy.addAddress(
      options.trustedProxyIp,
      options.trustedProxyIp.includes(':') ? 'ipv6' : 'ipv4',
    );
  }
  const app = Fastify({
    trustProxy: options.trustedProxyIp
      ? (address, hop) =>
          hop === 0 &&
          trustedProxy.check(address, address.includes(':') ? 'ipv6' : 'ipv4')
      : false,
    logger: {
      level: 'info',
      base: null,
      ...(logStream ? { stream: logStream } : {}),
    },
    logController: new LogController({ disableRequestLogging: true }),
    requestIdHeader: false,
    bodyLimit: 1024,
    ajv: { customOptions: { removeAdditional: false } },
  });
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);
  const routes = installRoutePolicy(app, options.auth);
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof AuthFailure)
      return reply.code(error.status).send({ error: error.code });
    const validation = (error as { validation?: unknown }).validation;
    return reply
      .code(validation ? 400 : 500)
      .send({ error: validation ? 'invalid_request' : 'internal_error' });
  });
  app.setNotFoundHandler((_request, reply) =>
    reply.code(404).send({ error: 'not_found' }),
  );
  app.addHook('onResponse', async (request, reply) => {
    // No URL, parameters, request IDs from callers, headers, bodies or errors.
    app.log.info({
      event: 'request_complete',
      method: ['GET', 'HEAD'].includes(request.method)
        ? request.method
        : 'OTHER',
      statusCode: reply.statusCode,
    });
  });
  await app.register(swagger, {
    openapi: { info: { title: 'MC Car Riviera API', version: '0.1.0' } },
    transform: jsonSchemaTransform,
  });
  registerHealth(app, options);
  registerAuth(app, options.auth);
  return { app, routes };
}
