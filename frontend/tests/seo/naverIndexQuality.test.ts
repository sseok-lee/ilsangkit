import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { buildRealEstateDetailMeta } from '~/composables/useRealEstateDetailMeta'
import { buildOgMapImageUrl, staticOgImageUrl, isRedirectingOgUrl, OG_IMAGE_URL_MAX } from '~/utils/ogImageUrl'
import { isListingDocumentIndexable } from '~/utils/indexability'
import { sitemapLocDropReason, filterSitemapUrls, SITE_URL } from '~/server/utils/sitemap'

/**
 * 네이버 색인 품질 회귀 가드 — 요구된 8개 항목을 한 파일에 모은다.
 *
 * 2026-09-04 서치어드바이저 실측: 중복 title 225,681 · 중복 description 225,388 ·
 * 리디렉션 3,193 · 접근 불가 523 · 소프트 404 25 · 일 수집량 33,000 → 3,000.
 *
 * 각 항목이 "어느 지표를 내리는 변경인지" 를 describe 이름에 적어둔다. 개별 구현의 상세
 * 회귀는 담당 테스트 파일(tests/pages/detail-soft-error.test.ts,
 * tests/server/sitemap-quality-gate.test.ts, tests/composables/useRealEstateDetailMeta.uniqueness.test.ts,
 * tests/pages/auction/auctionRankingIndexability.test.ts 등)이 맡고, 여기서는 요구 계약만
 * 단일 지점에서 감시한다. 이 파일이 깨지면 요구사항 자체가 깨진 것이다.
 *
 * SSR setup 최상단/`import.meta.server` 문맥의 분기는 vitest 에서 그대로 실행되지 않으므로,
 * 이 저장소 선례(tests/pages/detail-soft-error.test.ts)와 같이 소스 단언으로 고정한다.
 */

const frontendRoot = process.cwd().endsWith('/frontend')
  ? process.cwd()
  : join(process.cwd(), 'frontend')

const readSource = (rel: string) => readFileSync(resolve(frontendRoot, rel), 'utf8')

const trashDetail = readSource('pages/trash/[id].vue')
const goneMiddleware = readSource('server/middleware/gone.ts')
const trashRegionHub = readSource('pages/[city]/[district]/[category].vue')
const categoryList = readSource('pages/[category]/index.vue')
const auctionRanking = readSource('pages/auction/ranking.vue')

