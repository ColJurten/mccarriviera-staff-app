import { expect, it } from 'vitest';
import {
  factorSchema,
  passwordSchema,
  signInSchema,
  staffSessionSchema,
} from '../src/index.js';

it('bounds passwords and rejects undeclared auth controls', () => {
  expect(passwordSchema.safeParse('x'.repeat(11)).success).toBe(false);
  expect(passwordSchema.safeParse('x'.repeat(12)).success).toBe(true);
  expect(passwordSchema.safeParse('x'.repeat(129)).success).toBe(false);
  expect(
    signInSchema.safeParse({
      email: 'synthetic@example.com',
      password: 'x',
      mode: 'native',
    }).success,
  ).toBe(false);
  expect(
    factorSchema.safeParse({ kind: 'totp', code: '123456', trustDevice: true })
      .success,
  ).toBe(false);
  expect(
    factorSchema.safeParse({ kind: 'backup', code: 'synthetic' }).success,
  ).toBe(true);
});
it('never accepts session tokens or internal identity fields in the public session shape', () => {
  expect(
    staffSessionSchema.safeParse({
      staffId: '00000000-0000-4000-8000-000000000001',
      displayName: 'Synthetic',
      mode: 'web',
      expiresAt: '2026-11-11T12:00:00.000Z',
      token: 'synthetic-token',
    }).success,
  ).toBe(false);
});
