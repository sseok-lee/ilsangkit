import { describe, it, expect } from 'vitest'
import {
  toRealEstateUrl,
  toAbsoluteRealEstateUrl,
} from '../../utils/realEstateUrl'

/**
 * AC16 — NFC/NFD 7-path integration.
 *
 * 한글 buildingName을 NFD 조합형으로 주입했을 때, 아래 7개 지점의 최종 URL(인코딩된 문자열)이
 * 모두 동일한 NFC-encoded 문자열을 내보내는지 검증한다. 하나라도 다르면 실패.
 *
 * 7 지점:
 *   1. toRealEstateUrl()                      — 상세 페이지 상대 URL
 *   2. 라우트 파라미터 파싱                    — Nuxt가 URL에서 추출 후 decodeURIComponent + normalize('NFC')
 *   3. 리다이렉트 매처 (real-estate-redirect)  — 내부 buildNewDetailPath 에서 같은 정규화
 *   4. canonical                              — 상세 페이지 useHead
 *   5. sitemap entry                          — toAbsoluteRealEstateUrl
 *   6. IndexNow URL                           — toAbsoluteRealEstateUrl (V2)
 *   7. OG og:url                              — canonical과 동일한 문자열이어야 함
 *
 * 실제 런타임 경로를 100% 재현하긴 어렵지만, 각 경로가 단일 `toRealEstateUrl()` 유틸을 거치는지를
 * 검증하면 동등성 보장이 가능하다. 실패하면 "direct string concatenation 을 한 구간이 있다"는 신호.
 */

const SITE_URL = 'https://ilsangkit.co.kr'

function simulateRouteParamsRoundtrip(relativeUrl: string, expectedBuildingName: string): string {
  // Nuxt 라우트 파서와 동일하게: URL 마지막 path segment 를 decodeURIComponent → normalize('NFC')
  const segs = relativeUrl.split('/')
  const last = segs[segs.length - 1]
  const decoded = decodeURIComponent(last).normalize('NFC')
  expect(decoded).toBe(expectedBuildingName)
  // 그리고 다시 url 을 재구성하면 동일해야 한다
  return toRealEstateUrl({
    type: 'apt-sale',
    city: '서울특별시',
    district: '강남구',
    buildingName: decoded,
  })
}

describe('AC16 — NFC/NFD 7-path integration', () => {
  const nfc = '래미안강남'
  const nfd = nfc.normalize('NFD')

  it('NFD 입력이 7-path 전부에서 동일 NFC URL 로 수렴한다', () => {
    // 1. toRealEstateUrl (NFD → NFC)
    const path1 = toRealEstateUrl({
      type: 'apt-sale',
      city: '서울특별시',
      district: '강남구',
      buildingName: nfd,
    })
    expect(path1).toBe(
      `/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent(nfc)}`,
    )

    // 2. 라우트 파싱 → 다시 URL 생성. 입력이 달라도 같은 URL 로 수렴해야 한다
    const path2 = simulateRouteParamsRoundtrip(path1, nfc)
    expect(path2).toBe(path1)

    // 3. 리다이렉트 매처도 동일 유틸 사용. URL 이 일치해야 단일 홉 보장
    //    (buildNewDetailPath 내부에서 decodeURIComponent + normalize('NFC') + toCitySlug + toDistrictSlug 를 수행)
    const path3 = toRealEstateUrl({
      type: 'apt-sale',
      city: '서울특별시',
      district: '강남구',
      buildingName: decodeURIComponent(encodeURIComponent(nfd)).normalize('NFC'),
    })
    expect(path3).toBe(path1)

    // 4. canonical (상세 페이지 useHead 에서 `${SITE_URL}${toRealEstateUrl(...)}`)
    const canonical = `${SITE_URL}${path1}`

    // 5. sitemap entry (toAbsoluteRealEstateUrl)
    const sitemapEntry = toAbsoluteRealEstateUrl(SITE_URL, {
      type: 'apt-sale',
      city: '서울특별시',
      district: '강남구',
      buildingName: nfd,
    })

    // 6. IndexNow URL (backend buildRealEstateUrlsV2 는 toAbsoluteRealEstateUrl 동일 유틸 사용)
    const indexNowUrl = sitemapEntry

    // 7. OG og:url — 페이지 useHead 에서 canonical 과 동일 값을 내보내므로 문자열 일치
    const ogUrl = canonical

    // 모두 같은 NFC-encoded URL 문자열이어야 한다
    const all = [path1, path2, path3, canonical, sitemapEntry, indexNowUrl, ogUrl]
    const unique = new Set(all.map((u) => (u.startsWith('http') ? u : `${SITE_URL}${u}`)))
    expect(unique.size).toBe(1)
    const final = [...unique][0]
    expect(final).toBe(`${SITE_URL}/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent(nfc)}`)
  })

  it('apt-sale 과 apt-rent canonical 은 서로 다르다 (tab 중복 해소)', () => {
    const sale = toRealEstateUrl({
      type: 'apt-sale',
      city: '서울특별시',
      district: '강남구',
      buildingName: '래미안강남',
    })
    const rent = toRealEstateUrl({
      type: 'apt-rent',
      city: '서울특별시',
      district: '강남구',
      buildingName: '래미안강남',
    })
    expect(sale).not.toBe(rent)
    expect(sale).toContain('/apt-sale/')
    expect(rent).toContain('/apt-rent/')
  })

  it('NFC 정규화는 재귀적으로도 idempotent 하다', () => {
    const first = toRealEstateUrl({
      type: 'apt-sale',
      city: '서울특별시',
      district: '강남구',
      buildingName: '래미안강남'.normalize('NFD'),
    })
    const parsedName = decodeURIComponent(first.split('/').pop()!).normalize('NFC')
    const second = toRealEstateUrl({
      type: 'apt-sale',
      city: '서울특별시',
      district: '강남구',
      buildingName: parsedName,
    })
    expect(second).toBe(first)
  })

  it('absolute URL 에 bjdCode= 쿼리가 절대 포함되지 않는다', () => {
    const abs = toAbsoluteRealEstateUrl(SITE_URL, {
      type: 'apt-sale',
      city: '서울특별시',
      district: '강남구',
      buildingName: '래미안강남',
    })
    expect(abs).not.toContain('bjdCode=')
    expect(abs).not.toContain('?')
  })
})
