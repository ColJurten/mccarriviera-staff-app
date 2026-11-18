import { defineConfig } from 'vitest/config';
export default defineConfig({
  // Migration reversal tests temporarily change shared schema/grants.
  test: {
    include: ['integration/**/*.test.ts'],
    testTimeout: 15000,
    fileParallelism: false,
  },
});
