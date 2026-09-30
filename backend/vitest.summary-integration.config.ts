import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: [
      '__tests__/integration/summaryTransition.integration.test.ts',
      '__tests__/integration/summaryRefresh.integration.test.ts',
      '__tests__/integration/summaryValidation.integration.test.ts',
    ],
    setupFiles: ['__tests__/integration/housingSetup.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
