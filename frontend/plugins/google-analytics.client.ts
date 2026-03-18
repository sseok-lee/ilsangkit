declare global {
  interface Window {
    dataLayer: unknown[]
    gtag: (...args: unknown[]) => void
  }
}

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const gaId = config.public.gaId

  if (!gaId) return

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
