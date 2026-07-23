import { describe, it, expect } from 'vitest'
import { resolveRegionReorgRedirect, VALID_CITIES } from '../../server/middleware/redirects'
import {
  resolveRegionReorgCityRedirect,
  resolveIncheonReorgRedirect,
  CITY_SLUGS_SET,
} from '../../server/middleware/real-estate-redirect'

/**
 * Task A7 — 2026-07 전남광주통합특별시 정규화 301 로직(REGION_REORG_301 플래그, 기본 OFF) 단위 테스트.
 *
 * U1: 3가지 URL 형태 전부 커버해야 한다.
 *   1) 시설 지역:      /gwangju/{district}[/{category}] → resolveRegionReorgRedirect (redirects.ts)
 *   2) bare city hub:  /gwangju, /jeonnam                → resolveRegionReorgRedirect (redirects.ts)
 *   3) 부동산 NEW-format: /real-estate/{type}-{mode}/{city}/{district}[/{building}]
 *                                                          → resolveRegionReorgCityRedirect (real-estate-redirect.ts)
 *
 * 이 태스크는 로직만 심는다 — 플래그 OFF가 기본이라 실제 URL/데이터는 바뀌지 않는다.
 */

describe('resolveRegionReorgRedirect — 시설 지역 + bare city hub', () => {
  describe('flag ON', () => {
    it('bare city hub: /gwangju → /jeonnamgwangju', () => {
      expect(resolveRegionReorgRedirect('/gwangju', '', true)).toEqual({ target: '/jeonnamgwangju' })
    })

    it('bare city hub: /jeonnam → /jeonnamgwangju', () => {
      expect(resolveRegionReorgRedirect('/jeonnam', '', true)).toEqual({ target: '/jeonnamgwangju' })
    })

    it('bare city hub — query string 을 보존한다', () => {
      expect(resolveRegionReorgRedirect('/gwangju', '?tab=map', true)).toEqual({
        target: '/jeonnamgwangju?tab=map',
      })
    })

    it('시설 지역(구·군만): /jeonnam/영광군 → district 불변', () => {
      expect(resolveRegionReorgRedirect('/jeonnam/영광군', '', true)).toEqual({
        target: '/jeonnamgwangju/영광군',
      })
    })

    it('시설 지역(구·군+카테고리): /gwangju/서구/toilet → district·category 불변', () => {
      expect(resolveRegionReorgRedirect('/gwangju/서구/toilet', '', true)).toEqual({
        target: '/jeonnamgwangju/서구/toilet',
      })
    })

    it('추가 세그먼트가 있어도 전부 보존한다', () => {
      expect(resolveRegionReorgRedirect('/gwangju/서구/toilet/123', '', true)).toEqual({
        target: '/jeonnamgwangju/서구/toilet/123',
      })
    })

    it('jeonnamgwangju 요청은 이미 신규 slug — 통과(null)', () => {
      expect(resolveRegionReorgRedirect('/jeonnamgwangju', '', true)).toBeNull()
      expect(resolveRegionReorgRedirect('/jeonnamgwangju/서구/toilet', '', true)).toBeNull()
    })

    it('대상 외 city 는 통과(null)', () => {
      expect(resolveRegionReorgRedirect('/seoul/gangnam', '', true)).toBeNull()
      expect(resolveRegionReorgRedirect('/gyeonggi/hwaseong-si', '', true)).toBeNull()
    })

    it('부동산 경로(/real-estate/**)는 이 함수가 다루지 않는다(segments[0] !== gwangju/jeonnam)', () => {
      expect(resolveRegionReorgRedirect('/real-estate/apt-sale/gwangju/서구/bldg', '', true)).toBeNull()
    })
  })

  describe('flag OFF', () => {
    it('bare city hub — 301 안 됨(null)', () => {
      expect(resolveRegionReorgRedirect('/gwangju', '', false)).toBeNull()
      expect(resolveRegionReorgRedirect('/jeonnam', '', false)).toBeNull()
    })

    it('시설 지역 — 301 안 됨(null)', () => {
      expect(resolveRegionReorgRedirect('/jeonnam/영광군', '', false)).toBeNull()
      expect(resolveRegionReorgRedirect('/gwangju/서구/toilet', '', false)).toBeNull()
    })
  })
})

describe('VALID_CITIES — jeonnamgwangju 수용', () => {
  it('jeonnamgwangju 를 포함한다', () => {
    expect(VALID_CITIES.has('jeonnamgwangju')).toBe(true)
  })

  it('기존 gwangju/jeonnam 도 계속 유지한다(구 URL suffix 리다이렉트 무회귀)', () => {
    expect(VALID_CITIES.has('gwangju')).toBe(true)
    expect(VALID_CITIES.has('jeonnam')).toBe(true)
  })
})

