import { defineEventHandler, getQuery, setHeader } from 'h3'
import type { H3Event } from 'h3'
import { generateOgImageSvg } from '../utils/ogImage'
import { CATEGORY_META, type FacilityCategory } from '~/types/facility'

const NAVER_API_BASE = 'https://maps.apigw.ntruss.com/map-static/v2/raster'
const MAP_WIDTH = 1024
const MAP_HEIGHT = 536
const DEFAULT_LEVEL = 16
const KOREA_LAT_MIN = 33
const KOREA_LAT_MAX = 39
const KOREA_LNG_MIN = 124
const KOREA_LNG_MAX = 131

// NCP Static Map markers spec uses | : SPACE as delimiters.
// Label must not contain those, and is capped at 20 chars by NCP recommendation.
export function sanitizeLabel(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const cleaned = raw.replace(/[|:]/g, '').replace(/\s+/g, ' ').trim().slice(0, 20)
  return cleaned || undefined
}

const REAL_ESTATE_TO_OG: Record<string, string> = {
  'apt-sale': 'apt', 'apt-rent': 'apt',
  'villa-sale': 'villa', 'villa-rent': 'villa',
  'offitel-sale': 'offitel', 'offitel-rent': 'offitel',
}
function normalizeOgCategory(raw: string): string {
  if (REAL_ESTATE_TO_OG[raw]) return REAL_ESTATE_TO_OG[raw]
  if (raw in CATEGORY_META) return raw
  if (raw === 'apt' || raw === 'villa' || raw === 'offitel') return raw
  return 'apt'
}

async function inlineFallback(
  event: H3Event,
  query: Record<string, unknown>,
): Promise<Buffer | string> {
  const category = normalizeOgCategory(String(query.category ?? 'apt')) as FacilityCategory
  const title = String(query.title ?? '')
  const city = query.city ? String(query.city) : undefined
  const district = query.district ? String(query.district) : undefined
  const svg = generateOgImageSvg({ category, title, city, district })
  try {
    const sharp = await import('sharp').then((m) => m.default)
    const png = await sharp(Buffer.from(svg)).png().toBuffer()
    setHeader(event, 'Content-Type', 'image/png')
    setHeader(event, 'Cache-Control', 'public, max-age=86400, s-maxage=86400')
    return png
  }
  catch {
    setHeader(event, 'Content-Type', 'image/svg+xml')
    setHeader(event, 'Cache-Control', 'public, max-age=86400, s-maxage=86400')
    return svg
  }
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  const lat = Number.parseFloat(String(query.lat ?? ''))
  const lng = Number.parseFloat(String(query.lng ?? ''))
  const level = Number.parseInt(String(query.level ?? DEFAULT_LEVEL), 10)
  const label = sanitizeLabel(query.label ? String(query.label) : undefined)

  const validCoords
    = Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= KOREA_LAT_MIN && lat <= KOREA_LAT_MAX
    && lng >= KOREA_LNG_MIN && lng <= KOREA_LNG_MAX

  const config = useRuntimeConfig(event)
  const clientId = (config as { ncpMapClientId?: string }).ncpMapClientId
  const clientSecret = (config as { ncpMapClientSecret?: string }).ncpMapClientSecret

  if (!validCoords || !clientId || !clientSecret) {
    return inlineFallback(event, query)
  }

  const markerSpec = label
    ? `type:d|size:mid|pos:${lng} ${lat}|label:${label}`
    : `type:d|size:mid|pos:${lng} ${lat}`

  const params = new URLSearchParams({
    w: String(MAP_WIDTH),
    h: String(MAP_HEIGHT),
    center: `${lng},${lat}`,
    level: String(level),
    scale: '2',
    format: 'png',
    markers: markerSpec,
  })

  try {
    const response = await fetch(`${NAVER_API_BASE}?${params.toString()}`, {
      headers: {
        'X-NCP-APIGW-API-KEY-ID': clientId,
        'X-NCP-APIGW-API-KEY': clientSecret,
      },
    })
    if (!response.ok) {
      console.warn('[og-map] NCP non-2xx', { status: response.status, lat, lng })
      return inlineFallback(event, query)
    }
    const buffer = Buffer.from(await response.arrayBuffer())
    setHeader(event, 'Content-Type', 'image/png')
    setHeader(event, 'Cache-Control', 'public, max-age=86400, s-maxage=86400')
    return buffer
  }
  catch (err) {
    console.warn('[og-map] NCP exception', { lat, lng, error: String(err) })
    return inlineFallback(event, query)
  }
})
