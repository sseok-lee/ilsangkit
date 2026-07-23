import { defineEventHandler, sendRedirect, getRequestURL, setHeader, setResponseStatus } from 'h3'
import type { H3Event } from 'h3'
import {
  DISTRICT_SLUG_MAP,
  CITY_SLUGS,
} from '~/shared/regionSlugs'
import { toCitySlugByDistrict } from '~/utils/realEstateUrl'
import { ssrFetch } from '~/server/utils/ssrFetch'

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
// (CITY_SLUGS 는 shared/regionSlugs.ts에 jeonnamgwangju 포함 — 신 slug 요청은 자동으로 pass-through)
export const CITY_SLUGS_SET = new Set(Object.values(CITY_SLUGS))

/**
 * 2026-07 전남광주통합특별시 정규화 — 부동산 NEW-format URL의 옛 city slug(gwangju/jeonnam) → jeonnamgwangju 301.
 *
 * env `REGION_REORG_301`='1' 일 때만 발동(Phase A는 로직만 심고 기본 OFF).
 * 대상: `/real-estate/{type}-{mode}/{city}/{district}[/{building}]` (NEW_HUB 4세그·NEW_DETAIL 5세그).
 * district/building 세그먼트는 byte-match 로 불변 — city 세그먼트(segments[3])만 치환한다.
 *
 * 이 판정은 반드시 아래 NEW_DETAIL/NEW_HUB pass-through(체인 방지) 보다 먼저 호출해야 한다 —
 * 그렇지 않으면 gwangju/jeonnam 도 이미 "신규 URL"로 오인되어 pass-through 에 먹혀 리다이렉트가 발동하지 않는다.
 */
const LEGACY_JNGJ_CITIES = new Set(['gwangju', 'jeonnam'])
const JNGJ_SLUG = 'jeonnamgwangju'
const NEW_FORMAT_TYPE_MODE = /^(apt|villa|offitel)-(sale|rent)$/

export function resolveRegionReorgCityRedirect(pathname: string, flagOn: boolean): string | null {
  if (!flagOn) return null

  const segments = pathname.split('/') // ['', 'real-estate', type-mode, city, district, ...building]
  if (segments[1] !== 'real-estate' || segments.length < 5) return null
  if (!NEW_FORMAT_TYPE_MODE.test(segments[2] ?? '')) return null

  const city = segments[3]
  if (!city || !LEGACY_JNGJ_CITIES.has(city)) return null

  segments[3] = JNGJ_SLUG
  return segments.join('/')
}

/**
 * 2026-07-01 인천 개편 — 소멸구(서구·중구·동구) 부동산 URL을 신설구로 301.
 *   서구→서해구+검단구, 중구→제물포구+영종구, 동구→제물포구 (1:N 분리라 단지=동별 현행구 조회 필요).
 * env `INCHEON_REORG_301`='1' 일 때만 발동(데이터 재싱크·삭제 완료 후 ON).
 * 대상: `/real-estate/{type}-{mode}/incheon/{seo|jung|dong}[/{building}]` (NEW_HUB 4세그·NEW_DETAIL 5세그).
 *   - 허브(구 목록, building 없음) → 시 허브 `/real-estate/{type}-{mode}/incheon`
 *   - 단지 상세 → 국토부 현행 귀속(신설구) 조회 후 신설구 URL로 301, 미발견 시 notFound
 * NEW_DETAIL/NEW_HUB pass-through 보다 먼저 호출해야 발동됨(gwangju와 동일).
 */
const INCHEON_DISSOLVED_DISTRICT_SLUGS = new Set(['seo', 'jung', 'dong'])
const INCHEON_CURRENT_DISTRICT_SLUGS = new Set([
  'jemulpo', 'yeongjong', 'michuhol', 'yeonsu', 'namdong',
  'bupyeong', 'gyeyang', 'seohae', 'geomdan', 'ganghwa', 'ongjin',
])

export async function resolveIncheonReorgRedirect(
  pathname: string,
  fetcher: (path: string) => Promise<unknown>,
): Promise<{ redirect: string } | { notFound: true } | null> {
  const seg = pathname.split('/') // ['', 'real-estate', type-mode, 'incheon', dslug, building?]
  if (seg[1] !== 'real-estate' || !NEW_FORMAT_TYPE_MODE.test(seg[2] ?? '')) return null
  if (seg[3] !== 'incheon') return null
  const dslug = seg[4]
  if (!dslug || !INCHEON_DISSOLVED_DISTRICT_SLUGS.has(dslug)) return null

  const building = seg[5]
  // 구 허브(단지 없음) → 시 허브 (서구는 2구로 분리라 단일 신설구로 못 보냄)
  if (!building) return { redirect: `/real-estate/${seg[2]}/incheon` }

  // 단지 상세: 국토부 현행 귀속(신설구)을 조회해 목적지 결정
  let decoded: string
  try { decoded = decodeURIComponent(building) } catch { decoded = building }
  const nfc = decoded.normalize('NFC')
  try {
    const res = (await fetcher(
      `/api/real-estate/${seg[2]}/complexes?city=${encodeURIComponent('인천')}&buildingName=${encodeURIComponent(nfc)}&limit=20`,
    )) as { success?: boolean; data?: { items?: Array<{ district: string; buildingName: string }> } } | null
    const items = res?.data?.items ?? []
    const isCurrent = (d: string) => {
      const s = DISTRICT_SLUG_MAP[d]
      return !!s && INCHEON_CURRENT_DISTRICT_SLUGS.has(s)
    }
    // 정확 일치(현행구) 우선, 없으면 현행구 첫 건
    const cur = items.find((it) => it.buildingName === nfc && isCurrent(it.district))
      ?? items.find((it) => isCurrent(it.district))
    if (!cur) return { notFound: true }
    return { redirect: `/real-estate/${seg[2]}/incheon/${DISTRICT_SLUG_MAP[cur.district]}/${building}` }
  } catch {
    return { notFound: true }
  }
}

