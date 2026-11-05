import Fastify, { LogController } from 'fastify';
import swagger from '@fastify/swagger';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import { installRoutePolicy } from './route-policy.js';
import { registerHealth, type HealthOptions } from './routes/health.js';

export async function buildApp(
  options: HealthOptions,
  logStream?: { write: (text: string) => void },
) {
  const app = Fastify({
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
  const routes = installRoutePolicy(app);
  app.setErrorHandler((error, _request, reply) => {
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
  return { app, routes };
}
