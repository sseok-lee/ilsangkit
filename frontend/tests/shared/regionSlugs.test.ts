import { describe, it, expect } from 'vitest'
import {
  buildTrashRegionPath, CITY_SLUGS, CITY_SLUG_MAP, CITY_FULL_NAME_TO_SLUG, DISTRICT_SLUG_MAP, REGIONS,
  REAL_ESTATE_DISTRICT_SPLITS, REAL_ESTATE_REGIONS,
} from '~/shared/regionSlugs'

describe('전남광주통합특별시 slug/읽기맵 등록 (Task A4)', () => {
  it('CITY_SLUG_MAP[jeonnamgwangju]가 truthy여야 한다', () => {
    expect(CITY_SLUG_MAP['jeonnamgwangju']).toBeTruthy()
    expect(CITY_SLUG_MAP['jeonnamgwangju']).toBe('전남광주통합특별시')
  })

  it('CITY_SLUGS에 전남광주통합특별시 → jeonnamgwangju 등록', () => {
    expect(CITY_SLUGS['전남광주통합특별시']).toBe('jeonnamgwangju')
  })

  it('CITY_SLUGS 값 집합에 jeonnamgwangju 포함 (real-estate-redirect CITY_SLUGS_SET pass-through 소스)', () => {
    expect(Object.values(CITY_SLUGS)).toContain('jeonnamgwangju')
  })

  it('REGIONS[전남광주통합특별시]는 flat 27개(광주5구+전남22시군)여야 한다', () => {
    expect(REGIONS['전남광주통합특별시']).toHaveLength(27)
  })

  it('REGIONS[전남광주통합특별시]는 광주5구를 포함한다', () => {
    const districts = REGIONS['전남광주통합특별시']
    expect(districts).toEqual(
      expect.arrayContaining(['동구', '서구', '남구', '북구', '광산구']),
    )
  })

  it('REGIONS[전남광주통합특별시]는 전남22시군을 포함한다', () => {
    const districts = REGIONS['전남광주통합특별시']
    expect(districts).toEqual(
      expect.arrayContaining([
        '목포시', '여수시', '순천시', '나주시', '광양시',
        '담양군', '곡성군', '구례군', '고흥군', '보성군', '화순군', '장흥군', '강진군',
        '해남군', '영암군', '무안군', '함평군', '영광군', '장성군', '완도군', '진도군', '신안군',
      ]),
    )
  })

  it('REGIONS[전남광주통합특별시]는 서브그룹핑 없이 flat 배열(광주5구+전남22시군 정확히 일치)이어야 한다', () => {
    const expected = [
      '동구', '서구', '남구', '북구', '광산구',
      '목포시', '여수시', '순천시', '나주시', '광양시',
      '담양군', '곡성군', '구례군', '고흥군', '보성군', '화순군', '장흥군', '강진군',
      '해남군', '영암군', '무안군', '함평군', '영광군', '장성군', '완도군', '진도군', '신안군',
    ]
    expect(REGIONS['전남광주통합특별시']).toEqual(expected)
  })

  it('기존 gwangju(광주)/jeonnam(전남) 엔트리는 유지된다 (제거는 C1)', () => {
    expect(CITY_SLUGS['광주']).toBe('gwangju')
    expect(CITY_SLUGS['전남']).toBe('jeonnam')
    expect(REGIONS['광주']).toEqual(['동구', '서구', '남구', '북구', '광산구'])
    expect(REGIONS['전남']?.length).toBe(22)
  })

  it('CITY_FULL_NAME_TO_SLUG에 전남광주통합특별시 → jeonnamgwangju 등록', () => {
    expect(CITY_FULL_NAME_TO_SLUG['전남광주통합특별시']).toBe('jeonnamgwangju')
  })

  it('CITY_FULL_NAME_TO_SLUG 무관 지역(서울 등) 무회귀', () => {
    expect(CITY_FULL_NAME_TO_SLUG['서울특별시']).toBe('seoul')
    expect(CITY_FULL_NAME_TO_SLUG['전라남도']).toBe('jeonnam')
    expect(CITY_FULL_NAME_TO_SLUG['광주광역시']).toBe('gwangju')
  })

  it('suffix-strip 로직이 전남광주통합특별시를 자르지 않는다 (예외 처리) — 일반 로직은 잘라야 하는 대조군 포함', () => {
    const stripSuffix = (city: string): string =>
      city === '전남광주통합특별시'
        ? city
        : city.replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '')

    // 예외: 전남광주통합특별시는 그대로 보존 (안 그러면 '전남광주통합'으로 잘려 REGIONS 매칭 실패)
    expect(stripSuffix('전남광주통합특별시')).toBe('전남광주통합특별시')
    expect(REGIONS[stripSuffix('전남광주통합특별시')]).toBeDefined()
    expect(REGIONS[stripSuffix('전남광주통합특별시')]).toHaveLength(27)

    // 대조군: 다른 도시는 여전히 정상적으로 접미사가 잘려야 한다 (회귀 방지)
    expect(stripSuffix('서울특별시')).toBe('서울')
    expect(stripSuffix('경기도')).toBe('경기')
  })
})

