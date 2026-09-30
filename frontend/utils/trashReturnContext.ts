import type { RouteLocationNormalizedLoaded } from 'vue-router'

export interface TrashReturnContext {
  href: string
  label: string
  scrollY?: number
}

export interface TrashReturnState {
  sourceId: number | null
  context: TrashReturnContext
}

const STATE_KEY = 'ilsangkitTrashReturn'
const SESSION_PREFIX = 'ilsangkitTrashReturn:'
const POSITIVE_INTEGER = /^[1-9]\d*$/
const ALLOWED_TRASH_QUERY_KEYS = new Set(['city', 'district', 'keyword', 'coverage', 'page'])
const TRUSTED_NORMAL_QUERY_KEYS = new Set(['city', 'district', 'keyword', 'coverage', 'page', 'category', 'q'])

function hasBrowserHistory(): boolean {
  return typeof window !== 'undefined' && typeof window.history !== 'undefined'
}

function firstValue(value: unknown): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value
  return typeof raw === 'string' && raw.trim() ? raw.trim() : undefined
}

function isTrashListPath(pathname: string): boolean {
  if (pathname === '/trash') return true
  return /^\/[a-z0-9-]+\/[a-z0-9-]+\/trash$/.test(pathname)
}

function isTrashAreaPath(pathname: string): boolean {
  return /^\/trash\/areas\/[1-9]\d*$/.test(pathname)
}

function isTrashSourcePath(pathname: string): boolean {
  return /^\/trash\/[1-9]\d*$/.test(pathname)
}

function isTrustedNormalPath(pathname: string): boolean {
  return pathname === '/facilities' ||
    pathname === '/search' ||
    isTrashAreaPath(pathname) ||
    isTrashListPath(pathname)
}


function sessionKeyForTarget(rawHref: string): string | null {
  try {
    const url = new URL(rawHref, 'https://ilsangkit.co.kr')
    if (url.origin !== 'https://ilsangkit.co.kr') return null
    if (!isTrashAreaPath(url.pathname) && !isTrashSourcePath(url.pathname)) return null
    return `${SESSION_PREFIX}${url.pathname}${url.search}`
  } catch {
    return null
  }
}

function normalizeStoredState(value: unknown, sourceId: number | null): TrashReturnContext | null {
  if (!value || typeof value !== 'object') return null
  const state = value as Partial<TrashReturnState>
  if (typeof state.sourceId !== 'number' && state.sourceId !== null) return null
  if (state.sourceId !== null && sourceId !== null && state.sourceId !== sourceId) return null
  const rawContext = state.context
  if (!rawContext || typeof rawContext !== 'object') return null
  const context = rawContext as Partial<TrashReturnContext>
  if (typeof context.href !== 'string' || typeof context.label !== 'string') return null
  const href = sanitizeTrustedTrashReturn(context.href)
  if (!href) return null
  const scrollY = typeof context.scrollY === 'number' && Number.isFinite(context.scrollY)
    ? context.scrollY
    : undefined
  return { href, label: context.label, scrollY }
}

function currentSessionKey(): string | null {
  return sessionKeyForTarget(`${window.location.pathname}${window.location.search}`)
}

function clearSessionReturnContextForCurrentTarget() {
  if (!hasBrowserHistory() || typeof window.sessionStorage === 'undefined') return
  const key = currentSessionKey()
  if (key) window.sessionStorage.removeItem(key)
}

function matchingHistoryBackForContext(context: TrashReturnContext): boolean {
  if (!hasBrowserHistory()) return false
  const state = window.history.state
  const rawBack = state && typeof state === 'object' ? (state as { back?: unknown }).back : undefined
  return typeof rawBack === 'string' && sanitizeTrustedTrashReturn(rawBack) === context.href
}

function consumeSessionReturnContext(sourceId: number | null): TrashReturnContext | null {
  if (!hasBrowserHistory() || typeof window.sessionStorage === 'undefined') return null
  const key = currentSessionKey()
  if (!key) return null
  const raw = window.sessionStorage.getItem(key)
  if (!raw) return null
  window.sessionStorage.removeItem(key)
  try {
    const context = normalizeStoredState(JSON.parse(raw), sourceId)
    if (!context || !matchingHistoryBackForContext(context)) return null
    return context
  } catch {
    return null
  }
}

function sanitizePathAndQuery(
  rawHref: string,
  allowedPath: (pathname: string) => boolean,
  allowedQueryKeys: ReadonlySet<string>,
): string | null {
  try {
    const url = new URL(rawHref, 'https://ilsangkit.co.kr')
    if (url.origin !== 'https://ilsangkit.co.kr') return null
    if (!allowedPath(url.pathname)) return null
    const params = new URLSearchParams()
    for (const [key, value] of url.searchParams.entries()) {
      if (key === 'schedule') continue
      if (allowedQueryKeys.has(key) && value.trim()) params.append(key, value)
    }
    const search = params.toString()
    return `${url.pathname}${search ? `?${search}` : ''}`
  } catch {
    return null
  }
}

