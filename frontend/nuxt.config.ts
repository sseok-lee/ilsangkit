export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },

  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt'
  ],

  typescript: {
    strict: true,
    typeCheck: false
  },

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000',
      kakaoMapKey: process.env.NUXT_PUBLIC_KAKAO_MAP_KEY || '',
      gaId: process.env.NUXT_PUBLIC_GA_ID || ''
    }
  },

  app: {
    head: {
      title: '일상킷 - 내 주변 생활 편의 정보',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'description', content: '위치 기반으로 공공화장실, 쓰레기 배출, 무료 와이파이 정보를 통합 검색합니다.' }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css' }
      ]
    }
  },

  css: ['~/assets/css/main.css']
})
