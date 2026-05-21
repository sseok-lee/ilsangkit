import { useRuntimeConfig } from '#imports'

let bootLogged = false

export function getInternalApiBase(): string {
  const cfg = useRuntimeConfig()
  const resolved = String((cfg as any).internalApiBase || cfg.public.apiBase || 'http://localhost:8000')
    .replace(/\/+$/, '')

  if (!bootLogged) {
    bootLogged = true
    const isFallback = !(cfg as any).internalApiBase && process.env.NODE_ENV === 'production'
    const tag = isFallback
      ? '[internalApiBase] WARN: falling back to public.apiBase in production'
      : '[internalApiBase]'
    console.info(`${tag} resolved: ${resolved}`)
  }
  return resolved
}
