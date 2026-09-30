import { defineConfig } from 'vitest/config';
import dotenv from 'dotenv';

dotenv.config();

export default defineConfig({
  test: {
    // Unit fixtures choose preserved mode explicitly; a developer's local rollout
    // must not silently make every mocked fixture require a populated registry.
    env: { REAL_ESTATE_URL_MODE: 'keyed' },
    globals: true,
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    exclude: [
      '__tests__/rentalPriceStats.test.ts',
      '__tests__/integration/remainingBrowse.integration.test.ts',
      '__tests__/integration/housingRedesign.integration.test.ts',
      '__tests__/integration/explorationLatestDeals.integration.test.ts',
      '__tests__/integration/subscriptionList.integration.test.ts',
      '__tests__/integration/wasteArea.integration.test.ts',
      '__tests__/integration/summaryTransition.integration.test.ts',
      '__tests__/integration/summaryRefresh.integration.test.ts',
      '__tests__/integration/summaryValidation.integration.test.ts',
      '__tests__/integration/realEstateUrlPreservation.integration.test.ts',
      '__tests__/integration/rehearseReleaseDatabaseFaults.integration.test.ts',
      '__tests__/integration/summaryConsumers.integration.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
      '__tests__/rentalPriceStats.test.ts',
      '__tests__/integration/remainingBrowse.integration.test.ts','src/server.ts'],
    },
  },
});
