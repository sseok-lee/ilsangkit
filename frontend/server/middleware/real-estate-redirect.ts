import { defineEventHandler, sendRedirect, getRequestURL } from 'h3'

const REDIRECT_MAP: Record<string, string> = {
  'apt-sale': 'apt',
  'apt-rent': 'apt',
  'villa-sale': 'villa',
  'villa-rent': 'villa',
  'offitel-sale': 'offitel',
  'offitel-rent': 'offitel',
}

export default defineEventHandler((event) => {
  const url = getRequestURL(event)
  const pathname = url.pathname

  // /real-estate/apt-sale, /real-estate/apt-sale/건물명 등 매칭
  const match = pathname.match(/^\/real-estate\/(apt-sale|apt-rent|villa-sale|villa-rent|offitel-sale|offitel-rent)(\/.*)?$/)
  if (!match) return

  const oldSlug = match[1]
  const rest = match[2] || '' // /건물명 부분
  const tab = oldSlug.endsWith('-sale') ? 'sale' : 'rent'
  const propertyType = REDIRECT_MAP[oldSlug]

  const newPath = `/real-estate/${propertyType}${rest}?tab=${tab}`
  return sendRedirect(event, newPath, 301)
})
