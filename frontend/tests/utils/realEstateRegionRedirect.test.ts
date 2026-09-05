import { describe, expect, it } from 'vitest'
import {
  isRegionMismatch,
  buildCanonicalRealEstatePath,
  resolveRegionRedirectPath,
} from '~/utils/realEstateRegion'

/**
 * 지역 불일치 통합(301)의 계약 테스트.
 *
 * 실측(2026-09-04 프로덕션): /real-estate/villa-sale/{seoul/gangnam, busan/haeundae,
 * daegu/suseong}/현대 세 URL 이 전부 200·index·self-canonical 로 "제주 서귀포시 현대" 를
 * 렌더했다. 흔한 건물명 하나가 (구·군 250 × 타입 6) 만큼의 동일 title 문서를 발행하는 구조였다.
 *
 * 여기서 지키는 것은 두 가지다.
 *  (1) 불일치는 실제 지역 URL 로 합친다 — 404 로 죽이지 않는다.
 *  (2) 어떤 경우에도 루프나 "미들웨어가 다시 301 하는 목적지"를 만들지 않는다.
 */

const HYUNDAI = '현대'

describe('isRegionMismatch — URL 지역 vs 실제 건물 지역', () => {
  it('요청 지역과 실제 지역이 같으면 불일치가 아니다', () => {
    expect(isRegionMismatch({
      requestedCitySlug: 'busan',
      requestedDistrictSlug: 'haeundae',
      actualCity: '부산광역시',
      actualDistrict: '해운대구',
    })).toBe(false)
  })

  it('시/도가 다르면 불일치다', () => {
    expect(isRegionMismatch({
      requestedCitySlug: 'seoul',
      requestedDistrictSlug: 'gangnam',
      actualCity: '제주특별자치도',
      actualDistrict: '서귀포시',
    })).toBe(true)
  })

  it('시/도는 같고 구·군이 다르면 불일치다', () => {
    expect(isRegionMismatch({
      requestedCitySlug: 'seoul',
      requestedDistrictSlug: 'gangnam',
      actualCity: '서울특별시',
      actualDistrict: '노원구',
    })).toBe(true)
  })

  it('실제 지역명을 slug 로 되돌릴 수 없으면 불일치로 단정하지 않는다 (근거 없는 301 금지)', () => {
    expect(isRegionMismatch({
      requestedCitySlug: 'seoul',
      requestedDistrictSlug: 'gangnam',
      actualCity: '없는시도',
      actualDistrict: '없는구',
    })).toBe(false)
  })

  it('통합 전 표기(광주광역시·전라남도)는 jeonnamgwangju 와 같은 지역으로 본다', () => {
    // DB 가 아직 옛 표기를 들고 있어도 통합 후 정규 URL 은 jeonnamgwangju 다.
    // 여기서 불일치로 보면 legacy slug 로 301 → 미들웨어가 다시 301 → 무한 루프.
    expect(isRegionMismatch({
      requestedCitySlug: 'jeonnamgwangju',
      requestedDistrictSlug: 'suncheon',
      actualCity: '전라남도',
      actualDistrict: '순천시',
    })).toBe(false)

    expect(isRegionMismatch({
      requestedCitySlug: 'jeonnamgwangju',
      requestedDistrictSlug: 'buk',
      actualCity: '광주광역시',
      actualDistrict: '북구',
    })).toBe(false)
  })
})

describe('buildCanonicalRealEstatePath — 합칠 목적지', () => {
  it('실제 지역 기준의 정규 경로를 만든다', () => {
    expect(buildCanonicalRealEstatePath({
      type: 'villa-sale',
      buildingName: HYUNDAI,
      actualCity: '제주특별자치도',
      actualDistrict: '서귀포시',
    })).toBe(`/real-estate/villa-sale/jeju/seogwipo/${encodeURIComponent(HYUNDAI)}`)
  })

  it('slug 로 되돌릴 수 없는 지역이면 null (잘못된 목적지로 보내지 않는다)', () => {
    expect(buildCanonicalRealEstatePath({
      type: 'apt-sale',
      buildingName: HYUNDAI,
      actualCity: '없는시도',
      actualDistrict: '없는구',
    })).toBeNull()
  })
})

