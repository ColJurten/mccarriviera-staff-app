import { expect, it } from 'vitest';
import { readConfig } from '../src/config.js';
it('rejects invalid configuration with no input values in the error', () => {
  expect(() =>
    readConfig({ DATABASE_URL: 'synthetic-private-invalid-url' }),
  ).toThrow(/^Invalid API configuration$/);
});