/**
 * 화성·부천 7개 신설 일반구의 slug 드리프트로 과거 색인·IndexNow 에 유출된 "깨진" 지역 슬러그를
 * 정본으로 매핑한다. 두 종류의 깨진 형태가 존재:
 *   - 로마자-한글 혼합 `hwaseong-효행구` (구 Region.slug / syncRegion split 폴백)
 *   - 전-한글 `화성시-효행구` (backend lib toDistrictSlug 폴백 → IndexNow 제출본)
 * 근본 원인(맵 동기화)은 별도 수정했고, 이 맵은 이미 밖에 나간 URL 을 404 대신 301 로 구제한다.
 */
const BROKEN_DISTRICT_REDIRECTS: Record<string, string> = {
  'hwaseong-효행구': 'hwaseong-hyohaeng', '화성시-효행구': 'hwaseong-hyohaeng',
  'hwaseong-동탄구': 'hwaseong-dongtan', '화성시-동탄구': 'hwaseong-dongtan',
  'hwaseong-만세구': 'hwaseong-manse', '화성시-만세구': 'hwaseong-manse',
  'hwaseong-병점구': 'hwaseong-byeongjeom', '화성시-병점구': 'hwaseong-byeongjeom',
  'bucheon-소사구': 'bucheon-sosa', '부천시-소사구': 'bucheon-sosa',
  'bucheon-오정구': 'bucheon-ojeong', '부천시-오정구': 'bucheon-ojeong',
  'bucheon-원미구': 'bucheon-wonmi', '부천시-원미구': 'bucheon-wonmi',
}

/**
 * /real-estate/{type}/{city}/{district}[/{building}] 의 district 세그먼트가 깨진 슬러그면
 * 정본 슬러그로 치환한 경로를 반환. 해당 없으면 null. (pathname 은 인코딩 여부 무관하게 디코드해 매칭)
 */
export function resolveBrokenDistrictRedirect(pathname: string): string | null {
  const segments = pathname.split('/') // ['', 'real-estate', type, city, district, ...building]
  if (segments[1] !== 'real-estate' || segments.length < 5 || !segments[4]) return null
  let districtDecoded: string
  try {
    districtDecoded = decodeURIComponent(segments[4])
  } catch {
    districtDecoded = segments[4]
  }
  const canonical = BROKEN_DISTRICT_REDIRECTS[districtDecoded]
  if (!canonical) return null
  segments[4] = canonical
  return segments.join('/')
}

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
  fetcher: (path: string) => Promise<unknown>,
): Promise<BjdLookupResult | null> {
  if (!bjdCode) return null
  const cached = bjdCache.get(bjdCode)
  if (cached) return cached
  try {
    const res = (await fetcher(`/api/meta/region-by-bjd?bjdCode=${encodeURIComponent(bjdCode)}`)) as
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
  return `/real-estate/${propertyType}-${mode}/${toCitySlugByDistrict(cityFullName, districtName)}/${districtSlugOf(districtName)}/${encodeURIComponent(nfcName)}`
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

  // 과거 색인·IndexNow 에 유출된 깨진 지역 슬러그(화성/부천 신설 구)를 정본으로 301.
  // NEW_HUB/NEW_DETAIL 패턴에도 매치되므로 아래 체인-방지 pass-through 보다 먼저 처리해야 한다.
  const brokenRedirect = resolveBrokenDistrictRedirect(pathname)
  if (brokenRedirect) {
    setHeader(event, 'cache-control', 'public, max-age=300')
    return sendRedirect(event, brokenRedirect + url.search, 301)
  }

  // 전남광주통합특별시 정규화 301 (REGION_REORG_301='1' 일 때만, 기본 OFF).
  // NEW_HUB/NEW_DETAIL 패턴에도 매치되므로 아래 체인-방지 pass-through 보다 먼저 처리해야 한다.
  const reorgCityRedirect = resolveRegionReorgCityRedirect(
    pathname,
    process.env.REGION_REORG_301 === '1',
  )
  if (reorgCityRedirect) {
    setHeader(event, 'cache-control', 'public, max-age=300')
    return sendRedirect(event, reorgCityRedirect + url.search, 301)
  }

  // 인천 개편 소멸구(서구/중구/동구) → 신설구 301 (INCHEON_REORG_301='1' 일 때만).
  // NEW_DETAIL/NEW_HUB 패턴에도 매치되므로 아래 체인-방지 pass-through 보다 먼저 처리.
  if (process.env.INCHEON_REORG_301 === '1') {
    const incheon = await resolveIncheonReorgRedirect(pathname, (path) => ssrFetch(path))
    if (incheon && 'redirect' in incheon) {
      setHeader(event, 'cache-control', 'public, max-age=300')
      return sendRedirect(event, incheon.redirect + url.search, 301)
    }
    if (incheon && 'notFound' in incheon) {
      setResponseStatus(event, 404)
      setHeader(event, 'content-type', 'text/html; charset=utf-8')
      setHeader(event, 'cache-control', 'no-store')
      return event.respondWith(new Response(renderMissingBjdHtml(pathname), { status: 404 }))
    }
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

  const lookup = await resolveBjdCode(bjdCode, (path) => ssrFetch(path))
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
