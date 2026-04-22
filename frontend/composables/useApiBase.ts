function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}

/**
 * Resolve a safe API base for both SSR and browser environments.
 *
 * - SSR keeps the configured absolute base so the Nuxt server can reach backend directly.
 * - Browsers fall back to same-origin `/api` proxy when the configured base points to
 *   localhost or would cause mixed-content requests on HTTPS.
 */
export function useApiBase(): string {
  const config = useRuntimeConfig()
  const rawBase = trimTrailingSlash(String(config.public.apiBase || ''))

  if (!rawBase) return ''

  if (typeof window === 'undefined') {
    return rawBase
  }

  if (rawBase.startsWith('/')) {
    return rawBase
  }

  try {
    const target = new URL(rawBase, window.location.origin)
    const isLocalTarget = ['localhost', '127.0.0.1', '0.0.0.0'].includes(target.hostname)
    const isMixedContent = window.location.protocol === 'https:' && target.protocol === 'http:'

    if (isLocalTarget || isMixedContent) {
      return ''
    }

    if (target.origin === window.location.origin) {
      return target.pathname === '/' ? '' : trimTrailingSlash(target.pathname)
    }
  } catch {
    return ''
  }

  return rawBase
}
