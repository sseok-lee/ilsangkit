import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import WasteScheduleContent from '~/components/trash/WasteScheduleContent.vue'

const SCHEDULE_ID = 6567

const schedule = {
  id: SCHEDULE_ID,
  city: '서울특별시',
  district: '강남구',
  targetRegion: '역삼1동+역삼2동',
  emissionPlace: '문전 배출',
  sourceUrl: 'https://example.go.kr/waste',
  details: {
    livingWaste: { dayOfWeek: '월+수+금', beginTime: '18:00', endTime: '22:00', method: '종량제 봉투' },
    bulkWaste: { method: '동주민센터 신고', place: '집 앞', beginTime: '06:00', endTime: '10:00' },
    manageDepartment: '청소행정과',
    managePhone: '02-3423-1234567890',
    dataCreatedDate: '2026-09-20',
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
    expect(link.attributes('href')).toBe(`/trash/${SCHEDULE_ID}`)
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
})
