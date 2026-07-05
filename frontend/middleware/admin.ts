export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) return // SSR loopback엔 브라우저 쿠키가 없음 — 클라이언트에서만 검사
  const ok = await useAdminAuth().checkSession()
  if (!ok) return navigateTo('/admin/login')
})
