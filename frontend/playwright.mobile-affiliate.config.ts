import { defineConfig } from '@playwright/test'
import seo from './playwright.seo.config'

export default defineConfig({
  ...seo,
  testMatch: 'mobile-affiliate-placement.spec.ts',
  outputDir: 'test-results/mobile-affiliate/artifacts',
  reporter: [['list'], ['json', { outputFile: 'test-results/mobile-affiliate/results.json' }]],
  // Reuse a verified fixture build while iterating only on browser assertions.
  webServer: process.env.ILSK_AFFILIATE_SKIP_BUILD === '1'
    ? [
        ...(Array.isArray(seo.webServer) ? seo.webServer.slice(0, 1) : []),
        {
          command: 'PORT=13000 HOST=127.0.0.1 node .output/seo-fixture/server/index.mjs',
          url: 'http://127.0.0.1:13000/hospital/hospital-seo-fixture',
          reuseExistingServer: false,
        },
      ]
    : seo.webServer,
})
