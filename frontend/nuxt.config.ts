export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },

  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt'
  ],

  // Security headers
  nitro: {
    routeRules: {
      '/**': {
        headers: {
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
        },
      },
      '/sitemap.xml': { swr: 86400 },
      '/sitemap/**': { swr: 86400 },
      '/': { prerender: true },
      '/about': { prerender: true },
      '/privacy': { prerender: true },
      '/terms': { prerender: true },
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
        { name: 'description', content: '위치 기반으로 내 주변 공공시설과 생활 편의 정보를 통합 검색합니다.' },
        { name: 'theme-color', content: '#3b82f6' }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap' }
      ]
    }
  },

  css: ['~/assets/css/main.css']
})
