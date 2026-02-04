declare global {
  interface Window {
    dataLayer: unknown[]
    gtag: (...args: unknown[]) => void
  }
}

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const gaId = config.public.gaId

  // Skip if no GA ID or in development
  if (!gaId) {
    return
  }

  // Initialize dataLayer
  window.dataLayer = window.dataLayer || []

  // Define gtag function
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer.push(args)
  }

  // Initialize GA
  window.gtag('js', new Date())
  window.gtag('config', gaId, {
    page_path: useRoute().fullPath
  })

  // Load gtag.js script
  useHead({
    script: [
      {
        src: `https://www.googletagmanager.com/gtag/js?id=${gaId}`,
        async: true
      }
    ]
  })

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
