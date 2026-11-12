import { z } from 'zod';

export const healthQuerySchema = z.strictObject({});
export const dependencyStatusSchema = z.enum(['ok', 'error']);
export const healthResponseSchema = z.strictObject({
  database: dependencyStatusSchema,
  storage: dependencyStatusSchema,
});
export const errorResponseSchema = z.strictObject({
  error: z.enum([
    'invalid_request',
    'unauthorized',
    'not_found',
    'internal_error',
    'invalid_credentials',
    'invalid_factor',
    'rate_limited',
  ]),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