export function parseLegacySchedule(value: unknown): number | null {
  const raw = firstValue(value)
  if (!raw || !POSITIVE_INTEGER.test(raw)) return null
  const id = Number.parseInt(raw, 10)
  return Number.isSafeInteger(id) ? id : null
}

export function sanitizeLegacyTrashFrom(rawHref: string): string | null {
  return sanitizePathAndQuery(rawHref, isTrashListPath, ALLOWED_TRASH_QUERY_KEYS)
}

export function sanitizeTrustedTrashReturn(rawHref: string): string | null {
  return sanitizePathAndQuery(rawHref, isTrustedNormalPath, TRUSTED_NORMAL_QUERY_KEYS)
}

export function cleanScheduleFromRoute(route: Pick<RouteLocationNormalizedLoaded, 'path' | 'query'>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(route.query)) {
    if (key === 'schedule') continue
    const raw = Array.isArray(value) ? value[0] : value
    if (typeof raw === 'string' && raw.trim()) params.set(key, raw.trim())
  }
  const search = params.toString()
  return `${route.path}${search ? `?${search}` : ''}`
}

export function legacyFromFragmentHash(hash: string): string | null {
  if (!hash.startsWith('#from=')) return null
  const encoded = hash.slice('#from='.length)
  try {
    return sanitizeLegacyTrashFrom(decodeURIComponent(encoded))
  } catch {
    return null
  }
}

export function stateForTrashSource(sourceId: number | null, context: TrashReturnContext): Record<string, TrashReturnState> {
  return {
    [STATE_KEY]: {
      sourceId,
      context,
    },
  }
}

export function storeTrashReturnStateForTarget(targetHref: string, state: Record<string, TrashReturnState>) {
  if (!hasBrowserHistory() || typeof window.sessionStorage === 'undefined') return
  const key = sessionKeyForTarget(targetHref)
  const value = state[STATE_KEY]
  if (!key) return
  const context = normalizeStoredState(value, value?.sourceId ?? null)
  if (!context) return
  window.sessionStorage.setItem(key, JSON.stringify({ sourceId: value.sourceId, context }))
}

export function trashReturnStateFromRoute(route: Pick<RouteLocationNormalizedLoaded, 'fullPath' | 'path'>, label: string, sourceId: number | null): Record<string, TrashReturnState> {
  const href = sanitizeTrustedTrashReturn(route.fullPath || route.path)
  if (!href) return {}
  return stateForTrashSource(sourceId, {
    href,
    label,
    scrollY: hasBrowserHistory() ? window.scrollY : undefined,
  })
}

export function readTrashReturnContext(sourceId: number | null): TrashReturnContext | null {
  if (!hasBrowserHistory()) return null
  const state = window.history.state
  const value = state && typeof state === 'object' ? state[STATE_KEY] as TrashReturnState | undefined : undefined
  const stateContext = normalizeStoredState(value, sourceId)
  if (stateContext && typeof stateContext.scrollY === 'number') {
    clearSessionReturnContextForCurrentTarget()
    return stateContext
  }

  const sessionContext = consumeSessionReturnContext(sourceId)
  if (sessionContext) return sessionContext
  if (stateContext) return stateContext

  if (window.location.hash) return null
  const rawBack = state && typeof state === 'object' ? (state as { back?: unknown }).back : undefined
  if (typeof rawBack !== 'string') return null
  const href = sanitizeTrustedTrashReturn(rawBack)
  if (!href) return null
  return {
    href,
    label: href.startsWith('/trash/areas/') ? '동별 안내로 돌아가기' : '목록으로 돌아가기',
  }
}

export function consumeLegacyTrashFromFragment(sourceId: number | null, fallbackLabel: string): TrashReturnContext | null {
  if (!hasBrowserHistory()) return null
  if (!window.location.hash.startsWith('#from=')) return null
  clearSessionReturnContextForCurrentTarget()
  const href = legacyFromFragmentHash(window.location.hash)
  const current = window.history.state && typeof window.history.state === 'object' ? window.history.state : {}
  const nextState = href
    ? { ...current, ...stateForTrashSource(sourceId, { href, label: fallbackLabel }) }
    : current
  window.history.replaceState(nextState, '', `${window.location.pathname}${window.location.search}`)
  if (!href) return null
  return { href, label: fallbackLabel }
}

export function buildTrashSourceHref(sourceId: number): string {
  return `/trash/${sourceId}`
}
