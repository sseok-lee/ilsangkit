import { defineConfig, devices } from '@playwright/test'

const launchOptions = process.env.PLAYWRIGHT_CHROME_EXECUTABLE
  ? { executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE }
  : undefined

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: 'admin-affiliate-banners.spec.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report/affiliate', open: 'never' }]],
  outputDir: 'test-results/affiliate',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'affiliate-desktop-chrome',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        launchOptions,
      },
    },
    {
      name: 'affiliate-mobile-chrome-390',
      use: {
        ...devices['Pixel 5'],
        channel: 'chrome',
        viewport: { width: 390, height: 844 },
        launchOptions,
      },
    },
  ],
  webServer: {
    command: "NUXT_PUBLIC_API_BASE='' NUXT_PUBLIC_DISABLE_MSW=true NUXT_PUBLIC_ADS_ENABLED=false npm run dev -- --port 3001",
    url: 'http://localhost:3001',
    reuseExistingServer: false,
    timeout: 120000,
  },
})
