import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['seo-rendering-recovery.spec.ts', 'real-estate-nearby.spec.ts'],
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'test-results/seo-results.json' }]],
  use: { baseURL: 'http://127.0.0.1:13000', serviceWorkers: 'block', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'node tests/fixtures/seo/api.mjs', url: 'http://127.0.0.1:18080/health', reuseExistingServer: false },
    {
      command: 'node tests/fixtures/seo/clean.mjs && NUXT_PUBLIC_DISABLE_MSW=true NUXT_PUBLIC_ADS_ENABLED=false npx nuxt build tests/fixtures/seo && PORT=13000 HOST=127.0.0.1 node .output/seo-fixture/server/index.mjs',
      url: 'http://127.0.0.1:13000/hospital/hospital-seo-fixture',
      timeout: 300000,
      reuseExistingServer: false,
    },
  ],
})