// ─────────────────────────────────────────────────────────────────────────────
// 1. /trash/abc 가 2xx 를 반환하지 않는다  (소프트 404 25건)
// ─────────────────────────────────────────────────────────────────────────────
describe('1. 잘못된 형식의 쓰레기 ID 는 2xx 가 아니다', () => {
  // 페이지가 들고 있는 정규식을 소스에서 그대로 꺼내 같은 입력으로 평가한다.
  // 상수를 테스트에 복제하면 페이지가 바뀌어도 테스트는 통과해버린다.
  const patternMatch = trashDetail.match(/const TRASH_ID_PATTERN = (\/.+\/)\n/)
  const trashIdPattern = new RegExp(patternMatch![1].slice(1, -1))

  it('페이지가 id 형식 정규식을 선언한다', () => {
    expect(patternMatch).not.toBeNull()
  })

  it.each(['abc', '1.5', '-1', '', ' ', '0', '01', 'abc123', '12abc', '1e3', 'NaN'])(
    '%o 는 유효한 id 가 아니다',
    (raw) => {
      expect(trashIdPattern.test(raw)).toBe(false)
    },
  )

  it.each(['1', '13343', '999999999'])('%o 는 유효한 id 다', (raw) => {
    expect(trashIdPattern.test(raw)).toBe(true)
  })

  it('검증 실패 시 400 을 던진다', () => {
    expect(trashDetail).toMatch(
      /if \(!TRASH_ID_PATTERN\.test\(rawScheduleId\)\) \{[\s\S]{0,120}statusCode: 400/,
    )
  })

  it('검증이 useAsyncData 보다 먼저 있다 (핸들러 안에서 던지면 Nuxt 가 렌더를 계속해 200 이 된다)', () => {
    const guardAt = trashDetail.indexOf('TRASH_ID_PATTERN.test(rawScheduleId)')
    const fetchAt = trashDetail.indexOf('useAsyncData(')
    expect(guardAt).toBeGreaterThan(-1)
    expect(fetchAt).toBeGreaterThan(-1)
    expect(guardAt).toBeLessThan(fetchAt)
  })

  it('400 을 useAsyncData 핸들러 안에서 던지던 형태로 돌아가지 않는다 (회귀 핵심)', () => {
    expect(trashDetail).not.toMatch(/useAsyncData\([\s\S]{0,400}statusCode: 400/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 2. 존재하지 않는 쓰레기 ID 가 404 를 반환한다
// ─────────────────────────────────────────────────────────────────────────────
describe('2. 존재하지 않는 쓰레기 ID 는 404 다', () => {
  it('백엔드가 없다고 확정(404/422)하면 하드 404 를 던진다', () => {
    expect(trashDetail).toMatch(
      /errStatus === 404 \|\| errStatus === 422[\s\S]{0,160}statusCode: 404/,
    )
  })

  it('그 외 실패(5xx·타임아웃)는 404 가 아니라 degraded(503) 다 — fail-open', () => {
    expect(trashDetail).toMatch(/\} else if \(import\.meta\.server\) \{[\s\S]{0,400}markDegradedResponse\(\)/)
    expect(trashDetail).toContain("import { markDegradedResponse } from '~/composables/useDegradedResponse'")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 3. 종료·폐원 시설은 기존 410 정책을 유지한다
// ─────────────────────────────────────────────────────────────────────────────
describe('3. 종료된 카테고리는 410 을 유지한다', () => {
  it('gone 미들웨어가 410 을 설정한다', () => {
    expect(goneMiddleware).toMatch(/setResponseStatus\(event, 410\)/)
  })

  it.each(['/kiosk/', '/public-rental/', '/lh-rental/'])('%s 접두사가 410 대상으로 남아 있다', (prefix) => {
    expect(goneMiddleware).toContain(`'${prefix}'`)
  })

  it('410 대상이 404 나 301 로 바뀌지 않았다', () => {
    expect(goneMiddleware).not.toMatch(/setResponseStatus\(event, (404|301|200)\)/)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 4. ?schedule= 페이지의 canonical 이 기본 지역 URL 이다
// ─────────────────────────────────────────────────────────────────────────────
describe('4. ?schedule= 는 UI 상태 — canonical 은 쿼리 없는 지역 허브를 가리킨다', () => {
  it('지역 허브 canonical 은 path 로만 조립되고 route.query 를 섞지 않는다', () => {
    const canonicalBlock = trashRegionHub.slice(
      trashRegionHub.indexOf("rel: 'canonical'"),
      trashRegionHub.indexOf("rel: 'canonical'") + 220,
    )
    expect(canonicalBlock).toContain('https://ilsangkit.co.kr/${city.value}/${district.value}/${category.value}')
    expect(canonicalBlock).not.toContain('schedule')
    expect(canonicalBlock).not.toContain('route.query')
  })

  it('전국 목록(/trash)의 canonicalPath 도 schedule 을 담지 않는다', () => {
    const start = categoryList.indexOf('const canonicalPath = computed(')
    expect(start).toBeGreaterThan(-1)
    const block = categoryList.slice(start, start + 700)
    expect(block).not.toContain('schedule')
  })

  it('내부 페이지네이션 링크가 schedule 을 전파하지 않는다', () => {
    const paginationHref = readSource('utils/paginationHref.ts')
    expect(paginationHref).toContain('UI_STATE_QUERY_KEYS')
    expect(paginationHref).toMatch(/UI_STATE_QUERY_KEYS[\s\S]{0,120}'schedule'/)
  })

  it('지역 허브는 noindex 가 아닐 때만 canonical 을 낸다 (혼합 신호 방지)', () => {
    expect(trashRegionHub).toMatch(
      /if \(isPageNoindex\.value\) \{[\s\S]{0,200}robots[\s\S]{0,200}\}\s*\n\s*return \{[\s\S]{0,120}rel: 'canonical'/,
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 5. sitemap 에 query URL, noindex, redirect, 4xx URL 이 없다
// ─────────────────────────────────────────────────────────────────────────────
describe('5. sitemap 품질 게이트', () => {
  it.each([
    `${SITE_URL}/chungnam/buyeo/trash?schedule=13343`,
    `${SITE_URL}/toilet?page=2`,
    `${SITE_URL}/auction/list?usage=zzz`,
    `${SITE_URL}/hospital?city=seoul`,
  ])('쿼리가 붙은 %s 는 거부된다', (loc) => {
    expect(sitemapLocDropReason(loc)).toBe('query')
  })

  it.each([
    `${SITE_URL}/og?category=toilet&title=x`,
    `${SITE_URL}/og-map?lat=37.5&lng=127.0`,
  ])('OG 이미지 엔드포인트 %s 는 거부된다', (loc) => {
    expect(sitemapLocDropReason(loc)).not.toBeNull()
  })

  it('빈 경로 세그먼트(//)가 있는 URL 은 거부된다 — 어느 라우트에도 맞지 않아 404 가 된다', () => {
    expect(sitemapLocDropReason(`${SITE_URL}/gyeonggi//trash`)).toBe('empty-segment')
  })

  it('퍼센트 인코딩되지 않은 한글 loc 은 거부된다 (사이트맵 스펙 위반 + 라우트 미매칭)', () => {
    expect(sitemapLocDropReason(`${SITE_URL}/real-estate/apt-sale/seoul/강남구/현대`)).toBe('non-ascii')
  })

  it('정상 URL 은 통과한다', () => {
    expect(sitemapLocDropReason(`${SITE_URL}/toilet/toilet-000056332451efb6`)).toBeNull()
    expect(
      sitemapLocDropReason(`${SITE_URL}/real-estate/apt-sale/gangwon/wonju/${encodeURIComponent('EG-the1아파트')}`),
    ).toBeNull()
  })

  it('filterSitemapUrls 가 부적격 항목을 통째로 버린다 (조용히 고치지 않는다)', () => {
    const result = filterSitemapUrls([
      { loc: `${SITE_URL}/toilet/toilet-abc` },
      { loc: `${SITE_URL}/chungnam/buyeo/trash?schedule=1` },
      { loc: `${SITE_URL}/gyeonggi//trash` },
      { loc: `${SITE_URL}/og?category=toilet` },
      { loc: `${SITE_URL}/toilet/toilet-abc` }, // 중복
    ])
    expect(result.urls).toHaveLength(1)
    expect(result.urls[0].loc).toBe(`${SITE_URL}/toilet/toilet-abc`)
    expect(result.dropped).toBe(4)
    // `?schedule=` 과 `/og?category=` 둘 다 쿼리 사유로 걸린다 — og 엔드포인트는
    // 경로 규칙에 걸리기 전에 쿼리 규칙에 먼저 잡히므로 사유가 하나로 합쳐진다.
    expect(result.reasons.query).toBe(2)
    expect(result.reasons['empty-segment']).toBe(1)
    expect(result.reasons.duplicate).toBe(1)
  })

  it('사이트맵 생성 코드가 게이트를 우회하지 못한다 (모든 loc 은 filterSitemapUrls 를 지난다)', () => {
    const sitemapUtil = readSource('server/utils/sitemap.ts')
    const gen = sitemapUtil.slice(sitemapUtil.indexOf('export function generateSitemapXml'))
    expect(gen).toContain('filterSitemapUrls(')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 6. 서로 다른 지역의 동일 단지명이 서로 다른 title/description 을 갖는다
//    (중복 title 225,681 / 중복 description 225,388)
// ─────────────────────────────────────────────────────────────────────────────
describe('6. 동일 단지명 × 다른 지역 → 고유 title/description', () => {
  const base = {
    buildingName: '현대',
    propertyType: 'apt' as const,
    transactionMode: 'sale' as const,
    summary: { totalCount: 12, recentDeal: { amount: 85000, dealDate: '2026년 8월' } },
    buildYear: 1998,
    areaRange: { min: 59, max: 84 },
    facilitySummary: null,
  }

  const seoul = buildRealEstateDetailMeta({ ...base, region: { city: '서울특별시', district: '강남구', dong: '역삼동' } })
  const busan = buildRealEstateDetailMeta({ ...base, region: { city: '부산광역시', district: '해운대구', dong: '우동' } })
  const jeju = buildRealEstateDetailMeta({ ...base, region: { city: '제주특별자치도', district: '서귀포시', dong: '서귀동' } })

  it('세 지역의 title 이 모두 다르다', () => {
    expect(new Set([seoul.title, busan.title, jeju.title]).size).toBe(3)
  })

  it('세 지역의 description 이 모두 다르다', () => {
    expect(new Set([seoul.description, busan.description, jeju.description]).size).toBe(3)
  })

  it('title 이 요구 형식 — {시도} {시군구} … {단지명} … 실거래가·시세 | 일상킷', () => {
    expect(seoul.title.startsWith('서울 강남구')).toBe(true)
    expect(seoul.title).toContain('현대')
    expect(seoul.title).toContain('실거래가·시세')
    expect(seoul.title.endsWith('| 일상킷')).toBe(true)
  })

  it('지역 토큰이 앞에 있어 첫 6자만으로도 구분된다 (SERP 절단 대비)', () => {
    const heads = [seoul.title, busan.title, jeju.title].map((t) => t.slice(0, 6))
    expect(new Set(heads).size).toBe(3)
  })

  it('거래유형이 title 에 드러난다 (매매 ≠ 전월세)', () => {
    const rent = buildRealEstateDetailMeta({
      ...base,
      transactionMode: 'rent',
      region: { city: '서울특별시', district: '강남구', dong: '역삼동' },
    })
    expect(seoul.title).toContain('매매')
    expect(rent.title).toContain('전월세')
    expect(rent.title).not.toBe(seoul.title)
  })

  it('빌라/오피스텔의 타입어가 제목에서 사라지지 않는다 (같은 이름의 아파트와 충돌 방지)', () => {
    const region = { city: '서울특별시', district: '강남구', dong: '역삼동' }
    const long = { ...base, buildingName: '광교대광로제비앙아파트단지', region }
    const apt = buildRealEstateDetailMeta({ ...long, propertyType: 'apt' })
    const villa = buildRealEstateDetailMeta({ ...long, propertyType: 'villa' })
    const offitel = buildRealEstateDetailMeta({ ...long, propertyType: 'offitel' })
    expect(villa.title).toContain('빌라')
    expect(offitel.title).toContain('오피스텔')
    expect(new Set([apt.title, villa.title, offitel.title]).size).toBe(3)
  })

  it('description 이 URL/ID 를 덧붙여 중복만 피하는 방식이 아니다', () => {
    for (const meta of [seoul, busan, jeju]) {
      expect(meta.description).not.toMatch(/https?:\/\//)
      expect(meta.description).not.toMatch(/real-estate\//)
      expect(meta.description).toContain('현대')
    }
    // 실데이터가 실제로 들어간다
    expect(seoul.description).toContain('12')
  })

  it('데이터가 전혀 없어도 지역이 달라 description 이 갈린다', () => {
    const empty = { ...base, summary: null, buildYear: null, areaRange: null }
    const a = buildRealEstateDetailMeta({ ...empty, region: { city: '서울특별시', district: '중구', dong: null } })
    const b = buildRealEstateDetailMeta({ ...empty, region: { city: '부산광역시', district: '중구', dong: null } })
    expect(a.description).not.toBe(b.description)
    expect(a.title).not.toBe(b.title)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 7. 빈 랭킹 페이지가 indexable 하지 않다  (소프트 404)
// ─────────────────────────────────────────────────────────────────────────────
describe('7. 데이터 없는 /auction/ranking 은 색인 대상이 아니다', () => {
  it('행이 0이면 noindex 다', () => {
    expect(isListingDocumentIndexable({ itemCount: 0, fetchFailed: false })).toBe(false)
  })

  it('행이 생기면 자동으로 indexable 이 된다 (수동 플래그·재배포 불필요)', () => {
    expect(isListingDocumentIndexable({ itemCount: 1, fetchFailed: false })).toBe(true)
    expect(isListingDocumentIndexable({ itemCount: 50, fetchFailed: false })).toBe(true)
  })

  it('일시 장애는 noindex 로 굳히지 않는다 (fail-open)', () => {
    expect(isListingDocumentIndexable({ itemCount: 0, fetchFailed: true })).toBe(true)
  })

  it('랭킹 페이지가 이 판정을 실제로 쓴다', () => {
    expect(auctionRanking).toContain("import { isListingDocumentIndexable } from '~/utils/indexability'")
    expect(auctionRanking).toMatch(/isListingDocumentIndexable\(\{\s*itemCount: rows\.value\?\.length/)
  })

  it('noindex 일 때 canonical 을 함께 내보내지 않는다', () => {
    const headStart = auctionRanking.indexOf('useHead(')
    const head = auctionRanking.slice(headStart)
    expect(head).toMatch(/rankingIndexable[\s\S]{0,400}rel: 'canonical'/)
    expect(head).toContain("'noindex, follow'")
  })

  it('빈 결과와 백엔드 장애를 구분한다 (catch 로 뭉개지 않는다)', () => {
    expect(auctionRanking).toContain('markDegradedResponse')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 8. OG URL 길이가 제한되고 정상 응답한다  (리디렉션 3,193 · 크롤 예산)
// ─────────────────────────────────────────────────────────────────────────────
describe('8. og:image URL 은 리다이렉트하지 않고 길이가 제한된다', () => {
  const LONG_KOREAN_LABEL =
    '제주특별자치도 서귀포시 서귀동 318-17번지 일원 및 인근 부속토지 전체와 그 지상 건축물 일체를 포함하는 매우 긴 이름'.repeat(3)

  it('좌표 없는 문서는 최종 도착지(정적 PNG)를 직접 쓴다 — /og? 302 를 만들지 않는다', () => {
    const url = staticOgImageUrl()
    expect(isRedirectingOgUrl(url)).toBe(false)
    expect(url).toBe('https://ilsangkit.co.kr/og-image.png')
  })

  it('좌표가 없거나 유효하지 않으면 정적 PNG 로 떨어진다', () => {
    expect(buildOgMapImageUrl({ lat: null, lng: 127.0 })).toBe('https://ilsangkit.co.kr/og-image.png')
    expect(buildOgMapImageUrl({ lat: 37.5, lng: undefined })).toBe('https://ilsangkit.co.kr/og-image.png')
    expect(buildOgMapImageUrl({ lat: Number.NaN, lng: 127.0 })).toBe('https://ilsangkit.co.kr/og-image.png')
  })

  it('아주 긴 한글 라벨을 줘도 상한을 넘지 않는다', () => {
    const url = buildOgMapImageUrl({
      lat: 38.1897803,
      lng: 128.5427273,
      label: LONG_KOREAN_LABEL,
      category: 'toilet',
    })
    expect(url.length).toBeLessThanOrEqual(OG_IMAGE_URL_MAX)
    expect(isRedirectingOgUrl(url)).toBe(false)
  })

  it('라벨을 라우트와 같은 상한(20자)으로 잘라 보낸다 — 서버가 버릴 바이트를 싣지 않는다', () => {
    const url = buildOgMapImageUrl({ lat: 37.5, lng: 127.0, label: LONG_KOREAN_LABEL })
    const label = new URL(url).searchParams.get('label')
    expect(label).not.toBeNull()
    expect(label!.length).toBeLessThanOrEqual(20)
  })

  it('title / city / district 를 싣지 않는다 (NCP 성공 경로가 읽지 않는 파라미터)', () => {
    const url = buildOgMapImageUrl({ lat: 37.5, lng: 127.0, label: '소나무주유소', category: 'toilet' })
    const params = new URL(url).searchParams
    expect(params.get('title')).toBeNull()
    expect(params.get('city')).toBeNull()
    expect(params.get('district')).toBeNull()
    expect([...params.keys()].sort()).toEqual(['category', 'label', 'lat', 'lng'])
  })

  it('좌표는 6자리로 반올림한다', () => {
    const url = buildOgMapImageUrl({ lat: 38.18978031234, lng: 128.54272739876 })
    const params = new URL(url).searchParams
    expect(params.get('lat')).toBe('38.18978')
    expect(params.get('lng')).toBe('128.542727')
  })

  it('앱 코드 어디에도 /og? 를 조립하는 곳이 없다', () => {
    const APP_DIRS = ['pages', 'composables', 'components', 'utils', 'layouts', 'plugins', 'middleware']
    const offenders: string[] = []

    const walk = (dir: string) => {
      let entries
      try {
        entries = readdirSync(dir, { withFileTypes: true })
      } catch {
        return
      }
      for (const entry of entries) {
        const full = resolve(dir, entry.name)
        if (entry.isDirectory()) {
          if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
          walk(full)
          continue
        }
        if (!/\.(ts|vue)$/.test(entry.name) || entry.name.endsWith('.test.ts')) continue
        // ogImageUrl.ts 는 이 금지 규칙을 정의하고(isRedirectingOgUrl) 폐기된 형태를
        // 주석으로 기록하는 파일이다. 스스로를 위반자로 세면 문서화를 막는다.
        if (entry.name === 'ogImageUrl.ts') continue
        const src = readFileSync(full, 'utf8')
        // 주석에서 이 결정을 설명하는 문장까지 잡으면 가드가 문서화를 막는다.
        // 실제 URL 조립(템플릿 리터럴/문자열 연결)만 매칭한다.
        if (/\$\{SITE_URL\}\/og\?|['"`]\/og\?[a-z]/.test(src)) {
          offenders.push(full.replace(`${frontendRoot}/`, ''))
        }
      }
    }
    for (const dir of APP_DIRS) walk(resolve(frontendRoot, dir))
    expect(offenders).toEqual([])
  })
})
