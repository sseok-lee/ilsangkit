/**
 * og:image 를 실제로 발행하는 쪽(emitter)들의 회귀 가드.
 *
 * 배경(2026-09-04 네이버 진단): 리디렉션 3,193건은 페이지들이 og:image 로 `/og?…` 를 쓴 결과다.
 * 그 라우트는 SVG→PNG 변환에 sharp 를 쓰는데 Cafe24 에 네이티브 바인딩이 없어 프로덕션에서
 * 100% `/og-image.png` 로 302 한다 — 즉 페이지마다 고유한 영구 리다이렉트 URL 을 하나씩
 * 발행해 온 셈이다. 같은 시기 `/og-map?…` 은 시설명을 label 과 title 에 두 번, 자르지도 않고
 * 실어 실측 2,004자짜리 URL 을 만들었다(라우트는 title 을 읽지도 않는다).
 *
 * 두 결함 모두 "각 페이지가 템플릿 문자열로 URL 을 조립한다"는 한 가지 원인에서 나왔으므로,
 * 여기서는 (1) 조립을 공용 빌더에 위임했는지 소스로 확인하고 (2) 실제 발행값이 리다이렉트가
 * 아니고 길이 상한 안인지 행동으로 확인한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const mockUseSeoMeta = vi.fn()
const mockUseHead = vi.fn()
vi.stubGlobal('useSeoMeta', mockUseSeoMeta)
vi.stubGlobal('useHead', mockUseHead)

import { isRedirectingOgUrl, OG_IMAGE_URL_MAX, staticOgImageUrl } from '~/utils/ogImageUrl'
import { OG_MAP_LABEL_MAX } from '~/utils/ogMapSpec'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { computeAuctionItemHead } from '~/utils/auctionHead'
import type { FacilityDetail } from '~/types/facility'
import type { AuctionItem } from '~/types/auction'

/** 한글은 percent-encoding 에서 3배로 부푼다 — 최악의 라벨을 실측 상한(370자)으로 잡는다. */
const WORST_CASE_KOREAN_LABEL = '서울특별시강남구역삼동자동심장충격기설치건물본관지하주차장'.repeat(13).slice(0, 370)

// vitest 는 frontend/ 에서 돌지만, 루트에서 호출될 때도 있어 nitroCacheBound.test.ts 와 같은 보정.
const FRONTEND_ROOT = process.cwd().endsWith('/frontend') ? process.cwd() : join(process.cwd(), 'frontend')

function repoFile(relative: string): string {
  return readFileSync(resolve(FRONTEND_ROOT, relative), 'utf-8')
}