describe('resolveRegionReorgCityRedirect — 부동산 NEW-format', () => {
  describe('flag ON', () => {
    it('NEW_HUB(4세그): /real-estate/apt-sale/gwangju/서구 → city 만 치환', () => {
      expect(resolveRegionReorgCityRedirect('/real-estate/apt-sale/gwangju/서구', true)).toBe(
        '/real-estate/apt-sale/jeonnamgwangju/서구',
      )
    })

    it('NEW_DETAIL(5세그): district·building byte-match 로 불변', () => {
      expect(
        resolveRegionReorgCityRedirect('/real-estate/apt-sale/gwangju/서구/래미안강남', true),
      ).toBe('/real-estate/apt-sale/jeonnamgwangju/서구/래미안강남')
    })

    it('jeonnam 도 동일하게 치환된다', () => {
      expect(
        resolveRegionReorgCityRedirect('/real-estate/villa-rent/jeonnam/영광군/건물', true),
      ).toBe('/real-estate/villa-rent/jeonnamgwangju/영광군/건물')
    })

    it('6종 type-mode 조합 전부 처리한다', () => {
      const combos = ['apt-sale', 'apt-rent', 'villa-sale', 'villa-rent', 'offitel-sale', 'offitel-rent']
      for (const tm of combos) {
        expect(resolveRegionReorgCityRedirect(`/real-estate/${tm}/gwangju/서구`, true)).toBe(
          `/real-estate/${tm}/jeonnamgwangju/서구`,
        )
      }
    })

    it('jeonnamgwangju 요청은 이미 신규 slug — 통과(null)', () => {
      expect(resolveRegionReorgCityRedirect('/real-estate/apt-sale/jeonnamgwangju/서구', true)).toBeNull()
    })

    it('legacy 3세그(city 세그먼트 없음)는 다루지 않는다(len<5)', () => {
      expect(resolveRegionReorgCityRedirect('/real-estate/apt-sale/gwangju', true)).toBeNull()
    })

    it('type-mode 형식이 아닌 세그먼트는 매치하지 않는다', () => {
      expect(resolveRegionReorgCityRedirect('/real-estate/apt/gwangju/서구', true)).toBeNull()
    })

    it('대상 외 city 는 통과(null)', () => {
      expect(resolveRegionReorgCityRedirect('/real-estate/apt-sale/seoul/gangnam', true)).toBeNull()
    })
  })

  describe('flag OFF', () => {
    it('NEW_HUB/NEW_DETAIL 모두 301 안 됨(null)', () => {
      expect(resolveRegionReorgCityRedirect('/real-estate/apt-sale/gwangju/서구', false)).toBeNull()
      expect(resolveRegionReorgCityRedirect('/real-estate/apt-sale/gwangju/서구/bldg', false)).toBeNull()
    })
  })
})

describe('CITY_SLUGS_SET — jeonnamgwangju 수용(A4 pass-through)', () => {
  it('jeonnamgwangju 를 포함한다', () => {
    expect(CITY_SLUGS_SET.has('jeonnamgwangju')).toBe(true)
  })
})

describe('resolveIncheonReorgRedirect — 인천 개편 소멸구(서구/중구/동구) → 신설구', () => {
  const mkFetcher = (items: Array<{ district: string; buildingName: string }>) =>
    async () => ({ success: true, data: { items } })

  it('구 허브(단지 없음): /incheon/seo → 시 허브', async () => {
    expect(await resolveIncheonReorgRedirect('/real-estate/apt-sale/incheon/seo', mkFetcher([])))
      .toEqual({ redirect: '/real-estate/apt-sale/incheon' })
  })

  it('jung/dong 허브도 시 허브로', async () => {
    expect(await resolveIncheonReorgRedirect('/real-estate/villa-rent/incheon/jung', mkFetcher([])))
      .toEqual({ redirect: '/real-estate/villa-rent/incheon' })
    expect(await resolveIncheonReorgRedirect('/real-estate/offitel-sale/incheon/dong', mkFetcher([])))
      .toEqual({ redirect: '/real-estate/offitel-sale/incheon' })
  })

  it('단지 상세: 서구 청라단지 → 현행 서해구', async () => {
    expect(await resolveIncheonReorgRedirect(
      '/real-estate/apt-sale/incheon/seo/청라제일풍경채2차에듀앤파크',
      mkFetcher([{ district: '서해구', buildingName: '청라제일풍경채2차에듀앤파크' }]),
    )).toEqual({ redirect: '/real-estate/apt-sale/incheon/seohae/청라제일풍경채2차에듀앤파크' })
  })

  it('단지 상세: 서구 검단단지 → 현행 검단구', async () => {
    expect(await resolveIncheonReorgRedirect(
      '/real-estate/apt-sale/incheon/seo/당하푸르지오',
      mkFetcher([{ district: '검단구', buildingName: '당하푸르지오' }]),
    )).toEqual({ redirect: '/real-estate/apt-sale/incheon/geomdan/당하푸르지오' })
  })

  it('현행 구 결과 없으면 notFound', async () => {
    expect(await resolveIncheonReorgRedirect('/real-estate/apt-sale/incheon/seo/사라진단지', mkFetcher([])))
      .toEqual({ notFound: true })
  })

  it('옛 소멸구 결과만 있고 현행구 없으면 notFound(과도기 오배송 방지)', async () => {
    expect(await resolveIncheonReorgRedirect(
      '/real-estate/apt-sale/incheon/seo/xx',
      mkFetcher([{ district: '서구', buildingName: 'xx' }]),
    )).toEqual({ notFound: true })
  })

  it('현행 구 slug(seohae 등)·비인천·legacy형은 통과(null)', async () => {
    expect(await resolveIncheonReorgRedirect('/real-estate/apt-sale/incheon/seohae/x', mkFetcher([]))).toBeNull()
    expect(await resolveIncheonReorgRedirect('/real-estate/apt-sale/incheon/yeonsu', mkFetcher([]))).toBeNull()
    expect(await resolveIncheonReorgRedirect('/real-estate/apt-sale/busan/seo/x', mkFetcher([]))).toBeNull()
    expect(await resolveIncheonReorgRedirect('/real-estate/apt/incheon/seo/x', mkFetcher([]))).toBeNull()
  })
})
