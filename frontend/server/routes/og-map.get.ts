import { defineEventHandler, getQuery, setHeader, sendRedirect } from 'h3'

// Naver Static Map API (NCP)
// https://api.ncloud-docs.com/docs/ai-naver-mapsstaticmap
const NAVER_API_BASE = 'https://maps.apigw.ntruss.com/map-static/v2/raster'

// 네이버 Static Map 최대 1024px 제한 → OG 권장 비율 1.91:1 에 맞춰 1024x536
const MAP_WIDTH = 1024
const MAP_HEIGHT = 536
const DEFAULT_LEVEL = 16

// 한국 좌표 경계 (backend/src/constants 와 동일 기준)
const KOREA_LAT_MIN = 33
const KOREA_LAT_MAX = 39
const KOREA_LNG_MIN = 124
const KOREA_LNG_MAX = 131

function fallbackRedirect(event: Parameters<typeof sendRedirect>[0], query: Record<string, unknown>) {
  const forwardParams = new URLSearchParams()
  if (query.category) forwardParams.set('category', String(query.category))
  if (query.title) forwardParams.set('title', String(query.title))
  if (query.city) forwardParams.set('city', String(query.city))
  if (query.district) forwardParams.set('district', String(query.district))
  return sendRedirect(event, `/og?${forwardParams.toString()}`, 302)
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)

  const lat = Number.parseFloat(String(query.lat ?? ''))
  const lng = Number.parseFloat(String(query.lng ?? ''))
  const level = Number.parseInt(String(query.level ?? DEFAULT_LEVEL), 10)
  const label = query.label ? String(query.label).slice(0, 30) : undefined

  const validCoords
    = Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= KOREA_LAT_MIN && lat <= KOREA_LAT_MAX
    && lng >= KOREA_LNG_MIN && lng <= KOREA_LNG_MAX

  const config = useRuntimeConfig(event)
  const clientId = config.ncpMapClientId
  const clientSecret = config.ncpMapClientSecret

  // 좌표 무효하거나 NCP 인증 정보 없으면 기존 SVG 카드로 fallback
  if (!validCoords || !clientId || !clientSecret) {
    return fallbackRedirect(event, query)
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
      throw new Error(`Naver Static Map ${response.status}`)
    }

    const buffer = Buffer.from(await response.arrayBuffer())
    setHeader(event, 'Content-Type', 'image/png')
    setHeader(event, 'Cache-Control', 'public, max-age=86400, s-maxage=86400')
    return buffer
  }
  catch {
    return fallbackRedirect(event, query)
  }
})
