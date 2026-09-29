import { fileURLToPath } from 'node:url'
import base from '../../../nuxt.config'

const releaseInternalApiBase = process.env.NUXT_INTERNAL_API_BASE || process.env.C3_RELEASE_INTERNAL_API_BASE || process.env.C3_RELEASE_API_BASE || ''
const releasePublicApiBase = process.env.NUXT_PUBLIC_API_BASE || ''
const fixturePublicDir = fileURLToPath(new URL('../seo/public', import.meta.url))

export default defineNuxtConfig({
  ...base,
  rootDir: fileURLToPath(new URL('../../../', import.meta.url)),
  buildDir: '.nuxt/release-fixture',
  runtimeConfig: {
    ...base.runtimeConfig,
    internalApiBase: releaseInternalApiBase,
    public: {
      ...base.runtimeConfig?.public,
      apiBase: releasePublicApiBase,
      disableMsw: true,
      wasteAreaDiscoveryEnabled: true,
      adsEnabled: false,
    },
  },
  nitro: {
    ...base.nitro,
    output: { dir: fileURLToPath(new URL('../../../.output/release-fixture', import.meta.url)) },
    publicAssets: [{ dir: fixturePublicDir, baseURL: '/__fixture' }],
    routeRules: {
      ...base.nitro?.routeRules,
    },
  },
})
