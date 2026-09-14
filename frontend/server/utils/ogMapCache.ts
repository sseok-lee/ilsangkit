export interface OgMapCacheEntry {
  body: Buffer
  contentType: string
}

interface StoredOgMapCacheEntry extends OgMapCacheEntry {
  expiresAt: number
  byteLength: number
}

export const OG_MAP_SUCCESS_CACHE_TTL_MS = 24 * 60 * 60 * 1000
export const OG_MAP_SUCCESS_CACHE_MAX_BYTES = 24 * 1024 * 1024
const MAX_OG_MAP_CACHE_ENTRIES = 128

const imageCache = new Map<string, StoredOgMapCacheEntry>()
const pendingRequests = new Map<string, Promise<OgMapCacheEntry>>()
let cachedBytes = 0

function deleteCachedEntry(key: string) {
  const cached = imageCache.get(key)
  if (!cached) return
  cachedBytes -= cached.byteLength
  imageCache.delete(key)
}

export function getCachedOgMapImage(key: string, now = Date.now()): OgMapCacheEntry | undefined {
  const cached = imageCache.get(key)
  if (!cached) return undefined
  if (cached.expiresAt <= now) {
    deleteCachedEntry(key)
    return undefined
  }

  imageCache.delete(key)
  imageCache.set(key, cached)
  return { body: cached.body, contentType: cached.contentType }
}

export function setCachedOgMapImage(key: string, entry: OgMapCacheEntry, now = Date.now()) {
  const byteLength = entry.body.byteLength
  if (byteLength > OG_MAP_SUCCESS_CACHE_MAX_BYTES) return

  if (imageCache.has(key)) deleteCachedEntry(key)
  imageCache.set(key, {
    ...entry,
    byteLength,
    expiresAt: now + OG_MAP_SUCCESS_CACHE_TTL_MS,
  })
  cachedBytes += byteLength

  while (imageCache.size > MAX_OG_MAP_CACHE_ENTRIES || cachedBytes > OG_MAP_SUCCESS_CACHE_MAX_BYTES) {
    const oldestKey = imageCache.keys().next().value
    if (!oldestKey) break
    deleteCachedEntry(oldestKey)
  }
}

export async function coalesceOgMapRequest(
  key: string,
  loader: () => Promise<OgMapCacheEntry>,
): Promise<OgMapCacheEntry> {
  const pending = pendingRequests.get(key)
  if (pending) return pending

  const request = loader().finally(() => {
    pendingRequests.delete(key)
  })
  pendingRequests.set(key, request)
  return request
}

export function clearOgMapCache() {
  imageCache.clear()
  pendingRequests.clear()
  cachedBytes = 0
}
