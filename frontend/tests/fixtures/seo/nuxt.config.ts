import { fileURLToPath } from 'node:url'
import base from '../../../nuxt.config'

const routes = [
  '/hospital/hospital-seo-fixture',
  '/real-estate/apt-sale/seoul/gangnam/회복아파트',
  '/real-estate/apt-sale/seoul/gangnam/이웃아파트',
  '/real-estate/apt-sale/seoul/gangnam/재시도아파트',
]

// Test-only API and prerendering exercise real Nuxt extracted payload hydration.
const fixturePublicDir = fileURLToPath(new URL('./public', import.meta.url))
const fixtureMaterialSymbolsCss = `@font-face{font-family:'Material Symbols Outlined';font-style:normal;font-weight:400;font-display:block;src:url('/__fixture/fonts/material-symbols-outlined-subset.ttf') format('truetype');}.material-symbols-outlined{font-family:'Material Symbols Outlined';font-weight:normal;font-style:normal;line-height:1;letter-spacing:normal;text-transform:none;display:inline-block;white-space:nowrap;word-wrap:normal;direction:ltr;-webkit-font-feature-settings:'liga';-webkit-font-smoothing:antialiased;font-feature-settings:'liga';}`

export default defineNuxtConfig({
  ...base,
  rootDir: fileURLToPath(new URL('../../../', import.meta.url)),
  buildDir: '.nuxt/seo-fixture',
  app: {
    ...base.app,
    head: {
      ...base.app?.head,
      script: [],
      style: [...(base.app?.head?.style ?? []), { children: fixtureMaterialSymbolsCss }],
      link: (base.app?.head?.link ?? []).filter(
        (link) =>
          !String(link.href ?? '').includes('fonts.googleapis.com') &&
          !String(link.href ?? '').includes('fonts.gstatic.com') &&
          !String(link.href ?? '').includes('cdn.jsdelivr.net')
      ),
    },
  },
  runtimeConfig: {
    ...base.runtimeConfig,
    internalApiBase: 'http://127.0.0.1:18080',
    public: {
      ...base.runtimeConfig?.public,
      apiBase: 'http://127.0.0.1:18080',
      disableMsw: true,
      wasteAreaDiscoveryEnabled: true,
      adsEnabled: false,
    },
  },
  nitro: {
    ...base.nitro,
    output: { dir: fileURLToPath(new URL('../../../.output/seo-fixture', import.meta.url)) },
    publicAssets: [{ dir: fixturePublicDir, baseURL: '/__fixture' }],
    prerender: { routes, crawlLinks: false, failOnError: true },
    routeRules: {
      ...base.nitro?.routeRules,
      '/api/**': { proxy: 'http://127.0.0.1:18080/api/**' },
      '/facilities': { swr: false, cache: false },
      '/parking/**': { swr: false, cache: false },
      '/subway/**': { swr: false, cache: false },
      '/auction': { swr: false, cache: false },
      '/auction/**': { swr: false, cache: false },
      '/real-estate/land': { swr: false, cache: false },
      '/real-estate/land/**': { swr: false, cache: false },
      '/guide': { swr: false, cache: false },
      '/guide/**': { swr: false, cache: false },
      '/article': { swr: false, cache: false },
      '/article/**': { swr: false, cache: false },
      ...Object.fromEntries(routes.map((route) => [route, { prerender: true, swr: false }])),
    },
  },
})
