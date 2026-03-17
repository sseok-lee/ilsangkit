declare global {
  interface Window {
    dataLayer: unknown[]
    gtag: (...args: unknown[]) => void
  }
}

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const gaId = config.public.gaId

  // Skip if no GA ID, invalid format, or in development
  if (!gaId || !/^G-[A-Z0-9]{4,}$/.test(gaId)) {
    return
  }

  // Initialize dataLayer
  window.dataLayer = window.dataLayer || []

  // Define gtag function
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer.push(args)
  }

  // Consent mode: 기본 granted (한국 사이트, GDPR 배너 유지하면서 GA4 수집 허용)
  window.gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'granted',
    ad_user_data: 'granted',
    ad_personalization: 'granted',
  })

  // Initialize GA
  window.gtag('js', new Date())
  window.gtag('config', gaId, {
    page_path: useRoute().fullPath
  })

  // Load gtag.js script directly via DOM (useHead may not inject reliably in client plugins)
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`
  document.head.appendChild(script)

  // Track route changes
  const router = useRouter()
  router.afterEach((to) => {
    if (window.gtag) {
      window.gtag('config', gaId, {
        page_path: to.fullPath
      })
    }
  })
})
