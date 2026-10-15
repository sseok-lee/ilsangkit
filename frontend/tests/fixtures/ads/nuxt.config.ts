import { fileURLToPath } from 'node:url'

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url))
export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  rootDir: path('./'),
  buildDir: path('../../../.nuxt/ads-fixture'),
  devtools: { enabled: false },
  alias: {
    '~/composables/useAdsPolicy': path('./policy.ts'),
    '~': path('../../../'),
    '@': path('../../../'),
  },
  hooks: {
    'vite:extendConfig'(config) {
      const aliases = config.resolve?.alias
      if (!config.resolve) return
      config.resolve.alias = [
        { find: /^~\/composables\/useAdsPolicy$/, replacement: path('./policy.ts') },
        ...(Array.isArray(aliases)
          ? aliases
          : Object.entries(aliases || {}).map(([find, replacement]) => ({ find, replacement }))),
      ]
    },
  },
  plugins: [path('../../../plugins/adsense.client.ts')],
  components: false,
  modules: ['@nuxtjs/tailwindcss'],
  tailwindcss: {
    configPath: path('../../../tailwind.config.js'),
    config: { content: [path('./**/*.vue'), path('../../../components/ads/*.vue')] },
  },
  css: [path('../../../assets/css/main.css')],
  runtimeConfig: { public: { adsEnabled: true } },
  nitro: { output: { dir: path('../../../.output/ads-fixture') } },
})
