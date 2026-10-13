import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import WasteScheduleContent from '~/components/trash/WasteScheduleContent.vue'

const SCHEDULE_ID = 6567

const schedule = {
  id: SCHEDULE_ID,
  city: '서울특별시',
  district: '강남구',
  targetRegion: '요양원,칠량면소재지,초등학교.칠량시장,덕동',
  emissionPlace: '문전 배출',
  sourceUrl: 'https://example.go.kr/waste',
  applicableAreas: [
    { areaId: 101, name: '역삼1동', href: '/trash?areaId=101', scope: 'conditional', conditionText: '공동주택 제외' },
  ],
  details: {
    livingWaste: { dayOfWeek: '월+수+금', beginTime: '18:00', endTime: '22:00', method: '종량제 봉투' },
    foodWaste: { dayOfWeek: '기타', beginTime: '20:00', endTime: '05:00', method: '전용봉투' },
    recyclable: { dayOfWeek: '화+목', beginTime: '20:00', endTime: '05:00', method: '투명봉투' },
    bulkWaste: { method: '동주민센터 신고', place: '집 앞', beginTime: '06:00', endTime: '10:00' },
    manageDepartment: '청소행정과',
    managePhone: '02-3423-1234567890',
    dataCreatedDate: '2026-09-20',
    lastModified: '2026-09-21 10:00:00',
  },
}

beforeEach(() => {
  vi.stubGlobal('navigateTo', vi.fn())
  vi.stubGlobal('useRoute', () => ({ path: '/trash/areas/101', fullPath: '/trash/areas/101', query: {} }))
  vi.stubGlobal('useNuxtApp', () => ({ $router: { push: vi.fn(() => Promise.resolve()) } }))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function mountIt() {
  return mount(WasteScheduleContent, {
    props: { schedule: schedule as never, scope: 'conditional', conditionText: '역삼1동 공동주택 제외' },
    global: { stubs: { ClientOnly: { template: '<div><slot /></div>' } } },
  })
}

describe('WasteScheduleContent 평면형', () => {
  it('카드는 10px 테두리이고 그림자·hex 클래스가 없다', () => {
    const wrapper = mountIt()
    const article = wrapper.get('article')
    expect(article.classes()).toEqual(expect.arrayContaining(['rounded-[10px]', 'border', 'border-line']))
    expect(wrapper.html()).not.toMatch(/shadow-|-\[#/)
  })

  it('원문 보기는 보조 버튼 링크이고 href 를 유지한다', () => {
    const wrapper = mountIt()
    const link = wrapper.findAll('a').find((a) => a.text() === '원문 보기')!
    expect(link.classes()).toContain('ui-btn--secondary')
    expect(link.attributes('href')).toBe('https://example.go.kr/waste')
  })

  it('출처·연락처 꼬리말은 회색 보조면이다', () => {
    const wrapper = mountIt()
    expect(wrapper.get('footer').classes()).toEqual(expect.arrayContaining(['bg-background-light', 'rounded-[10px]']))
  })

  it('장식 아이콘은 모두 aria-hidden 이다', () => {
    const wrapper = mountIt()
    const icons = wrapper.findAll('.material-symbols-outlined')
    expect(icons.length).toBeGreaterThan(0)
    for (const icon of icons) {
      expect(icon.attributes('aria-hidden')).toBe('true')
    }
  })

  it('카드와 같은 대상 제목을 쓰고 원본 상세로 자기 자신 링크를 만들지 않는다', () => {
    const wrapper = mountIt()

    expect(wrapper.get('h3').text()).toBe('요양원·칠량면소재지 등')
    expect(wrapper.find(`a[href="/trash/${SCHEDULE_ID}"]`).exists()).toBe(false)
  })

  it('원본 대상 전체와 검증된 동 링크, 조건 문구를 서로 분리해서 보여준다', () => {
    const wrapper = mountIt()
    const text = wrapper.text()

    expect(text).toContain('원본 대상')
    expect(text).toContain('요양원,칠량면소재지,초등학교.칠량시장,덕동')
    expect(text).toContain('역삼1동 공동주택 제외')
    expect(wrapper.get('a[href="/trash?areaId=101"]').text()).toContain('역삼1동')
    expect(text).not.toContain('해당 동 전체')
  })

  it('세 유형 요일과 혼합 시간을 하나의 공통 시간으로 조작하지 않는다', () => {
    const text = mountIt().text()

    expect(text).toContain('월')
    expect(text).toContain('기타')
    expect(text).toContain('화')
    expect(text).toContain('18:00 ~ 22:00')
    expect(text).toContain('20:00 ~ 익일 05:00')
    expect(text).not.toContain('유형별 배출 시간 확인')
  })

  it('일시적 다량폐기물 라벨과 별도 자료 기준일/수정일을 보여준다', () => {
    const text = mountIt().text()

    expect(text).toContain('일시적 다량폐기물')
    expect(text).not.toContain('대형폐기물')
    expect(text).toContain('자료 기준일')
    expect(text).toContain('2026-09-20')
    expect(text).toContain('최종 수정일')
    expect(text).toContain('2026-09-21 10:00:00')
  })
})
