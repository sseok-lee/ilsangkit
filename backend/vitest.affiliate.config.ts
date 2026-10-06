import { defineConfig } from 'vitest/config';
import { assertAffiliateTestDatabase } from './__tests__/integration/affiliateBannerDatabase.js';

const url = process.env.AFFILIATE_TEST_DATABASE_URL;
if (!url) throw new Error('AFFILIATE_TEST_DATABASE_URL is required');
assertAffiliateTestDatabase(url);
process.env.DATABASE_URL = url;

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    include: ['__tests__/integration/affiliateBanners.integration.test.ts'],
    testTimeout: 20000,
  },
});
