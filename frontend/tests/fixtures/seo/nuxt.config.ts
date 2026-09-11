import { fileURLToPath } from 'node:url'
import base from '../../../nuxt.config'

const routes = [
  '/hospital/hospital-seo-fixture',
  '/real-estate/apt-sale/seoul/gangnam/회복아파트',
  '/real-estate/apt-sale/seoul/gangnam/이웃아파트',
  '/real-estate/apt-rent/seoul/gangnam/회복아파트',
  '/real-estate/apt-sale/seoul/gangnam/재시도아파트',
  '/real-estate/apt-rent/seoul/gangnam/재시도아파트',
]

// Test-only API and prerendering exercise real Nuxt extracted payload hydration.
export default defineNuxtConfig({
  ...base,
  rootDir: fileURLToPath(new URL('../../../', import.meta.url)),
  buildDir: '.nuxt/seo-fixture',
  runtimeConfig: {
    ...base.runtimeConfig,
    internalApiBase: 'http://127.0.0.1:18080',
    public: { ...base.runtimeConfig?.public, apiBase: 'http://127.0.0.1:18080', disableMsw: true, adsEnabled: false },
  },
  nitro: {
    ...base.nitro,
    output: { dir: fileURLToPath(new URL('../../../.output/seo-fixture', import.meta.url)) },
    prerender: { routes, crawlLinks: false, failOnError: true },
    routeRules: {
      ...base.nitro?.routeRules,
      '/api/**': { proxy: 'http://127.0.0.1:18080/api/**' },
      ...Object.fromEntries(routes.map(route => [route, { prerender: true, swr: false }])),
    },
  },
})
