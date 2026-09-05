/**
 * 페이지네이션 href 의 "UI 상태 쿼리 누출" 회귀 방지.
 *
 * 고친 버그: buildPageHref 가 page 를 제외한 모든 쿼리 키를 그대로 복사했다.
 * 쓰레기 배출 모달이 열린 상태(`?schedule=13343`)에서 렌더된 페이지네이션 `<a href>` 는
 * `/chungnam/buyeo/trash?schedule=13343&page=2` 가 되어, 크롤러에게 파라미터 공간으로
 * 들어가는 크롤 가능한 입구를 만들어 줬다. canonical 은 쿼리 없는 지역 허브를 가리키므로
 * 그 URL 은 전부 2차 중복 문서가 된다.
 *
 * 모달 딥링크(`?schedule=`) 자체는 공유 가능한 URL 이라 살려둔다. 여기서 끊는 것은
 * "크롤러가 그 공간을 계속 발견하는 내부 링크"뿐이다.
 */
import { describe, it, expect } from 'vitest'
import { buildTrashRegionPath } from '~/shared/regionSlugs'
import {
  buildPageHref,
  isUiStateQueryKey,
  stripUiStateQuery,
  UI_STATE_QUERY_KEYS,
} from '~/utils/paginationHref'

describe('UI_STATE_QUERY_KEYS', () => {
  it('schedule 을 UI 상태 키로 포함한다', () => {
    expect(UI_STATE_QUERY_KEYS).toContain('schedule')
    expect(isUiStateQueryKey('schedule')).toBe(true)
  })

  it('실제 필터 파라미터는 UI 상태가 아니다 (색인 대상 콘텐츠를 바꾸는 값)', () => {
    for (const key of ['city', 'district', 'keyword', 'page']) {
      expect(isUiStateQueryKey(key)).toBe(false)
    }
  })
})

describe('buildPageHref — UI 상태 키 제거', () => {
  it('schedule 을 href 에서 제거한다', () => {
    expect(buildPageHref('/chungnam/buyeo/trash', { schedule: '13343' }, 2)).toBe(
      '/chungnam/buyeo/trash?page=2',
    )
  })

  it('page 1 에서도 schedule 을 제거한다 (canonical URL 과 동일하게 유지)', () => {
    expect(buildPageHref('/chungnam/buyeo/trash', { schedule: '13343' }, 1)).toBe(
      '/chungnam/buyeo/trash',
    )
  })

  it('schedule 은 버리고 실제 필터(city)는 보존한다', () => {
    expect(buildPageHref('/trash', { city: 'seoul', schedule: '13343' }, 3)).toBe(
      '/trash?city=seoul&page=3',
    )
  })

  it('keyword 등 콘텐츠를 바꾸는 파라미터는 그대로 둔다', () => {
    expect(buildPageHref('/trash', { keyword: '부여', schedule: '13343' }, 2)).toBe(
      '/trash?keyword=%EB%B6%80%EC%97%AC&page=2',
    )
  })

  it('배열로 들어온 schedule 도 제거한다 (route.query 는 배열일 수 있다)', () => {
    expect(buildPageHref('/trash', { schedule: ['13343', '999'], city: 'seoul' }, 2)).toBe(
      '/trash?city=seoul&page=2',
    )
  })

  it('생성된 href 어디에도 schedule 문자열이 남지 않는다', () => {
    const href = buildPageHref('/chungnam/buyeo/trash', { schedule: '13343', city: 'chungnam' }, 5)
    expect(href).not.toContain('schedule')
  })
})

describe('stripUiStateQuery', () => {
  it('UI 상태 키만 제거하고 나머지는 그대로 돌려준다', () => {
    expect(stripUiStateQuery({ city: 'seoul', page: '2', schedule: '13343' })).toEqual({
      city: 'seoul',
      page: '2',
    })
  })

  it('원본 객체를 변형하지 않는다 (route.query 는 read-only 로 취급)', () => {
    const query = { city: 'seoul', schedule: '13343' }
    stripUiStateQuery(query)
    expect(query).toEqual({ city: 'seoul', schedule: '13343' })
  })

  it('UI 상태 키가 없으면 값이 동일한 사본을 돌려준다', () => {
    expect(stripUiStateQuery({ city: 'seoul' })).toEqual({ city: 'seoul' })
  })
})

