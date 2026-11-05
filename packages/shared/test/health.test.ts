import { expect, it } from 'vitest';
import { healthQuerySchema, healthResponseSchema } from '../src/index.js';
it('restricts health responses to the declared statuses and keys', () => {
  expect(
    healthResponseSchema.parse({ database: 'ok', storage: 'error' }),
  ).toEqual({ database: 'ok', storage: 'error' });
  for (const input of [
    { database: 'ok' },
    { database: 'up', storage: 'ok' },
    { database: 'ok', storage: 'ok', detail: 'synthetic' },
  ]) {
    expect(healthResponseSchema.safeParse(input).success).toBe(false);
  }
  expect(healthQuerySchema.safeParse({}).success).toBe(true);
  expect(healthQuerySchema.safeParse({ name: 'synthetic' }).success).toBe(
    false,
  );
});
