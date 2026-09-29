import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    fileParallelism: false,
    include: ['__tests__/integration/subscriptionList.integration.test.ts'],
    setupFiles: ['__tests__/integration/housingSetup.ts'],
  },
});