describe('resolveRegionRedirectPath — 301 목적지 결정', () => {
  const base = {
    type: 'villa-sale' as const,
    buildingName: HYUNDAI,
    actualCity: '제주특별자치도',
    actualDistrict: '서귀포시',
  }

  it('프로덕션에서 관측된 세 URL 이 모두 같은 한 곳으로 합쳐진다', () => {
    const targets = [
      { requestedCitySlug: 'seoul', requestedDistrictSlug: 'gangnam' },
      { requestedCitySlug: 'busan', requestedDistrictSlug: 'haeundae' },
      { requestedCitySlug: 'daegu', requestedDistrictSlug: 'suseong' },
    ].map(req => resolveRegionRedirectPath({
      ...base,
      ...req,
      currentPath: `/real-estate/villa-sale/${req.requestedCitySlug}/${req.requestedDistrictSlug}/${encodeURIComponent(HYUNDAI)}`,
    }))

    expect(new Set(targets).size).toBe(1)
    expect(targets[0]).toBe(`/real-estate/villa-sale/jeju/seogwipo/${encodeURIComponent(HYUNDAI)}`)
  })

  it('목적지가 현재 경로와 같으면 리다이렉트하지 않는다 (루프 방지)', () => {
    expect(resolveRegionRedirectPath({
      ...base,
      requestedCitySlug: 'jeju',
      requestedDistrictSlug: 'seogwipo',
      currentPath: `/real-estate/villa-sale/jeju/seogwipo/${encodeURIComponent(HYUNDAI)}`,
    })).toBeNull()
  })

  it('지역이 일치하면 리다이렉트하지 않는다', () => {
    expect(resolveRegionRedirectPath({
      type: 'apt-sale',
      buildingName: HYUNDAI,
      actualCity: '부산광역시',
      actualDistrict: '해운대구',
      requestedCitySlug: 'busan',
      requestedDistrictSlug: 'haeundae',
      currentPath: `/real-estate/apt-sale/busan/haeundae/${encodeURIComponent(HYUNDAI)}`,
    })).toBeNull()
  })

  it('미들웨어가 다시 301 하는 목적지로는 보내지 않는다 — 통합 전 광주/전남 slug', () => {
    // REGION_REORG_301=1 이면 /real-estate/{type}/gwangju/… 는 서버가 jeonnamgwangju 로 301 한다.
    // 여기서 그 경로를 목적지로 삼으면 301 → 301 → … 무한 루프.
    expect(resolveRegionRedirectPath({
      type: 'apt-sale',
      buildingName: HYUNDAI,
      actualCity: '광주광역시',
      actualDistrict: '북구',
      requestedCitySlug: 'seoul',
      requestedDistrictSlug: 'gangnam',
      currentPath: `/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent(HYUNDAI)}`,
    })).toBeNull()

    expect(resolveRegionRedirectPath({
      type: 'apt-sale',
      buildingName: HYUNDAI,
      actualCity: '전라남도',
      actualDistrict: '순천시',
      requestedCitySlug: 'seoul',
      requestedDistrictSlug: 'gangnam',
      currentPath: `/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent(HYUNDAI)}`,
    })).toBeNull()
  })

  it('미들웨어가 다시 301 하는 목적지로는 보내지 않는다 — 인천 소멸구(1:N 분리라 목적지 계산 불가)', () => {
    for (const district of ['서구', '중구', '동구']) {
      expect(resolveRegionRedirectPath({
        type: 'apt-sale',
        buildingName: HYUNDAI,
        actualCity: '인천광역시',
        actualDistrict: district,
        requestedCitySlug: 'seoul',
        requestedDistrictSlug: 'gangnam',
        currentPath: `/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent(HYUNDAI)}`,
      })).toBeNull()
    }
  })

  it('인천 신설구는 정상적으로 목적지가 된다', () => {
    expect(resolveRegionRedirectPath({
      type: 'apt-sale',
      buildingName: HYUNDAI,
      actualCity: '인천광역시',
      actualDistrict: '연수구',
      requestedCitySlug: 'seoul',
      requestedDistrictSlug: 'gangnam',
      currentPath: `/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent(HYUNDAI)}`,
    })).toBe(`/real-estate/apt-sale/incheon/yeonsu/${encodeURIComponent(HYUNDAI)}`)
  })

  it('301 목적지는 한 번 더 통과시켜도 다시 리다이렉트되지 않는다 (2홉 방지)', () => {
    const first = resolveRegionRedirectPath({
      ...base,
      requestedCitySlug: 'seoul',
      requestedDistrictSlug: 'gangnam',
      currentPath: `/real-estate/villa-sale/seoul/gangnam/${encodeURIComponent(HYUNDAI)}`,
    })
    expect(first).not.toBeNull()

    const [, , , citySlug, districtSlug] = first!.split('/')
    const second = resolveRegionRedirectPath({
      ...base,
      requestedCitySlug: citySlug,
      requestedDistrictSlug: districtSlug,
      currentPath: first!,
    })
    expect(second).toBeNull()
  })
})
