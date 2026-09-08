import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import WasteScheduleCard from '~/components/facility/WasteScheduleCard.vue'

const schedule = {
  id: 15019,
  city: '대구광역시',
  district: '달성군',
  targetRegion: '간경리',
  emissionPlace: '집앞',
  emissionPlaceType: '문전수거',
  uncollectedDay: '설+추석+일요일',
  wasteTypes: [
    { type: '일반쓰레기' as const, dayOfWeek: ['월', '화', '수', '목', '금'] },
    { type: '음식물쓰레기' as const, dayOfWeek: ['일', '화', '목'] },
  ],
}

describe('WasteScheduleCard', () => {
  it('현재 지역으로 이동하는 링크 대신 상세 선택 이벤트를 발생시킨다', async () => {
    const wrapper = mount(WasteScheduleCard, {
      props: { region: schedule },
      global: {
        stubs: {
          CategoryIcon: { template: '<span />' },
        },
      },
    })

    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.get('button').attributes('aria-label')).toContain('상세 정보 보기')

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('select')).toEqual([[schedule]])
  })
})

// 운영 API 에는 요일·시간·방법이 다 있는데 카드는 유형 배지만 렌더해,
// 크롤러가 받는 구·군 trash 본문이 전국 어디나 사실상 같았다
// (RESEARCH/naver-decline-2026-09-08/recheck-waste.md 실측: 종로·달서·고창 모두
//  초기 HTML 에 요일·시각·방법 없음).
const dalseo = {
  id: 10817,
  city: '대구광역시',
  district: '달서구',
  targetRegion: '본리동',
  emissionPlace: '문전배출',
  emissionPlaceType: '문전수거',
  managementZone: '달서구 2권역',
  dataCreatedDate: '2025-10-31',
  wasteTypes: [
    { type: '일반쓰레기' as const, dayOfWeek: ['월', '수', '금'], beginTime: '20:00', endTime: '02:00', method: '빈칸' },
    { type: '재활용' as const, dayOfWeek: ['월', '수', '금'], beginTime: '20:00', endTime: '02:00', method: '투명봉투 배출' },
  ],
}

function mountCard(region: Record<string, unknown>) {
  return mount(WasteScheduleCard, {
    props: { region: region as never },
    global: { stubs: { CategoryIcon: { template: '<span />' } } },
  })
}

describe('WasteScheduleCard 배출 정보 본문', () => {
  it('유형별 배출 요일을 렌더한다', () => {
    expect(mountCard(dalseo).text()).toContain('월 · 수 · 금')
  })

  it('자정을 넘는 배출 시간을 익일로 표기한다', () => {
    expect(mountCard(dalseo).text()).toContain('20:00 ~ 익일 02:00')
  })

  it('시작·종료가 같은 시각을 24시간으로 바꾸지 않는다', () => {
    // 고창 음식물 13500 은 원본이 20:00~20:00 이다. 24시간 운영으로 추정하면 틀린 안내가 된다.
    const gochang = {
      ...dalseo,
      wasteTypes: [
        { type: '음식물쓰레기' as const, dayOfWeek: ['월', '수', '금'], beginTime: '20:00', endTime: '20:00' },
      ],
    }
    const text = mountCard(gochang).text()

    expect(text).toContain('20:00 ~ 20:00')
    expect(text).not.toContain('24시간')
    expect(text).not.toContain('익일')
  })

  it('실제 배출 방법을 렌더한다', () => {
    expect(mountCard(dalseo).text()).toContain('투명봉투 배출')
  })

  it("원본의 '빈칸' 자리표시자를 배출 방법으로 노출하지 않는다", () => {
    expect(mountCard(dalseo).text()).not.toContain('빈칸')
  })

  it('요일이 없으면 미제공을 안내한다 — 추정하지 않는다', () => {
    const noDays = {
      ...dalseo,
      wasteTypes: [{ type: '일반쓰레기' as const, dayOfWeek: [], beginTime: '', endTime: '' }],
    }

    expect(mountCard(noDays).text()).toContain('요일 정보 없음')
  })

  it('관리구역과 자료 기준일을 함께 보여준다 — 동기화 시각과 구분된다', () => {
    const text = mountCard(dalseo).text()

    expect(text).toContain('달서구 2권역')
    expect(text).toContain('자료 기준일 2025-10-31')
  })
})

describe('WasteScheduleCard SSR 본문', () => {
  // 수용 기준: 브라우저 JS 실행 전(=크롤러가 받는 초기 HTML)에 실제 요일·시간·방법이 읽혀야 한다.
  it('서버 렌더 HTML 에 요일·시간·방법이 들어간다', async () => {
    const { createSSRApp } = await import('vue')
    const { renderToString } = await import('@vue/server-renderer')

    const app = createSSRApp({
      components: { WasteScheduleCard, CategoryIcon: { template: '<span/>' } },
      template: '<WasteScheduleCard :region="region" />',
      data: () => ({ region: dalseo }),
    })
    const text = (await renderToString(app)).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')

    expect(text).toContain('월 · 수 · 금')
    expect(text).toContain('20:00 ~ 익일 02:00')
    expect(text).toContain('투명봉투 배출')
    expect(text).toContain('자료 기준일 2025-10-31')
    expect(text).not.toContain('빈칸')
  })
})