describe('shared buildTrashRegionPath', () => {
  it('정식 도명 → 슬러그 (라이브 검증값)', () => {
    expect(buildTrashRegionPath('경기도', '가평군')).toBe('/gyeonggi/gapyeong/trash') // 2-A 라이브 확인값
    expect(buildTrashRegionPath('서울특별시', '강남구')).toBe('/seoul/gangnam/trash')
  })
  it('축약 도명', () => {
    expect(buildTrashRegionPath('서울', '강남구')).toBe('/seoul/gangnam/trash')
  })
  it('미해결 도시는 null', () => {
    expect(buildTrashRegionPath('없는도시', '강남구')).toBeNull()
  })
  it('정식 도명(충청북도) + 매핑된 district', () => {
    expect(buildTrashRegionPath('충청북도', '청주시')).toBe('/chungbuk/cheongju/trash')
  })
  it('정식 도명(경상북도) + 매핑된 district', () => {
    expect(buildTrashRegionPath('경상북도', '경주시')).toBe('/gyeongbuk/gyeongju/trash')
  })
})

describe('REAL_ESTATE_REGIONS — 부동산·토지 전용 구 단위 목록', () => {
  it('경기 부천시·화성시를 같은 자리에서 구 목록으로 치환한다(순서 유지)', () => {
    const gyeonggi = REAL_ESTATE_REGIONS['경기']
    const expected = REGIONS['경기'].flatMap((name) => REAL_ESTATE_DISTRICT_SPLITS['경기']?.[name] ?? [name])
    expect(gyeonggi).toEqual(expected)
    expect(gyeonggi).not.toContain('부천시')
    expect(gyeonggi).not.toContain('화성시')
    const bucheonAt = gyeonggi.indexOf('부천시 소사구')
    expect(gyeonggi.slice(bucheonAt - 1, bucheonAt + 4)).toEqual([
      '안양시 동안구', '부천시 소사구', '부천시 오정구', '부천시 원미구', '광명시',
    ])
    const hwaseongAt = gyeonggi.indexOf('화성시 동탄구')
    expect(gyeonggi.slice(hwaseongAt - 1, hwaseongAt + 5)).toEqual([
      '김포시', '화성시 동탄구', '화성시 만세구', '화성시 병점구', '화성시 효행구', '광주시',
    ])
  })

  it('치환 대상이 아닌 시/도는 REGIONS 와 같다', () => {
    expect(Object.keys(REAL_ESTATE_REGIONS)).toEqual(Object.keys(REGIONS))
    for (const city of Object.keys(REGIONS)) {
      if (city === '경기') continue
      expect(REAL_ESTATE_REGIONS[city]).toEqual(REGIONS[city])
    }
  })

  it('공용 REGIONS 는 시설용 시 단위 그대로 둔다', () => {
    expect(REGIONS['경기']).toContain('부천시')
    expect(REGIONS['경기']).toContain('화성시')
  })

  it('치환된 구는 모두 DISTRICT_SLUG_MAP 에 slug 가 있다', () => {
    for (const parts of Object.values(REAL_ESTATE_DISTRICT_SPLITS['경기'])) {
      for (const name of parts) expect(DISTRICT_SLUG_MAP[name]).toBeTruthy()
    }
  })
})
