export default defineNuxtRouteMiddleware((to, from) => {
  if (import.meta.server || from.matched.length === 0) return
  const isAdmin = (path: string) => /^\/admin(?:\/|$)/.test(path)
  if (isAdmin(to.path) !== isAdmin(from.path)) {
    return navigateTo(to.fullPath, { external: true })
  }
})