describe('href 와 SPA URL 의 일치 (syncPageQuery 계약)', () => {
  /** 페이지들의 syncPageQuery 를 그대로 재현한다 — 두 경로가 같은 stripUiStateQuery 를 쓴다. */
  function syncPageQuery(query: Record<string, string>, page: number): Record<string, string> {
    const next = stripUiStateQuery(query)
    if (page > 1) next.page = String(page)
    else delete next.page
    return next
  }

  function toHref(path: string, query: Record<string, string>): string {
    const params = new URLSearchParams(query)
    const qs = params.toString()
    return qs ? `${path}?${qs}` : path
  }

  it('모달이 열린 상태에서 2페이지로 이동해도 href 와 클릭 결과 URL 이 같다', () => {
    const path = '/chungnam/buyeo/trash'
    const query = { schedule: '13343', city: 'chungnam' }
    expect(toHref(path, syncPageQuery(query, 2))).toBe(buildPageHref(path, query, 2))
  })

  it('1페이지로 돌아갈 때도 두 URL 이 같다', () => {
    const path = '/chungnam/buyeo/trash'
    const query = { schedule: '13343', page: '4' }
    expect(toHref(path, syncPageQuery(query, 1))).toBe(buildPageHref(path, query, 1))
  })
})

describe('buildTrashRegionPath — 빈 세그먼트 경로를 만들지 않는다', () => {
  /**
   * trashDistrictSlug 는 DISTRICT_SLUG_MAP 에 없는 이름을 만나면 시/군/구를 떼고 한글을 전부
   * 지운다. 순한글 이름이면 결과가 '' 이라 `/gyeonggi//trash` 같은 빈 세그먼트 경로가 나왔다.
   * 그 경로는 404 다 — /trash/{id} 가 301 로 404 를 가리키는 셈이고, 네이버 진단에서
   * "리디렉션"과 "접근 불가"를 동시에 올린다.
   *
   * 같은 PR 이 사이트맵 게이트에 `empty-segment` 사유를 추가했으면서 정작 이 생성기는
   * 그대로 뒀다. 생성기가 null 을 주면 호출부는 리다이렉트하지 않고 그냥 200 을 렌더한다 —
   * 404 로 보내는 것보다 언제나 낫다.
   */
  it('district slug 를 만들 수 없으면 null 이다 (빈 세그먼트 금지)', () => {
    expect(buildTrashRegionPath('경기도', '없는구이름')).toBeNull()
  })

  it('알려진 구·군은 정상 경로를 만든다 (과교정 방지)', () => {
    expect(buildTrashRegionPath('충청남도', '부여군')).toBe('/chungnam/buyeo/trash')
  })

  it('city 를 해결할 수 없으면 여전히 null 이다', () => {
    expect(buildTrashRegionPath('없는도', '부여군')).toBeNull()
  })

  it('어떤 입력도 빈 세그먼트(//)를 만들지 않는다', () => {
    const inputs: Array<[string, string]> = [
      ['경기도', '없는구이름'],
      ['서울특별시', '가나다구'],
      ['제주특별자치도', '어떤군'],
      ['충청남도', '부여군'],
    ]
    for (const [city, district] of inputs) {
      const path = buildTrashRegionPath(city, district)
      if (path !== null) expect(path).not.toContain('//')
    }
  })
})

describe('trashDistrictSlug — 접미사 없는 원본 표기도 정규 허브로 보낸다', () => {
  // 배출 일정 원본이 '남양주'·'동두천' 처럼 시/군/구 접미사 없이 적는 경우가 있다.
  // 지도에는 '남양주시'·'동두천시' 로 있어 조회가 빗나갔고, 폴백이 한글을 전부 지워
  // 빈 슬러그가 됐다. 실측 2026-09-04: WasteSchedule 의 217개 (시도, 구·군) 조합 중 3개.
  it('접미사를 붙여 지도에서 찾는다', () => {
    expect(buildTrashRegionPath('경기도', '남양주')).toBe('/gyeonggi/namyangju/trash')
    expect(buildTrashRegionPath('경기도', '동두천')).toBe('/gyeonggi/dongducheon/trash')
  })

  it('그래도 못 찾으면 null 이다 (404 로 301 하지 않는다)', () => {
    expect(buildTrashRegionPath('세종특별자치시', '없음')).toBeNull()
  })
})
