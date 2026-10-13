import { chromium, defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'

const useLocalChromeFallback = !process.env.CI && process.env.ILSK_SEO_USE_SYSTEM_CHROME === '1'
  && !existsSync(chromium.executablePath())

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: [
    'mobile-affiliate-placement.spec.ts',
    'seo-rendering-recovery.spec.ts',
    'real-estate-nearby.spec.ts',
    'real-estate-mode-navigation.spec.ts',
    'housing-redesign.spec.ts',
    'subscription-list-redesign.spec.ts',
    'exploration-search-redesign.spec.ts',
    'remaining-editorial-redesign.spec.ts',
    'remaining-property-redesign.spec.ts',
    'remaining-lifestyle-redesign.spec.ts',
    'waste-area-discovery.spec.ts',
  ],
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: process.env.ILSK_SEO_REPORT_PATH || 'test-results/housing-redesign/seo-results.json' }]],
  use: { baseURL: 'http://127.0.0.1:13000', serviceWorkers: 'block', trace: 'retain-on-failure' },
  projects: [{
    name: useLocalChromeFallback ? 'local-chrome' : 'chromium',
    use: { ...devices['Desktop Chrome'], ...(useLocalChromeFallback ? { channel: 'chrome' } : {}) },
  }],
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
