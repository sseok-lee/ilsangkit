import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import WasteListPanel from '~/components/trash/WasteListPanel.vue'
import type { RegionScheduleResponse } from '~/composables/useWasteSchedule'
import type { WasteListQuery } from '~/types/wasteList'

const query: WasteListQuery = {
  city: '전라남도',
  district: '강진군',
  keyword: '덕동',
  page: 1,
  limit: 20,
}

function result(overrides: Partial<RegionScheduleResponse> = {}): RegionScheduleResponse {
  return {
    schedules: [
      {
        id: 2001,
        city: '전라남도',
        district: '강진군',
        targetRegion: '요양원,칠량면소재지,초등학교.칠량시장,덕동',
        emissionPlace: '일정 수거장소',
        managementZone: '칠량, 대구, 마량(금)',
        applicableAreas: [],
        wasteTypes: [
          { type: '일반쓰레기', dayOfWeek: ['금'], beginTime: '20:00', endTime: '06:00' },
          { type: '음식물쓰레기', dayOfWeek: ['월', '수', '금'], beginTime: '20:00', endTime: '06:00' },
          { type: '재활용', dayOfWeek: ['금'], beginTime: '20:00', endTime: '06:00' },
        ],
      },
    ],
    total: 1,
    page: 1,
    totalPages: 1,
    ...overrides,
  }
}

function mountPanel(props: Partial<InstanceType<typeof WasteListPanel>['$props']> = {}) {
  return mount(WasteListPanel, {
    props: {
      result: result(),
      query,
      pending: false,
      error: null,
      hrefFor: (page: number) => `/trash?page=${page}`,
      clearKeywordHref: '/trash?city=전라남도&district=강진군',
      clearAreaHref: '/trash?city=전라남도&district=강진군',
      firstPageHref: '/trash?city=전라남도&district=강진군',
      ...props,
    },
    global: {
      stubs: {
        CategoryIcon: { template: '<span />' },
      },
    },
  })
}

describe('WasteListPanel', () => {
  it('원본 한 건당 하나의 카드와 안전한 검색 발췌를 렌더한다', () => {
    const wrapper = mountPanel()

    expect(wrapper.findAll('a[href="/trash/2001"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('요양원·칠량면소재지 등')
    expect(wrapper.text()).toContain('덕동')
    expect(wrapper.text()).not.toContain('덕동 배출안내')
  })

  it('18자 제목 제한 때문에 숨겨진 검색 토큰은 발췌로 보인다', () => {
    const wrapper = mountPanel({
      query: { ...query, keyword: '후순위토큰' },
      result: result({
        schedules: [{
          id: 2002,
          city: '전라남도',
          district: '강진군',
          targetRegion: '매우긴첫번째대상지역명,두번째대상지역명,후순위토큰',
          emissionPlace: '일정 수거장소',
          managementZone: '후순위토큰 관리구역',
          applicableAreas: [],
          wasteTypes: [
            { type: '일반쓰레기', dayOfWeek: ['금'], beginTime: '20:00', endTime: '06:00' },
          ],
        }],
      }),
    })

    expect(wrapper.text()).toContain('매우긴첫번째대상지역명 등')
    const excerpt = wrapper.find('p.bg-background-light')
    expect(excerpt.exists()).toBe(true)
    expect(excerpt.text()).toContain('후순위토큰')
  })

  it('페이지 범위 밖이면 첫 페이지 링크를 안내하고 API totalPages를 바꾸지 않는다', () => {
    const wrapper = mountPanel({
      query: { ...query, page: 5 },
      result: result({ page: 5, total: 21, totalPages: 2 }),
    })

    expect(wrapper.text()).toContain('요청한 페이지에 표시할 배출 일정이 없습니다')
    expect(wrapper.get('a[href="/trash?city=전라남도&district=강진군"]').text()).toContain('첫 페이지')
  })

  it.each([
    ['지역 조건 결과 없음', { ...query, keyword: undefined }, '이 지역에 등록된 배출 일정이 없습니다'],
    ['동 필터 결과 없음', { ...query, areaId: 101, keyword: undefined }, '선택한 동에 연결된 배출 일정이 없습니다'],
    ['검색 결과 없음', query, '검색어와 일치하는 배출 일정이 없습니다'],
    ['연결 확인 결과 없음', { ...query, coverage: 'unresolved' as const, keyword: undefined }, '동 연결 확인이 필요한 원본이 없습니다'],
  ])('%s 메시지를 구분한다', (_name, nextQuery, message) => {
    const wrapper = mountPanel({ query: nextQuery, result: result({ schedules: [], total: 0, totalPages: 1 }) })

    expect(wrapper.text()).toContain(message)
  })

  it('목록 오류는 메인 패널에서 retry만 올리고 동 옵션 오류와 섞지 않는다', async () => {
    const wrapper = mountPanel({ result: null, error: new Error('network') })

    expect(wrapper.text()).toContain('배출 일정 목록을 불러오지 못했습니다')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('페이지네이션 링크는 유지하고 평범한 클릭은 page-change를 올린다', async () => {
    const wrapper = mountPanel({ result: result({ total: 40, totalPages: 2 }) })
    const next = wrapper.get('a[aria-label="2 페이지"]')

    expect(next.attributes('href')).toBe('/trash?page=2')
    await next.trigger('click')
    expect(wrapper.emitted('page-change')?.[0]).toEqual([2])
  })
})
