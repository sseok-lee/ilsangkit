import { defineConfig, devices } from '@playwright/test'

const e2ePort = process.env.PLAYWRIGHT_PORT || process.env.PORT || '3000'
const e2eHost = process.env.PLAYWRIGHT_HOST || '127.0.0.1'
const e2eBaseURL = process.env.PLAYWRIGHT_BASE_URL || `http://${e2eHost}:${e2ePort}`

export default defineConfig({
  testDir: './tests/e2e',
  // These suites require playwright.seo.config.ts and its fixture servers.
  testIgnore: [
    '**/mobile-affiliate-placement.spec.ts',
    '**/seo-rendering-recovery.spec.ts',
    '**/real-estate-nearby.spec.ts',
    '**/housing-redesign.spec.ts',
    '**/subscription-list-redesign.spec.ts',
    '**/exploration-search-redesign.spec.ts',
    '**/remaining-editorial-redesign.spec.ts',
    '**/remaining-property-redesign.spec.ts',
    '**/remaining-lifestyle-redesign.spec.ts',
    '**/waste-area-discovery.spec.ts',
    '**/trash-source-guide.spec.ts',
  ],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: e2eBaseURL,
    trace: 'on-first-retry',
  },
  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile browsers
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 14'] },
    },

    // Tablet
    {
      name: 'Tablet',
      use: {
        viewport: { width: 768, height: 1024 },
      },
    },

    // Additional mobile viewports
    {
      name: 'iPhone SE',
      use: { ...devices['iPhone SE'] },
    },
    {
      name: 'Samsung Galaxy',
      use: { ...devices['Galaxy S9+'] },
    },
  ],
  webServer: {
    command: `NUXT_PUBLIC_ADS_ENABLED=false npm run dev -- --host ${e2eHost} --port ${e2ePort}`,
    url: e2eBaseURL,
    reuseExistingServer: process.env.PLAYWRIGHT_REUSE_SERVER === '1' && !process.env.CI,
    timeout: 120000,
  },
})
