import { defineEventHandler, getQuery, setHeader } from 'h3'
import { generateOgImageSvg } from '../utils/ogImage'
import type { FacilityCategory } from '~/types/facility'
import { CATEGORY_META } from '~/types/facility'

const VALID_CATEGORIES = new Set<string>([
  ...Object.keys(CATEGORY_META),
  'apt', 'villa', 'offitel',
])

export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  const rawCategory = String(query.category ?? '')
  const rawTitle = String(query.title ?? '')
  const city = query.city ? String(query.city) : undefined
  const district = query.district ? String(query.district) : undefined

  // 유효하지 않은 category는 기본 OG 이미지로 fallback redirect
  if (!VALID_CATEGORIES.has(rawCategory)) {
    setHeader(event, 'Location', '/og-image.png')
    setHeader(event, 'Cache-Control', 'public, max-age=86400')
    event.node.res.statusCode = 302
    event.node.res.end()
    return
  }

  const category = rawCategory as FacilityCategory
  const meta = CATEGORY_META[category]
  const title = rawTitle || meta?.label || rawCategory

  const svg = generateOgImageSvg({ category, title, city, district })

  // SVG → PNG 변환 시도 (sharp가 사용 가능한 환경에서만)
  try {
    const sharp = await import('sharp').then(m => m.default)
    const pngBuffer = await sharp(Buffer.from(svg)).png().toBuffer()
    setHeader(event, 'Content-Type', 'image/png')
    setHeader(event, 'Cache-Control', 'public, max-age=86400, s-maxage=86400')
    return pngBuffer
  }
  catch {
    // sharp 사용 불가 시 SVG fallback (Cafe24 등 native binding 미지원 환경)
    setHeader(event, 'Content-Type', 'image/svg+xml')
    setHeader(event, 'Cache-Control', 'public, max-age=86400, s-maxage=86400')
    return svg
  }
})
