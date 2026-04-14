import { defineEventHandler, setResponseStatus, getRequestURL } from 'h3'

// 제거된 카테고리 — 410 Gone으로 Google de-index 유도
const GONE_PREFIXES = ['/kiosk/']
const GONE_SUFFIXES = ['/kiosk']

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname

  if (
    GONE_PREFIXES.some((p) => path.startsWith(p)) ||
    GONE_SUFFIXES.some((s) => path.endsWith(s))
  ) {
    setResponseStatus(event, 410)
    return 'Gone'
  }
})
