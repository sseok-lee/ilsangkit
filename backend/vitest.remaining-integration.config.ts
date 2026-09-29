import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['__tests__/integration/remainingBrowse.integration.test.ts', '__tests__/rentalPriceStats.test.ts'],
    setupFiles: ['__tests__/integration/housingSetup.ts'],
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
