import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['ad-cls.spec.ts', 'ad-lifecycle.spec.ts'],
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/ads-report.json' }]],
  preserveOutput: 'always',
  use: { baseURL: 'http://127.0.0.1:13010', serviceWorkers: 'block', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'ads-desktop',
      use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } },
    },
    { name: 'ads-mobile', use: { browserName: 'chromium', viewport: { width: 393, height: 852 } } },
  ],
  webServer: {
    command:
      'npx --no-install nuxt build tests/fixtures/ads && PORT=13010 HOST=127.0.0.1 node .output/ads-fixture/server/index.mjs',
    url: 'http://127.0.0.1:13010/fixed',
    timeout: 180000,
    reuseExistingServer: false,
  },
})
