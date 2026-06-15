import { defineEventHandler, getQuery, setHeader } from 'h3'
import { generateOgImageSvg } from '../utils/ogImage'
import type { FacilityCategory } from '~/types/facility'
import { CATEGORY_META } from '~/types/facility'

const VALID_CATEGORIES = new Set<string>([
  ...Object.keys(CATEGORY_META),
  'apt', 'villa', 'offitel',
  'area',
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
    // sharp 사용 불가(Cafe24 등 native binding 미지원) 시, SVG는 네이버/카카오 썸네일
    // 크롤러가 렌더링하지 못하므로 정적 PNG로 302 리다이렉트한다 (상단 invalid-category 분기와 동일).
    setHeader(event, 'Location', '/og-image.png')
    setHeader(event, 'Cache-Control', 'public, max-age=86400')
    event.node.res.statusCode = 302
    event.node.res.end()
    return
  }
})
