declare global {
  interface Window {
    dataLayer: unknown[]
    gtag: (...args: unknown[]) => void
  }
}

export default defineNuxtPlugin(() => {
  if (process.env.NODE_ENV !== 'production') return

  const config = useRuntimeConfig()
  const gaId = config.public.gaId

  if (!gaId) return

  const router = useRouter()
  let isFirstNavigation = true
  router.afterEach((to) => {
    if (isFirstNavigation) {
      isFirstNavigation = false
      return
    }
    if (window.gtag) {
      window.gtag('event', 'page_view', {
        page_path: to.fullPath,
        page_title: document.title,
      })
    }
  })
})
