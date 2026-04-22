import { defineEventHandler, sendRedirect, getRequestURL, getRequestHost } from 'h3'

const CANONICAL_HOST = 'ilsangkit.co.kr'

export default defineEventHandler((event) => {
  const host = getRequestHost(event, { xForwardedHost: true })

  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) return
  if (host === CANONICAL_HOST) return

  const url = getRequestURL(event)
  return sendRedirect(event, `https://${CANONICAL_HOST}${url.pathname}${url.search}`, 301)
})
