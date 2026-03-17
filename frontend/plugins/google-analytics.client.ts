declare global {
  interface Window {
    dataLayer: unknown[]
    gtag: (...args: unknown[]) => void
  }
}

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const gaId = config.public.gaId

  // Skip if no GA ID, invalid format
  if (!gaId || !/^G-[A-Z0-9]{4,}$/.test(gaId)) {
    return
  }

  // Initialize dataLayer and gtag BEFORE script load
  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer.push(args)
  }

  // Consent must come first, before any gtag calls
  window.gtag('consent', 'default', {
    analytics_storage: 'granted',
    ad_storage: 'granted',
    ad_user_data: 'granted',
    ad_personalization: 'granted',
  })

  window.gtag('js', new Date())
  window.gtag('config', gaId, {
    page_path: useRoute().fullPath,
    send_page_view: true,
  })

  // Load gtag.js - insert as first script in head for priority
  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`
  const firstScript = document.head.getElementsByTagName('script')[0]
  if (firstScript) {
    document.head.insertBefore(script, firstScript)
  } else {
    document.head.appendChild(script)
  }

  // Track route changes
  const router = useRouter()
  router.afterEach((to) => {
    if (window.gtag) {
      window.gtag('event', 'page_view', {
        page_path: to.fullPath,
        page_title: document.title,
      })
    }
  })
})
