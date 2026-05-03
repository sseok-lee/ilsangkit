import { defineEventHandler, sendRedirect, getRequestURL, setHeader, setResponseStatus } from 'h3'
import type { H3Event } from 'h3'
import {
  CITY_FULL_NAME_TO_SLUG,
  DISTRICT_SLUG_MAP,
  CITY_SLUGS,
} from '~/shared/regionSlugs'

/**
 * 부동산 레거시 URL → 신규 URL 단일 홉 301.
 *
 * 신규 URL 패턴: /real-estate/{type-mode}/{citySlug}/{districtSlug}/{buildingName}
 *
 * 처리 대상 레거시 패턴:
 *   - /real-estate/apt              → /real-estate/apt-sale       (301, LEGACY_TAB_LIST)
 *   - /real-estate/apt/{bldg}?bjd=  → /real-estate/apt-sale/{city}/{dist}/{bldg} (LEGACY_TAB_DETAIL)
 *   - /real-estate/apt-sale/{bldg}?bjd= → /real-estate/apt-sale/{city}/{dist}/{bldg} (LEGACY_SALE_DETAIL)
 *
 * bjdCode 역조회 실패 시 404 + helpful HTML — 어떤 region인지 모르는 상태로 region hub로
 * 보내면 SEO에 나쁘고 사용자에게도 오해를 주기 때문.
 *
 * NEW_DETAIL/NEW_HUB 패턴은 미들웨어가 무조건 pass-through — 리다이렉트 체인 방지.
 */

const LEGACY_TAB_DETAIL = /^\/real-estate\/(apt|villa|offitel)\/([^/]+)\/?$/
const LEGACY_TAB_LIST = /^\/real-estate\/(apt|villa|offitel)\/?$/
const LEGACY_SALE_DETAIL = /^\/real-estate\/(apt|villa|offitel)-(sale|rent)\/([^/]+)\/?$/
const NEW_DETAIL = /^\/real-estate\/(apt|villa|offitel)-(sale|rent)\/[^/]+\/[^/]+\/[^/]+\/?$/
const NEW_HUB = /^\/real-estate\/(apt|villa|offitel)-(sale|rent)\/[^/]+\/[^/]+\/?$/

// City hub slugs — 3-segment URLs ending with a city slug are new city hub pages, not legacy detail
const CITY_SLUGS_SET = new Set(Object.values(CITY_SLUGS))

type PropertyType = 'apt' | 'villa' | 'offitel'
type TransactionMode = 'sale' | 'rent'

/**
 * 프로세스-메모리 LRU 캐시 (max 10,000 / TTL 1h).
 * Node 의존 패키지를 추가하지 않기 위해 Map + insertion-order 만으로 구현.
 */
class TtlLRU<V> {
  private store = new Map<string, { value: V; expiresAt: number }>()
  constructor(private readonly max: number, private readonly ttlMs: number) {}

  get(key: string): V | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key)
      return undefined
    }
    // LRU: touch
    this.store.delete(key)
    this.store.set(key, entry)
    return entry.value
  }

  set(key: string, value: V): void {
    if (this.store.has(key)) this.store.delete(key)
    this.store.set(key, { value, expiresAt: Date.now() + this.ttlMs })
    while (this.store.size > this.max) {
      const oldest = this.store.keys().next().value
      if (oldest === undefined) break
      this.store.delete(oldest)
    }
  }

  clear(): void {
    this.store.clear()
  }

  get size(): number {
    return this.store.size
  }
}

export interface BjdLookupResult {
  cityFullName: string
  districtName: string
}

// 테스트/디버그용으로 export — 내부적으로는 싱글턴
export const bjdCache = new TtlLRU<BjdLookupResult>(10_000, 60 * 60 * 1000)

/**
 * bjdCode → {city, district} 역조회. 성공 시 TtlLRU 캐시에 저장, 실패 시 null.
 * 호출부는 null을 404 + helpful HTML로 변환한다 — 임의 region hub로 리다이렉트 금지
 * (어떤 region인지 모르기 때문).
 */
export async function resolveBjdCode(
  bjdCode: string,
  fetcher: (url: string) => Promise<unknown>,
  apiBase: string,
): Promise<BjdLookupResult | null> {
  if (!bjdCode) return null
  const cached = bjdCache.get(bjdCode)
  if (cached) return cached
  try {
    const res = (await fetcher(`${apiBase}/api/meta/region-by-bjd?bjdCode=${encodeURIComponent(bjdCode)}`)) as
      | { success: boolean; data?: { city: string; district: string } }
      | null
    if (res && res.success && res.data?.city && res.data?.district) {
      const result: BjdLookupResult = {
        cityFullName: res.data.city,
        districtName: res.data.district,
      }
      bjdCache.set(bjdCode, result)
      return result
    }
    return null
  } catch {
    return null
  }
}

function citySlugOf(cityFullName: string): string {
  return (
    CITY_FULL_NAME_TO_SLUG[cityFullName] ??
    CITY_SLUGS[cityFullName] ??
    cityFullName.toLowerCase()
  )
}

function districtSlugOf(districtName: string): string {
  return DISTRICT_SLUG_MAP[districtName] ?? districtName.toLowerCase().replace(/\s+/g, '-')
}

function buildNewDetailPath(
  propertyType: PropertyType,
  mode: TransactionMode,
  cityFullName: string,
  districtName: string,
  buildingName: string,
): string {
  const nfcName = decodeURIComponent(buildingName).normalize('NFC')
  return `/real-estate/${propertyType}-${mode}/${citySlugOf(cityFullName)}/${districtSlugOf(districtName)}/${encodeURIComponent(nfcName)}`
}

