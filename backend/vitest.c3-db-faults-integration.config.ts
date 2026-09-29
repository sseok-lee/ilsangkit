import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['__tests__/integration/rehearseReleaseDatabaseFaults.integration.test.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
