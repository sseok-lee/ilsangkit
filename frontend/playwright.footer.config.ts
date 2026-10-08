import { defineConfig } from '@playwright/test'
import seo from './playwright.seo.config'

export default defineConfig({
  ...seo,
  testMatch: ['footer-navigation.spec.ts'],
  outputDir: 'test-results/footer-navigation',
  reporter: [
    ['list'],
    ['json', { outputFile: 'test-results/footer-navigation/results.json' }],
  ],
})
