function parseInstant(value: unknown): number | null {
  if (
    typeof value !== 'string'
    || !/^[1-9]\d{3}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  ) {
    return null
  }

  const ms = Date.parse(value)
  return Number.isFinite(ms) && new Date(ms).toISOString() === value ? ms : null
}

export function getAffiliateExpiryWindow(
  expiresAt: unknown,
  serverTime: unknown,
  requestDurationMs: number,
): { remainingMs: number | null } | null {
  const serverMs = parseInstant(serverTime)
  if (serverMs === null || !Number.isFinite(requestDurationMs) || requestDurationMs < 0) {
    return null
  }

  if (expiresAt === null) return { remainingMs: null }

  const expiryMs = parseInstant(expiresAt)
  if (expiryMs === null) return null

  const remainingMs = expiryMs - serverMs - requestDurationMs
  return remainingMs > 0 ? { remainingMs } : null
}