/**
 * 주석은 사건 기록으로 `/og?` 를 그대로 인용한다(왜 금지인지 설명해야 하니까).
 * 코드만 검사하도록 주석을 걷어낸다. `://` 는 URL 이므로 줄 주석으로 보지 않는다.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

// og:image 를 발행하는 파일들. 여기 있는 파일은 URL 을 직접 조립하면 안 된다.
const OG_EMITTER_FILES = [
  'composables/useFacilityMeta.ts',
  'utils/auctionHead.ts',
  'pages/subway/[slug].vue',
  'pages/subscription/[id].vue',
]

describe('og:image emitter — 소스 계약', () => {
  it.each(OG_EMITTER_FILES)('%s 는 `/og?` URL 을 조립하지 않는다', (relative) => {
    expect(stripComments(repoFile(relative))).not.toContain('/og?')
  })

  it.each(OG_EMITTER_FILES)('%s 는 `/og-map?` 를 손으로 조립하지 않고 공용 빌더를 쓴다', (relative) => {
    const source = repoFile(relative)
    expect(stripComments(source)).not.toContain('/og-map?')
    expect(source).toContain("from '~/utils/ogImageUrl'")
  })
})

describe('og:image emitter — 발행값', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function facility(over: Partial<FacilityDetail> = {}): FacilityDetail {
    return {
      id: 'og-1',
      category: 'aed',
      name: WORST_CASE_KOREAN_LABEL,
      address: '서울특별시 강남구 역삼동 1',
      roadAddress: '서울특별시 강남구 테헤란로 1',
      lat: 37.4979123456789,
      lng: 127.0276123456789,
      city: '서울특별시',
      district: '강남구',
      bjdCode: '11680',
      details: { buildPlace: '본관 1층 로비' },
      sourceId: 'og-src-1',
      sourceUrl: null,
      viewCount: 0,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      syncedAt: '2024-01-01T00:00:00Z',
      ...over,
    } as FacilityDetail
  }

  const lastOgImage = () => (mockUseSeoMeta.mock.calls.at(-1)![0] as { ogImage: string }).ogImage

  it('시설 상세: 370자 한글 이름이어도 og:image 가 리다이렉트가 아니고 상한 안이다', () => {
    const { setFacilityDetailMeta } = useFacilityMeta()
    setFacilityDetailMeta(facility())

    const url = lastOgImage()
    expect(isRedirectingOgUrl(url)).toBe(false)
    expect(url.length).toBeLessThanOrEqual(OG_IMAGE_URL_MAX)
    // 라벨은 라우트(sanitizeLabel)와 같은 상한으로 잘려서 실린다 — 잘려나갈 바이트를
    // 크롤러가 실어나르지 않게 하는 게 이 상한의 목적이다.
    expect(decodeURIComponent(new URL(url).searchParams.get('label') ?? '').length)
      .toBeLessThanOrEqual(OG_MAP_LABEL_MAX)
  })

  it('시설 상세: 좌표가 없으면 정적 대표 PNG 로 떨어진다(302 URL 아님)', () => {
    const { setFacilityDetailMeta } = useFacilityMeta()
    setFacilityDetailMeta(facility({ lat: null, lng: null }))

    const url = lastOgImage()
    expect(url).toBe(staticOgImageUrl())
    expect(isRedirectingOgUrl(url)).toBe(false)
  })

  // ★ 위 테스트는 프로덕션에 존재하지 않는 상태(lat/lng = null)를 단언해 왔다.
  // 백엔드 toDetail 은 `lat: Number(record.lat)` 이고 Number(null) === 0 이라, 좌표가 없는 행은
  // 프론트에 0 으로 도착한다. 실측 2026-09-04: 로컬 DB 기준 좌표 없는 색인 대상 행 7,591개
  // (의류수거함 918·주차장 1,954·학교 1,140·어린이집 2,511·도서관 177·체육시설 891).
  // 프로덕션 확인: /og-map?lat=0&lng=0 → 200 image/svg+xml (정상 좌표는 image/jpeg).
  // 네이버 크롤러는 SVG 를 렌더하지 않는다(규칙 #441) — 즉 이 7,591 페이지의 썸네일이 죽는다.
  it('시설 상세: 백엔드가 좌표 없음을 0 으로 직렬화해도 정적 PNG 로 떨어진다', () => {
    const { setFacilityDetailMeta } = useFacilityMeta()
    setFacilityDetailMeta(facility({ lat: 0, lng: 0 }))

    const url = lastOgImage()
    expect(url).toBe(staticOgImageUrl())

    // 부수 효과까지 고정한다. 정적 PNG 로 떨어지면 치수 선언도 실제 파일 규격(1200x630)이어야
    // 한다. 좌표 0 을 유효로 통과시키던 동안에는 og-map 규격(1024x536)이 선언돼 있었다.
    const call = mockUseSeoMeta.mock.calls.at(-1)![0] as { ogImageWidth?: number; ogImageHeight?: number }
    expect(call.ogImageWidth).toBe(1200)
    expect(call.ogImageHeight).toBe(630)
  })

  // /og-map 라우트는 한국 범위(lat 33~39, lng 124~131) 밖이면 inlineFallback 으로 떨어지고,
  // Cafe24 에는 sharp 가 없어 그 폴백이 SVG 로 나간다. 생성기가 같은 범위를 보지 않으면
  // "라우트는 못 그리는데 메타는 가리키는" URL 을 계속 발행하게 된다.
  it.each([
    ['위도만 0', 0, 127.0],
    ['경도만 0', 37.5, 0],
    ['국외 좌표(런던)', 51.5074, -0.1278],
    ['위도 범위 밖', 32.9, 127.0],
    ['경도 범위 밖', 37.5, 131.1],
  ])('시설 상세: 한국 좌표 범위 밖이면 정적 PNG 로 떨어진다 — %s', (_label, lat, lng) => {
    const { setFacilityDetailMeta } = useFacilityMeta()
    setFacilityDetailMeta(facility({ lat, lng }))

    expect(lastOgImage()).toBe(staticOgImageUrl())
  })

  it('시설 상세: 한국 범위 안 좌표는 그대로 /og-map 을 쓴다(과교정 방지)', () => {
    const { setFacilityDetailMeta } = useFacilityMeta()
    setFacilityDetailMeta(facility({ lat: 33.4996, lng: 126.5312 }))

    const url = lastOgImage()
    expect(url).toContain('/og-map?')
    expect(url).not.toBe(staticOgImageUrl())
  })

  it('시설 상세: og:image 와 twitter:image 가 같은 값이다', () => {
    const { setFacilityDetailMeta } = useFacilityMeta()
    setFacilityDetailMeta(facility())

    const call = mockUseSeoMeta.mock.calls.at(-1)![0] as { ogImage: string; twitterImage: string }
    expect(call.twitterImage).toBe(call.ogImage)
  })

  // 공매 og:image 는 title 을 라벨로 쓴다 — 제목이 주소로 조립되므로 주소를 최악 길이로 준다.
  function auctionItem(over: Partial<AuctionItem> = {}): AuctionItem {
    return {
      cltrMngNo: '1',
      address: WORST_CASE_KOREAN_LABEL,
      usage: '오피스텔',
      status: 'ongoing',
      apslAssAmt: 1_200_000_000,
      minBidPrc: 840_000_000,
      lat: 37.4979123456789,
      lng: 127.0276123456789,
      ...over,
    } as AuctionItem
  }

  const auctionOgImage = (item: AuctionItem) =>
    computeAuctionItemHead(item, 'https://ilsangkit.co.kr/auction/item/1')

  it('공매 물건: 370자 한글 제목이어도 og:image 가 리다이렉트가 아니고 상한 안이다', () => {
    const head = auctionOgImage(auctionItem())
    const ogImage = head.meta.find((m) => m.property === 'og:image')?.content ?? ''

    expect(ogImage).toBeTruthy()
    expect(isRedirectingOgUrl(ogImage)).toBe(false)
    expect(ogImage.length).toBeLessThanOrEqual(OG_IMAGE_URL_MAX)
  })

  it('공매 물건: 좌표가 없으면 정적 대표 PNG + 1200x630 을 선언한다', () => {
    const head = auctionOgImage(auctionItem({ lat: null, lng: null }))
    const ogImage = head.meta.find((m) => m.property === 'og:image')?.content
    // 폴백인데 og-map 규격(1024x536)을 선언하면 소셜 카드가 다른 비율의 이미지를 받는다.
    expect(ogImage).toBe(staticOgImageUrl())
    expect(head.meta.find((m) => m.property === 'og:image:width')?.content).toBe('1200')
    expect(head.meta.find((m) => m.property === 'og:image:height')?.content).toBe('630')
  })

  it('공매 물건: 좌표가 있으면 og-map 규격(1024x536)을 선언한다', () => {
    const head = auctionOgImage(auctionItem())
    expect(head.meta.find((m) => m.property === 'og:image:width')?.content).toBe('1024')
    expect(head.meta.find((m) => m.property === 'og:image:height')?.content).toBe('536')
  })
})