function renderMissingBjdHtml(originalPath: string): string {
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<title>건물을 찾을 수 없습니다 · 일상킷</title>
<meta name="robots" content="noindex" />
<style>
body{font-family:system-ui,-apple-system,sans-serif;background:#fafafa;color:#111;margin:0;padding:48px 24px;display:flex;min-height:100vh;align-items:center;justify-content:center}
.card{max-width:520px;background:#fff;border:1px solid #e5e7eb;border-radius:16px;padding:32px;box-shadow:0 4px 12px rgba(0,0,0,0.04)}
h1{font-size:22px;margin:0 0 12px}
p{color:#555;line-height:1.6;margin:0 0 20px}
a{display:inline-block;padding:10px 16px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;font-weight:500;margin-right:8px}
a.secondary{background:#f3f4f6;color:#111}
code{background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:13px}
</style>
</head>
<body>
<div class="card">
<h1>건물 정보를 찾지 못했습니다</h1>
<p>요청하신 URL <code>${originalPath}</code>의 건물명을 국토교통부 실거래 데이터에서 확인할 수 없습니다. URL이 변경되었거나 건물 정보가 아직 업데이트되지 않았을 수 있습니다.</p>
<a href="/real-estate">부동산 허브로 이동</a>
<a href="/" class="secondary">홈으로</a>
</div>
</body>
</html>`
}

export default defineEventHandler(async (event) => {
  const url = getRequestURL(event)
  const pathname = url.pathname

  // Nitro/Nuxt 내부 경로는 절대 가로채지 않는다.
  // 특히 /real-estate/{pt}/_payload.json 은 LEGACY_TAB_DETAIL 정규식에 우연히 매치되어
  // buildingName=_payload.json 으로 해석되던 버그 방지 (hydration payload 유실 원인).
  if (
    pathname.endsWith('/_payload.json') ||
    pathname.endsWith('/_payload.js') ||
    pathname.startsWith('/_nuxt/') ||
    pathname.startsWith('/_ipx/') ||
    pathname.startsWith('/__nuxt') ||
    pathname.startsWith('/api/')
  ) {
    return
  }

  // 신규 URL은 미들웨어가 절대 가로채지 않는다 (체인 방지)
  if (NEW_DETAIL.test(pathname) || NEW_HUB.test(pathname)) return

  const existingParams = new URLSearchParams(url.search)
  const bjdCode = existingParams.get('bjdCode') ?? ''
  const tabQuery = existingParams.get('tab')

  // LEGACY_SALE_LIST는 이제 신규 허브 URL이므로 패스스루 (NEW_HUB 패턴이 위에서 처리)
  // /real-estate/apt, /real-estate/villa, /real-estate/offitel → 각각 -sale 버전으로 301
  const tabListMatch = pathname.match(LEGACY_TAB_LIST)
  if (tabListMatch) {
    const propertyType = tabListMatch[1] as PropertyType
    const mode = tabQuery === 'rent' ? 'rent' : 'sale'
    return sendRedirect(event, `/real-estate/${propertyType}-${mode}`, 301)
  }

  // 레거시 detail: /real-estate/apt/{bldg}
  let match = pathname.match(LEGACY_TAB_DETAIL)
  if (match) {
    const propertyType = match[1] as PropertyType
    const rawName = match[2]
    const mode: TransactionMode = tabQuery === 'rent' ? 'rent' : 'sale'
    return await handleLegacyDetail(event, pathname, propertyType, mode, rawName, bjdCode)
  }

  // 레거시 sale/rent detail: /real-estate/apt-sale/{bldg}
  // 단, 3번째 세그먼트가 도시 슬러그이면 새 city hub URL — pass-through
  match = pathname.match(LEGACY_SALE_DETAIL)
  if (match) {
    const propertyType = match[1] as PropertyType
    const mode = match[2] as TransactionMode
    const rawName = match[3]
    if (CITY_SLUGS_SET.has(rawName)) return
    return await handleLegacyDetail(event, pathname, propertyType, mode, rawName, bjdCode)
  }

  // /real-estate/apt 는 pages/real-estate/[realEstateType]/index.vue 가 직접 서빙 — pass-through

  // 매칭 없음 — pass-through
})

async function handleLegacyDetail(
  event: H3Event,
  pathname: string,
  propertyType: PropertyType,
  mode: TransactionMode,
  rawName: string,
  bjdCode: string,
): Promise<void> {
  // bjdCode가 없으면 404 + helpful page (region을 모르면 최종 URL을 만들 수 없음)
  if (!bjdCode) {
    setResponseStatus(event, 404)
    setHeader(event, 'content-type', 'text/html; charset=utf-8')
    setHeader(event, 'cache-control', 'no-store')
    return event.respondWith(new Response(renderMissingBjdHtml(pathname), { status: 404 }))
  }

  const apiBase = (process.env.NUXT_PUBLIC_API_BASE ?? 'http://localhost:8000')
  const lookup = await resolveBjdCode(bjdCode, (u) => $fetch(u), apiBase)
  if (!lookup) {
    setResponseStatus(event, 404)
    setHeader(event, 'content-type', 'text/html; charset=utf-8')
    setHeader(event, 'cache-control', 'no-store')
    return event.respondWith(new Response(renderMissingBjdHtml(pathname), { status: 404 }))
  }

  const newPath = buildNewDetailPath(
    propertyType,
    mode,
    lookup.cityFullName,
    lookup.districtName,
    rawName,
  )
  // 브라우저/크롤러 캐시 완화: 짧은 TTL 로 301을 재검증 가능하게 유지
  setHeader(event, 'cache-control', 'public, max-age=300')
  return sendRedirect(event, newPath, 301)
}
