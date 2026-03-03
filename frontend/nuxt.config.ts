export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },

  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@vite-pwa/nuxt'
  ],

  // PWA 설정: MSW(개발용 서비스워커)와 충돌 방지를 위해 production에서만 SW 등록
  // NUXT_PUBLIC_DISABLE_MSW=true 시 MSW 비활성화 (production 배포 시 자동 적용)
  pwa: {
    // 외부 site.webmanifest 사용 (manifest: false)
    manifest: false,
    registerType: 'autoUpdate',
    // production 환경에서만 SW 등록하여 MSW 개발용 SW와 scope 충돌 방지
    devOptions: {
      enabled: false,
    },
    workbox: {
      // API 요청: NetworkFirst (네트워크 우선, 오프라인 시 캐시 사용)
      runtimeCaching: [
        {
          urlPattern: /^https?:\/\/.*\/api\/.*/,
          handler: 'NetworkFirst',
          options: {
            cacheName: 'api-cache',
            networkTimeoutSeconds: 10,
            expiration: {
              maxEntries: 100,
              maxAgeSeconds: 60 * 60, // 1 hour
            },
          },
        },
        {
          // 정적 자산: CacheFirst (캐시 우선)
          urlPattern: /\.(js|css|woff2?|png|jpg|webp|svg|ico)$/,
          handler: 'CacheFirst',
          options: {
            cacheName: 'static-assets',
            expiration: {
              maxEntries: 200,
              maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
            },
          },
        },
      ],
    },
  },

  // Security headers + API proxy
  nitro: {
    routeRules: {
      '/api/**': { proxy: 'http://localhost:8000/api/**' },
      '/**': {
        headers: {
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
        },
      },
      '/sitemap.xml': { swr: 86400 },
      '/sitemap/**': { swr: 86400 },
      '/': { swr: 300 },
      '/about': { prerender: true },
      '/faq': { prerender: true },
      '/privacy': { prerender: true },
      '/terms': { prerender: true },
      '/_nuxt/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
      '/icons/**': { headers: { 'cache-control': 'public, max-age=86400' } },
      '/images/**': { headers: { 'cache-control': 'public, max-age=86400' } },
    },
  },

  components: [
    { path: '~/components', pathPrefix: false }
  ],

  typescript: {
    strict: true,
    typeCheck: false
  },

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000',
      kakaoMapKey: process.env.NUXT_PUBLIC_KAKAO_MAP_KEY || '',
      gaId: process.env.NUXT_PUBLIC_GA_ID || '',
      disableMsw: process.env.NUXT_PUBLIC_DISABLE_MSW === 'true'
    }
  },

  app: {
    head: {
      htmlAttrs: {
        lang: 'ko',
      },
      title: '일상킷 - 내 주변 생활 편의 정보',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: '공공시설과 생활 편의 정보를 통합 검색합니다.' },
        { name: 'theme-color', content: '#3b82f6' },
        { name: 'application-name', content: '일상킷' },
        { name: 'apple-mobile-web-app-title', content: '일상킷' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap' },
        { rel: 'manifest', href: '/site.webmanifest' },
      ]
    }
  },

  css: ['~/assets/css/main.css']
})
