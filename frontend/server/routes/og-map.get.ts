import { defineEventHandler, getQuery, setHeader } from 'h3'
import type { H3Event } from 'h3'
import { generateOgImageSvg, SPECIAL_OG_LABELS } from '../utils/ogImage'
import { CATEGORY_META, type FacilityCategory } from '~/types/facility'
import {
  OG_MAP_WIDTH,
  OG_MAP_HEIGHT,
  OG_MAP_SCALE,
  OG_MAP_FORMAT,
  OG_MAP_CONTENT_TYPE,
  isMappableCoord,
} from '~/utils/ogMapSpec'

const NAVER_API_BASE = 'https://maps.apigw.ntruss.com/map-static/v2/raster'
const DEFAULT_LEVEL = 16

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
/**
 * 폴백 카드(NCP 실패·좌표 무효 시)의 라벨·색을 고르는 키로 정규화한다.
 *
 * 옛 구현은 모르는 키를 전부 'apt' 로 떨어뜨렸다. 그래서 공매 물건(category=auction),
 * 청약 단지(subscription), 지하철역(area)이 모두 '아파트 실거래가' 카드로 렌더됐다 —
 * 폴백이 비어 보이는 정도가 아니라 사실과 다른 라벨을 붙이고 있었다.
 * 라벨이 실제로 존재하는 키(CATEGORY_META·부동산·SPECIAL)는 그대로 통과시키고,
 * 나머지는 도메인 중립인 'area'(지역 생활 정보)로 보낸다.
 * auction·subscription 라벨은 server/utils/ogImage.ts 의 SPECIAL_OG_LABELS 에 있다 —
 * 새 도메인을 추가할 때는 그쪽에 라벨·색을 먼저 넣어야 여기 통과 조건이 성립한다.
 */
export function normalizeOgCategory(raw: string): string {
  if (REAL_ESTATE_TO_OG[raw]) return REAL_ESTATE_TO_OG[raw]
  if (raw in CATEGORY_META) return raw
  if (raw === 'apt' || raw === 'villa' || raw === 'offitel') return raw
  if (raw in SPECIAL_OG_LABELS) return raw
  return 'area'
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

  // 범위 판정은 ogMapSpec 한 곳에서만 한다 — og:image URL 생성기와 같은 함수를 봐야
  // "라우트는 폴백(SVG)으로 떨어지는데 메타는 그 URL 을 가리키는" 상태가 생기지 않는다.
  const validCoords = isMappableCoord(lat, lng)

  const config = useRuntimeConfig(event)
  const clientId = (config as { ncpMapClientId?: string }).ncpMapClientId
  const clientSecret = (config as { ncpMapClientSecret?: string }).ncpMapClientSecret

  if (!validCoords || !clientId || !clientSecret) {
    return inlineFallback(event, query)
  }

  const markerSpec = label
    ? `type:d|size:mid|pos:${lng} ${lat}|label:${label}`
    : `type:d|size:mid|pos:${lng} ${lat}`

  // scale 은 1 이어야 출력이 og:image:width/height 선언값과 일치한다 — ogMapSpec 주석 참고.
  const params = new URLSearchParams({
    w: String(OG_MAP_WIDTH),
    h: String(OG_MAP_HEIGHT),
    center: `${lng},${lat}`,
    level: String(level),
    scale: String(OG_MAP_SCALE),
    format: OG_MAP_FORMAT,
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
    setHeader(event, 'Content-Type', OG_MAP_CONTENT_TYPE)
    setHeader(event, 'Cache-Control', 'public, max-age=86400, s-maxage=86400')
    return buffer
  }
  catch (err) {
    console.warn('[og-map] NCP exception', { lat, lng, error: String(err) })
    return inlineFallback(event, query)
  }
})
