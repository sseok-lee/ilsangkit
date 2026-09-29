import { chromium, defineConfig, devices } from '@playwright/test'
import { existsSync } from 'node:fs'

const useLocalChromeFallback = !process.env.CI && process.env.ILSK_RELEASE_USE_SYSTEM_CHROME === '1'
  && !existsSync(chromium.executablePath())

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: ['release-transition.spec.ts'],
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: process.env.ILSK_RELEASE_REPORT_PATH || 'test-results/release-transition/results.json' }]],
  use: {
    baseURL: process.env.C3_RELEASE_BASE_URL || 'http://127.0.0.1:19000',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  projects: [{
    name: useLocalChromeFallback ? 'local-chrome' : 'chromium',
    use: { ...devices['Desktop Chrome'], ...(useLocalChromeFallback ? { channel: 'chrome' } : {}) },
  }],
})
