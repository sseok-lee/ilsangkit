const apiBase = process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000'

export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: { enabled: true },

  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@vite-pwa/nuxt',
    '@nuxt/image'
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

  // @nuxt/image: 자동 리사이징 및 WebP 변환
  image: {
    quality: 80,
    format: ['webp'],
    screens: {
      xs: 320,
      sm: 640,
      md: 768,
      lg: 1024,
      xl: 1280,
    },
  },

  // Security headers + API proxy
  nitro: {
    compressPublicAssets: true,
    routeRules: {
      '/api/**': { proxy: 'http://localhost:8000/api/**' },
      '/**': {
        headers: {
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
          'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
          'Content-Security-Policy': `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.kakao.com http://*.daumcdn.net https://*.daumcdn.net https://www.googletagmanager.com https://www.google-analytics.com https://pagead2.googlesyndication.com https://*.adtrafficquality.google https://www.googletagservices.com https://adservice.google.com https://partner.googleadservices.com https://fundingchoicesmessages.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; img-src 'self' ${apiBase} data: https://*.kakaocdn.net http://*.kakaocdn.net https://*.daumcdn.net http://*.daumcdn.net https://*.kakao.com http://*.kakao.com https://www.google-analytics.com https://*.google-analytics.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://googleads.g.doubleclick.net https://*.adtrafficquality.google https://www.googletagservices.com https://www.googletagmanager.com; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; connect-src 'self' ${apiBase} https://*.kakao.com https://*.daumcdn.net http://*.daumcdn.net https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://pagead2.googlesyndication.com https://*.adtrafficquality.google https://*.googlesyndication.com https://cdn.jsdelivr.net https://googleads.g.doubleclick.net https://fundingchoicesmessages.google.com; frame-src https://googleads.g.doubleclick.net https://pagead2.googlesyndication.com https://tpc.googlesyndication.com https://*.adtrafficquality.google https://www.google.com; object-src 'none'; worker-src 'self' blob:`,
        },
      },
      '/sitemap.xml': { swr: 86400 },
      '/sitemap/**': { swr: 86400 },
      '/': { swr: 3600 },
      '/about': { prerender: true },
      '/faq': { prerender: true },
      '/privacy': { prerender: true },
      '/terms': { prerender: true },
      '/_nuxt/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
      '/icons/**': { headers: { 'cache-control': 'public, max-age=2592000' } },
      '/images/**': { headers: { 'cache-control': 'public, max-age=2592000' } },
    },
  },

  // Vendor chunk 분리: 큰 라이브러리를 별도 chunk로 분리하여 캐싱 효율 향상
  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules')) {
              if (id.includes('vue') || id.includes('@vue') || id.includes('pinia')) {
                return 'vendor-vue'
              }
              if (id.includes('lightweight-charts')) {
                return 'vendor-charts'
              }
              if (id.includes('marked') || id.includes('dompurify')) {
                return 'vendor-markdown'
              }
            }
          },
        },
      },
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
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'https://ilsangkit.co.kr',
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
        { name: 'description', content: '아파트·빌라·오피스텔 실거래가 조회부터 내 주변 병원·약국·주차장까지, 생활 정보를 한곳에서 확인하세요.' },
        { name: 'theme-color', content: '#3b82f6' },
        { name: 'application-name', content: '일상킷' },
        { name: 'apple-mobile-web-app-title', content: '일상킷' },
        { name: 'naver-site-verification', content: 'naver4a270427c00c2dcdbb553b6af5637cb1' },
      ],
      script: [
        {
          src: 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2088264360250020',
          async: true,
          crossorigin: 'anonymous',
        },
        {
          innerHTML: `(function(){var f=['https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0..1,0&icon_names=accessible,add,apartment,arrow_back,arrow_forward,article,baby_changing_station,business,calendar_month,call,cancel,chat_bubble_outline,check,check_circle,checkroom,chevron_left,chevron_right,child_care,close,delete,description,directions,eco,edit_note,emergency,error,ev_station,event_upcoming,expand_more,explore,favorite,first_page,health_and_safety,help,holiday_village,home,info,last_page,lightbulb,local_hospital,local_library,local_parking,local_pharmacy,location_city,location_on,man,menu,menu_book,near_me,open_in_full,park,place,print,rate_review,recycling,refresh,remove,restaurant,schedule,school,search,search_off,share,sports,storefront,support_agent,videocam,visibility,visibility_off,warning,wc,weekend,wifi,woman&display=swap','https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css'];f.forEach(function(h){var l=document.createElement('link');l.rel='stylesheet';l.href=h;document.head.appendChild(l)})})()`,
          type: 'text/javascript',
        }
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'preconnect', href: 'https://cdn.jsdelivr.net', crossorigin: '' },
        { rel: 'manifest', href: '/site.webmanifest' },
      ]
    }
  },

  css: ['~/assets/css/main.css']
})
