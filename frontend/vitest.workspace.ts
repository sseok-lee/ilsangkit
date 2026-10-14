import { defineWorkspace } from 'vitest/config'

const ads = [
  'tests/components/ads/AdBanner.test.ts',
  'tests/components/ads/useDeferredAdSenseRequest.test.ts',
  'tests/composables/useAdSenseRuntime.test.ts',
  'tests/composables/useAdsPolicy.test.ts',
  'tests/plugins/adsensePlugin.test.ts',
]

export default defineWorkspace([
  {
    extends: './vitest.config.ts',
    test: { name: 'unit', exclude: ['tests/e2e/**', 'node_modules/**', ...ads] },
  },
  {
    extends: './vitest.config.ts',
    // Vitest 2's SSR transform does not honor these custom import.meta defines.
    // Compile only this workspace's modules through the Nuxt client branches.
    plugins: [
      {
        name: 'ads-client-meta',
        enforce: 'pre',
        transform(code, id) {
          if (!id.includes('/node_modules/') && /\.(ts|vue)(\?|$)/.test(id)) {
            return code
              .replace(/import\.meta\.client\b/g, 'true')
              .replace(/import\.meta\.server\b/g, 'false')
              .replace(/import\.meta\.dev\b/g, 'true')
          }
        },
      },
    ],
    test: {
      name: 'ads-client',
      include: ads,
      environmentOptions: {
        happyDOM: { settings: { disableJavaScriptFileLoading: true, disableCSSFileLoading: true } },
      },
    },
  },
])
