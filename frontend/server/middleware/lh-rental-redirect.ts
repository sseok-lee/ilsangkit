import { defineEventHandler, sendRedirect, getRequestURL } from 'h3'

const LEGACY_PATTERN = /^\/subscription\/rent\/(buy-lease|charter)\/?$/

export default defineEventHandler((event) => {
  const path = getRequestURL(event).pathname
  const match = path.match(LEGACY_PATTERN)
  if (!match) return
  return sendRedirect(event, `/lh-rental/${match[1]}`, 301)
})
