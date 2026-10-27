import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['__tests__/integration/explorationLatestDeals.integration.test.ts', '__tests__/integration/realEstateAreaSummary.integration.test.ts'],
    setupFiles: ['__tests__/integration/housingSetup.ts'],
    fileParallelism: false,
  },
});
